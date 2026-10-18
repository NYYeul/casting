import { randomUUID } from 'node:crypto';
import { db, createRole, getRoleById, type NewRole } from './db';
import { hashPassword } from './password';
import type { ActorProfile, Filmography, Gender } from './profile';
import type { UserRole } from './session-token';

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string;
  orgType: string;
  orgName: string;
  createdAt: string;
};

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  genre: string;
  shootStart: string;
  shootEnd: string;
  location: string;
  description: string;
  createdAt: string;
};

export type Proposal = {
  id: string;
  producerId: string;
  producerName: string;
  orgName: string;
  actorId: string;
  actorName: string;
  roleId: string;
  roleSlug: string;
  roleTitle: string;
  projectTitle: string;
  message: string;
  status: 'sent' | 'accepted' | 'declined';
  createdAt: string;
};

type Row = Record<string, unknown>;

function userFromRow(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role as UserRole,
    name: String(row.name),
    phone: String(row.phone),
    orgType: String(row.org_type),
    orgName: String(row.org_name),
    createdAt: String(row.created_at),
  };
}

function parseList<T>(value: unknown): T[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function profileFromRow(row: Row): ActorProfile {
  return {
    userId: String(row.user_id),
    name: String(row.name),
    gender: String(row.gender) as Gender,
    birthYear: row.birth_year === null ? null : Number(row.birth_year),
    height: row.height === null ? null : Number(row.height),
    weight: row.weight === null ? null : Number(row.weight),
    region: String(row.region),
    intro: String(row.intro),
    tags: parseList<string>(row.tags),
    skills: parseList<string>(row.skills),
    photos: parseList<string>(row.photos),
    videoUrl: String(row.video_url),
    filmography: parseList<Filmography>(row.filmography),
    unavailableDates: parseList<string>(row.unavailable_dates),
    isPublic: Boolean(row.is_public),
    updatedAt: String(row.updated_at),
  };
}

export function getUserById(id: string) {
  const row = db().prepare('SELECT * FROM users WHERE id=?').get(id);
  return row ? userFromRow(row as Row) : null;
}

export function getUserWithHash(email: string) {
  const row = db().prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase()) as
    Row | undefined;
  return row ? { user: userFromRow(row), passwordHash: String(row.password_hash) } : null;
}

export function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone: string;
  orgType?: string;
  orgName?: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO users (id,email,password_hash,role,name,phone,org_type,org_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.role,
      input.name,
      input.phone,
      input.orgType || '',
      input.orgName || '',
      now,
    );
  if (input.role === 'actor')
    db().prepare('INSERT INTO actor_profiles (user_id,updated_at) VALUES (?,?)').run(id, now);
  return getUserById(id)!;
}

const PROFILE_SELECT = `SELECT p.*, u.name FROM actor_profiles p JOIN users u ON u.id=p.user_id`;

export function getProfile(userId: string) {
  const row = db().prepare(`${PROFILE_SELECT} WHERE p.user_id=?`).get(userId);
  return row ? profileFromRow(row as Row) : null;
}

export function listPublicProfiles() {
  return db()
    .prepare(`${PROFILE_SELECT} WHERE p.is_public=1 ORDER BY p.updated_at DESC`)
    .all()
    .map((row) => profileFromRow(row as Row));
}

export function updateProfile(userId: string, input: Omit<ActorProfile, 'userId' | 'updatedAt'>) {
  db()
    .prepare(
      `UPDATE actor_profiles SET gender=?,birth_year=?,height=?,weight=?,region=?,intro=?,tags=?,skills=?,
      photos=?,video_url=?,filmography=?,unavailable_dates=?,is_public=?,updated_at=? WHERE user_id=?`,
    )
    .run(
      input.gender,
      input.birthYear,
      input.height,
      input.weight,
      input.region,
      input.intro,
      JSON.stringify(input.tags),
      JSON.stringify(input.skills),
      JSON.stringify(input.photos),
      input.videoUrl,
      JSON.stringify(input.filmography),
      JSON.stringify(input.unavailableDates),
      Number(input.isPublic),
      new Date().toISOString(),
      userId,
    );
  if (input.name) db().prepare('UPDATE users SET name=? WHERE id=?').run(input.name, userId);
  return getProfile(userId)!;
}

export function listFavoriteIds(producerId: string) {
  return (
    db().prepare('SELECT actor_id FROM favorites WHERE producer_id=?').all(producerId) as {
      actor_id: string;
    }[]
  ).map((row) => row.actor_id);
}

export function setFavorite(producerId: string, actorId: string, on: boolean) {
  if (on)
    db()
      .prepare('INSERT OR IGNORE INTO favorites (producer_id,actor_id,created_at) VALUES (?,?,?)')
      .run(producerId, actorId, new Date().toISOString());
  else
    db()
      .prepare('DELETE FROM favorites WHERE producer_id=? AND actor_id=?')
      .run(producerId, actorId);
}

function projectFromRow(row: Row): Project {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    genre: String(row.genre),
    shootStart: String(row.shoot_start),
    shootEnd: String(row.shoot_end),
    location: String(row.location),
    description: String(row.description),
    createdAt: String(row.created_at),
  };
}

export function listProjects(ownerId: string) {
  return db()
    .prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC')
    .all(ownerId)
    .map((row) => projectFromRow(row as Row));
}

function insertProject(
  ownerId: string,
  input: Omit<Project, 'id' | 'ownerId' | 'createdAt'>,
): Project {
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO projects (id,owner_id,title,genre,shoot_start,shoot_end,location,description,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      ownerId,
      input.title,
      input.genre,
      input.shootStart,
      input.shootEnd,
      input.location,
      input.description,
      new Date().toISOString(),
    );
  return projectFromRow(db().prepare('SELECT * FROM projects WHERE id=?').get(id) as Row);
}

export function findOrCreateProject(ownerId: string, role: NewRole) {
  const row = db()
    .prepare('SELECT * FROM projects WHERE owner_id=? AND title=?')
    .get(ownerId, role.projectTitle);
  return row
    ? projectFromRow(row as Row)
    : insertProject(ownerId, {
        title: role.projectTitle,
        genre: '',
        shootStart: role.shootDate,
        shootEnd: role.shootDate,
        location: role.location,
        description: '',
      });
}

export function createProjectWithRoles(
  ownerId: string,
  project: Omit<Project, 'id' | 'ownerId' | 'createdAt'>,
  roles: Omit<NewRole, 'projectTitle'>[],
) {
  const conn = db();
  conn.exec('BEGIN');
  try {
    const created = insertProject(ownerId, project);
    const createdRoles = roles.map((role) =>
      createRole({ ...role, projectTitle: project.title }, ownerId, created.id),
    );
    conn.exec('COMMIT');
    return { project: created, roles: createdRoles };
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

const PROPOSAL_SELECT = `SELECT pr.*, pu.name producer_name, pu.org_name, au.name actor_name,
  r.slug role_slug, r.title role_title, r.project_title
  FROM proposals pr
  JOIN users pu ON pu.id=pr.producer_id
  JOIN users au ON au.id=pr.actor_id
  JOIN roles r ON r.id=pr.role_id`;

function proposalFromRow(row: Row): Proposal {
  return {
    id: String(row.id),
    producerId: String(row.producer_id),
    producerName: String(row.producer_name),
    orgName: String(row.org_name),
    actorId: String(row.actor_id),
    actorName: String(row.actor_name),
    roleId: String(row.role_id),
    roleSlug: String(row.role_slug),
    roleTitle: String(row.role_title),
    projectTitle: String(row.project_title),
    message: String(row.message),
    status: row.status as Proposal['status'],
    createdAt: String(row.created_at),
  };
}

export function createProposal(
  producerId: string,
  actorId: string,
  roleId: string,
  message: string,
) {
  const role = getRoleById(roleId);
  if (!role || role.ownerId !== producerId) return { error: '배역을 찾을 수 없습니다.' } as const;
  const actor = getUserById(actorId);
  if (!actor || actor.role !== 'actor') return { error: '배우를 찾을 수 없습니다.' } as const;
  const existing = db()
    .prepare('SELECT id FROM proposals WHERE actor_id=? AND role_id=?')
    .get(actorId, roleId);
  if (existing) return { error: '이미 이 배역으로 제안을 보냈습니다.' } as const;
  const id = randomUUID();
  db()
    .prepare(
      'INSERT INTO proposals (id,producer_id,actor_id,role_id,message,created_at) VALUES (?,?,?,?,?,?)',
    )
    .run(id, producerId, actorId, roleId, message, new Date().toISOString());
  return { proposal: getProposal(id)! } as const;
}

export function getProposal(id: string) {
  const row = db().prepare(`${PROPOSAL_SELECT} WHERE pr.id=?`).get(id);
  return row ? proposalFromRow(row as Row) : null;
}

export function listActorProposals(actorId: string) {
  return db()
    .prepare(`${PROPOSAL_SELECT} WHERE pr.actor_id=? ORDER BY pr.created_at DESC`)
    .all(actorId)
    .map((row) => proposalFromRow(row as Row));
}

export function listProducerProposals(producerId: string, actorId: string) {
  return db()
    .prepare(`${PROPOSAL_SELECT} WHERE pr.producer_id=? AND pr.actor_id=?`)
    .all(producerId, actorId)
    .map((row) => proposalFromRow(row as Row));
}

export function setProposalStatus(id: string, actorId: string, status: 'accepted' | 'declined') {
  const result = db()
    .prepare("UPDATE proposals SET status=? WHERE id=? AND actor_id=? AND status='sent'")
    .run(status, id, actorId);
  return result.changes > 0;
}

import { randomUUID } from 'node:crypto';
import { db, createRole, getRoleById, type NewRole } from './db';
import { hashPassword } from './password';
import { transaction } from './sql';
import { deleteUploads } from './storage';
import type { ActorProfile, Filmography, Gender } from './profile';
import type { UserRole } from './session-token';

export type ProfileDocument = { name: string; url: string };

/**
 * ActorProfile plus the columns added later to actor_profiles
 * (소속 agency, PDF 자료 documents). getProfile keeps the base ActorProfile
 * return type for backwards compatibility — use getProfileFull / listPublicProfiles
 * when the extra fields are needed.
 */
export type ActorProfileFull = ActorProfile & {
  agency: string;
  documents: ProfileDocument[];
};

export const MAX_DOCUMENTS = 5;

const PDF_UPLOAD_PATTERN = /^\/api\/uploads\/[a-f0-9-]{36}\.pdf$/;

/** Only PDFs uploaded through /api/uploads may be stored as profile documents. */
export function safeDocumentRef(value: unknown) {
  const text = typeof value === 'string' ? value.trim().slice(0, 1000) : '';
  return PDF_UPLOAD_PATTERN.test(text) ? text : '';
}

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

function parseDocuments(value: unknown): ProfileDocument[] {
  return parseList<ProfileDocument>(value)
    .map((doc) => ({
      name: typeof doc?.name === 'string' ? doc.name : '',
      url: typeof doc?.url === 'string' ? doc.url : '',
    }))
    .filter((doc) => doc.url)
    .slice(0, MAX_DOCUMENTS);
}

function profileFromRow(row: Row): ActorProfileFull {
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
    agency: String(row.agency ?? ''),
    documents: parseDocuments(row.documents),
  };
}

export async function getUserById(id: string) {
  const row = await db().prepare('SELECT * FROM users WHERE id=?').get(id);
  return row ? userFromRow(row as Row) : null;
}

/**
 * 공고에 함께 보여 주는 제작자 정보.
 * 확인된 사실만 담는다 — 아직 재학·사업자 인증 절차가 없으므로 '인증' 배지는 만들지 않는다.
 * 가짜 인증 표시는 "믿을 만한 공고인지 알고 싶다"는 요구를 오히려 배신한다.
 */
export type ProducerIntro = {
  name: string;
  orgType: string;
  orgName: string;
  /** 이 제작자가 올린 공고 수 (처음 올린 공고인지 알 수 있다) */
  totalRoles: number;
  openRoles: number;
  /** 가입 연월 'YYYY-MM' */
  memberSince: string;
};

export async function getProducerIntro(ownerId: string): Promise<ProducerIntro | null> {
  const user = await getUserById(ownerId);
  if (!user || user.role !== 'producer') return null;
  const row = (await db()
    .prepare(
      `SELECT COUNT(*) total, SUM(CASE WHEN is_closed=0 THEN 1 ELSE 0 END) open
       FROM roles WHERE owner_id=?`,
    )
    .get(ownerId)) as { total: number; open: number | null } | undefined;
  return {
    name: user.name,
    orgType: user.orgType,
    orgName: user.orgName,
    totalRoles: Number(row?.total || 0),
    openRoles: Number(row?.open || 0),
    memberSince: user.createdAt.slice(0, 7),
  };
}

export async function getUserWithHash(email: string) {
  const row = (await db().prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase())) as
    Row | undefined;
  return row ? { user: userFromRow(row), passwordHash: String(row.password_hash) } : null;
}

export async function createUser(input: {
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
  await db()
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
    await db().prepare('INSERT INTO actor_profiles (user_id,updated_at) VALUES (?,?)').run(id, now);
  return (await getUserById(id))!;
}

const PROFILE_SELECT = `SELECT p.*, u.name FROM actor_profiles p JOIN users u ON u.id=p.user_id`;

export async function getProfile(userId: string): Promise<ActorProfile | null> {
  const row = await db().prepare(`${PROFILE_SELECT} WHERE p.user_id=?`).get(userId);
  return row ? profileFromRow(row as Row) : null;
}

export async function getProfileFull(userId: string): Promise<ActorProfileFull | null> {
  const row = await db().prepare(`${PROFILE_SELECT} WHERE p.user_id=?`).get(userId);
  return row ? profileFromRow(row as Row) : null;
}

export async function listPublicProfiles(): Promise<ActorProfileFull[]> {
  return (
    await db().prepare(`${PROFILE_SELECT} WHERE p.is_public=1 ORDER BY p.updated_at DESC`).all()
  ).map((row) => profileFromRow(row as Row));
}

export async function updateProfile(
  userId: string,
  input: Omit<ActorProfileFull, 'userId' | 'updatedAt'>,
) {
  const documents = input.documents
    .filter((doc) => safeDocumentRef(doc.url))
    .slice(0, MAX_DOCUMENTS);
  await db()
    .prepare(
      `UPDATE actor_profiles SET gender=?,birth_year=?,height=?,weight=?,region=?,intro=?,tags=?,skills=?,
      photos=?,video_url=?,filmography=?,unavailable_dates=?,is_public=?,agency=?,documents=?,updated_at=? WHERE user_id=?`,
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
      input.agency.trim().slice(0, 60),
      JSON.stringify(documents),
      new Date().toISOString(),
      userId,
    );
  if (input.name) await db().prepare('UPDATE users SET name=? WHERE id=?').run(input.name, userId);
  return (await getProfileFull(userId))!;
}

export async function listFavoriteIds(producerId: string) {
  return (
    (await db().prepare('SELECT actor_id FROM favorites WHERE producer_id=?').all(producerId)) as {
      actor_id: string;
    }[]
  ).map((row) => row.actor_id);
}

export async function setFavorite(producerId: string, actorId: string, on: boolean) {
  if (on)
    await db()
      .prepare('INSERT OR IGNORE INTO favorites (producer_id,actor_id,created_at) VALUES (?,?,?)')
      .run(producerId, actorId, new Date().toISOString());
  else
    await db()
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

export async function listProjects(ownerId: string) {
  return (
    await db()
      .prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC')
      .all(ownerId)
  ).map((row) => projectFromRow(row as Row));
}

async function insertProject(
  ownerId: string,
  input: Omit<Project, 'id' | 'ownerId' | 'createdAt'>,
): Promise<Project> {
  const id = randomUUID();
  await db()
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
  return projectFromRow((await db().prepare('SELECT * FROM projects WHERE id=?').get(id)) as Row);
}

export async function findOrCreateProject(ownerId: string, role: NewRole) {
  const row = await db()
    .prepare('SELECT * FROM projects WHERE owner_id=? AND title=?')
    .get(ownerId, role.projectTitle);
  return row
    ? projectFromRow(row as Row)
    : await insertProject(ownerId, {
        title: role.projectTitle,
        genre: '',
        shootStart: role.shootDate,
        shootEnd: role.shootDate,
        location: role.location,
        description: '',
      });
}

export async function createProjectWithRoles(
  ownerId: string,
  project: Omit<Project, 'id' | 'ownerId' | 'createdAt'>,
  roles: Omit<NewRole, 'projectTitle'>[],
) {
  return transaction(async () => {
    const created = await insertProject(ownerId, project);
    const createdRoles = [];
    for (const role of roles)
      createdRoles.push(
        await createRole({ ...role, projectTitle: project.title }, ownerId, created.id),
      );
    return { project: created, roles: createdRoles };
  });
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

export async function createProposal(
  producerId: string,
  actorId: string,
  roleId: string,
  message: string,
) {
  const role = await getRoleById(roleId);
  if (!role || role.ownerId !== producerId) return { error: '배역을 찾을 수 없습니다.' } as const;
  const actor = await getUserById(actorId);
  if (!actor || actor.role !== 'actor') return { error: '배우를 찾을 수 없습니다.' } as const;
  const existing = await db()
    .prepare('SELECT id FROM proposals WHERE actor_id=? AND role_id=?')
    .get(actorId, roleId);
  if (existing) return { error: '이미 이 배역으로 제안을 보냈습니다.' } as const;
  const id = randomUUID();
  await db()
    .prepare(
      'INSERT INTO proposals (id,producer_id,actor_id,role_id,message,created_at) VALUES (?,?,?,?,?,?)',
    )
    .run(id, producerId, actorId, roleId, message, new Date().toISOString());
  return { proposal: (await getProposal(id))! } as const;
}

export async function getProposal(id: string) {
  const row = await db().prepare(`${PROPOSAL_SELECT} WHERE pr.id=?`).get(id);
  return row ? proposalFromRow(row as Row) : null;
}

export async function listActorProposals(actorId: string) {
  return (
    await db()
      .prepare(`${PROPOSAL_SELECT} WHERE pr.actor_id=? ORDER BY pr.created_at DESC`)
      .all(actorId)
  ).map((row) => proposalFromRow(row as Row));
}

export async function listProducerProposals(producerId: string, actorId: string) {
  return (
    await db()
      .prepare(`${PROPOSAL_SELECT} WHERE pr.producer_id=? AND pr.actor_id=?`)
      .all(producerId, actorId)
  ).map((row) => proposalFromRow(row as Row));
}

export async function setProposalStatus(
  id: string,
  actorId: string,
  status: 'accepted' | 'declined',
) {
  const result = await db()
    .prepare("UPDATE proposals SET status=? WHERE id=? AND actor_id=? AND status='sent'")
    .run(status, id, actorId);
  return result.changes > 0;
}

/**
 * 회원 탈퇴: 계정과 그 계정에 묶인 개인정보를 모두 지운다.
 * - 배우: 프로필, 낸 지원서(대화·투표·메모 포함), 받은 제안, 후보 등록
 * - 제작자: 프로젝트·배역과 거기에 들어온 지원서 전체, 팀 보드 기록, 일정, 비교 결과
 * 외래키에 CASCADE가 없어 자식 테이블부터 순서대로 지운다.
 */
export async function deleteAccount(userId: string) {
  const files: string[] = [];
  await transaction(async () => {
    const run = (sql: string, count: number) =>
      db()
        .prepare(sql)
        .run(...Array(count).fill(userId));
    const roleIds = 'SELECT id FROM roles WHERE owner_id=?'; // 1
    const projectIds = 'SELECT id FROM projects WHERE owner_id=?'; // 1
    const appIds = `SELECT id FROM applications WHERE actor_id=? OR role_id IN (${roleIds})`; // 2
    const candIds = `SELECT id FROM project_candidates
      WHERE actor_id=? OR added_by=? OR project_id IN (${projectIds})`; // 3

    const profile = (await db()
      .prepare('SELECT photos, documents FROM actor_profiles WHERE user_id=?')
      .get(userId)) as { photos: string; documents: string } | undefined;
    if (profile) {
      files.push(...(JSON.parse(profile.photos || '[]') as string[]));
      files.push(
        ...(JSON.parse(profile.documents || '[]') as { url: string }[]).map((doc) => doc.url),
      );
    }
    const apps = (await db()
      .prepare(`SELECT photo_url, photo_urls FROM applications WHERE id IN (${appIds})`)
      .all(userId, userId)) as { photo_url: string; photo_urls: string }[];
    for (const app of apps)
      files.push(app.photo_url, ...(JSON.parse(app.photo_urls || '[]') as string[]));

    await run(`DELETE FROM candidate_votes WHERE user_id=? OR candidate_id IN (${candIds})`, 4);
    await run(`DELETE FROM candidate_notes WHERE user_id=? OR candidate_id IN (${candIds})`, 4);
    await run(
      `DELETE FROM board_moves WHERE user_id=? OR candidate_id IN (${candIds}) OR application_id IN (${appIds})`,
      6,
    );
    await run(`DELETE FROM project_candidates WHERE id IN (${candIds})`, 3);
    await run(`DELETE FROM board_votes WHERE user_id=? OR application_id IN (${appIds})`, 3);
    await run(`DELETE FROM board_notes WHERE user_id=? OR application_id IN (${appIds})`, 3);
    await run(`DELETE FROM chat_messages WHERE application_id IN (${appIds})`, 2);
    await run(`DELETE FROM audition_events WHERE owner_id=? OR application_id IN (${appIds})`, 3);
    await run(
      `DELETE FROM events WHERE role_id IN (${roleIds}) OR application_id IN (${appIds})`,
      3,
    );
    await run(`DELETE FROM applications WHERE id IN (${appIds})`, 2);
    await run(
      `DELETE FROM proposals WHERE producer_id=? OR actor_id=? OR role_id IN (${roleIds})`,
      3,
    );
    await run('DELETE FROM favorites WHERE producer_id=? OR actor_id=?', 2);
    await run('DELETE FROM compare_results WHERE owner_id=?', 1);
    await run(`DELETE FROM team_members WHERE user_id=? OR project_id IN (${projectIds})`, 2);
    await run('DELETE FROM roles WHERE owner_id=?', 1);
    await run('DELETE FROM projects WHERE owner_id=?', 1);
    await run('DELETE FROM password_resets WHERE user_id=?', 1);
    await run('DELETE FROM actor_profiles WHERE user_id=?', 1);
    await run('DELETE FROM users WHERE id=?', 1);
  });
  await deleteUploads(files.filter(Boolean));
}

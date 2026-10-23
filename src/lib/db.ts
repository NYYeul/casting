import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { hashPassword } from './password';
import type { Application, Audition, ChatMessage, PublicStage, ReviewStatus, Role } from './types';

let database: DatabaseSync | undefined;

function db() {
  if (database) return database;
  const path = join(process.cwd(), 'data', 'casting.sqlite');
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, project_title TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, shoot_date TEXT NOT NULL,
      location TEXT NOT NULL, pay TEXT NOT NULL, deadline TEXT NOT NULL,
      contact_name TEXT NOT NULL, announcement_date TEXT NOT NULL,
      requirement TEXT NOT NULL, is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id),
      name TEXT NOT NULL, age INTEGER, email TEXT NOT NULL, phone TEXT NOT NULL,
      introduction TEXT NOT NULL, photo_url TEXT NOT NULL, video_url TEXT NOT NULL,
      available TEXT NOT NULL, travel TEXT NOT NULL, pay_accepted TEXT NOT NULL,
      skill TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
      shortlist INTEGER NOT NULL DEFAULT 0, public_stage TEXT NOT NULL DEFAULT 'received',
      receipt_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(role_id, email)
    );
    CREATE INDEX IF NOT EXISTS applications_role_status ON applications(role_id, status, created_at);
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, role_id TEXT NOT NULL, application_id TEXT,
      name TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
      sender TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL,
      slots TEXT NOT NULL DEFAULT '[]', place TEXT NOT NULL DEFAULT '',
      preparation TEXT NOT NULL DEFAULT '', selected_slot TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chat_messages_app ON chat_messages(application_id, created_at);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
      org_type TEXT NOT NULL DEFAULT '', org_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actor_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id), gender TEXT NOT NULL DEFAULT '',
      birth_year INTEGER, height INTEGER, weight INTEGER, region TEXT NOT NULL DEFAULT '',
      intro TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
      skills TEXT NOT NULL DEFAULT '[]', photos TEXT NOT NULL DEFAULT '[]',
      video_url TEXT NOT NULL DEFAULT '', filmography TEXT NOT NULL DEFAULT '[]',
      unavailable_dates TEXT NOT NULL DEFAULT '[]', is_public INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '', shoot_start TEXT NOT NULL DEFAULT '',
      shoot_end TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      producer_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, PRIMARY KEY (producer_id, actor_id)
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY, producer_id TEXT NOT NULL REFERENCES users(id),
      actor_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id),
      message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent', created_at TEXT NOT NULL,
      UNIQUE(actor_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS team_members (
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      member_role TEXT NOT NULL DEFAULT 'member',
      invited_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS board_votes (
      application_id TEXT NOT NULL REFERENCES applications(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (application_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS board_notes (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
      user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS board_notes_app ON board_notes(application_id, created_at);
    CREATE TABLE IF NOT EXISTS compare_results (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, role_id TEXT, bracket_json TEXT NOT NULL,
      winner_label TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audition_events (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT, title TEXT NOT NULL, actor_name TEXT NOT NULL,
      starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
      note TEXT NOT NULL DEFAULT '', application_id TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audition_events_owner ON audition_events(owner_id, starts_at);
    CREATE TABLE IF NOT EXISTS project_candidates (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      actor_id TEXT NOT NULL REFERENCES users(id), added_by TEXT NOT NULL REFERENCES users(id),
      column_key TEXT NOT NULL DEFAULT 'review', created_at TEXT NOT NULL,
      UNIQUE(project_id, actor_id)
    );
    CREATE TABLE IF NOT EXISTS candidate_votes (
      candidate_id TEXT NOT NULL REFERENCES project_candidates(id),
      user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS candidate_notes (
      id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES project_candidates(id),
      user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS candidate_notes_app ON candidate_notes(candidate_id, created_at);
  `);
  addColumn(database, 'applications', 'chat_open', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(database, 'applications', 'actor_id', 'TEXT');
  addColumn(database, 'roles', 'owner_id', 'TEXT');
  addColumn(database, 'roles', 'project_id', 'TEXT');
  addColumn(database, 'actor_profiles', 'agency', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'actor_profiles', 'documents', "TEXT NOT NULL DEFAULT '[]'");
  addColumn(database, 'audition_events', 'place', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'audition_events', 'meeting_type', "TEXT NOT NULL DEFAULT ''");
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false') {
    seedDemo(database);
    seedAccounts(database);
    seedTeams(database);
    seedDemoActivity(database);
  }
  return database;
}

// 데모가 "살아있는" 느낌이 들도록 최근 시각 기준의 활동 데이터를 보장한다.
// 모든 항목은 고유 키/본문 존재 여부로 중복 삽입을 막아 재시작해도 한 번만 들어간다.
function seedDemoActivity(connection: DatabaseSync) {
  const producer = connection
    .prepare("SELECT id FROM users WHERE email='producer@demo.casting'")
    .get() as { id: string } | undefined;
  if (!producer) return;
  const ownedRoles = connection
    .prepare('SELECT id, title FROM roles WHERE owner_id=? ORDER BY created_at DESC LIMIT 3')
    .all(producer.id) as { id: string; title: string }[];
  if (!ownedRoles.length) return;
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
  const ahead = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  // 방금 도착한 지원서 (제작자 피드 + 지원자 수 증가)
  const freshApps = [
    {
      roleId: ownedRoles[0].id,
      name: '오세훈',
      age: 26,
      email: 'osh.demo@applicant.dev',
      intro: '단편 영화제 수상작에 출연했습니다. 감정선이 섬세한 연기를 보여드릴게요.',
      skill: '감정 연기, 영어',
      minutes: 35,
      avatar: 61,
    },
    {
      roleId: ownedRoles[0].id,
      name: '문가영',
      age: 24,
      email: 'mgy.demo@applicant.dev',
      intro: '뮤지컬 전공이라 노래와 연기 모두 자신 있습니다. 오디션 일정은 언제든 가능해요.',
      skill: '노래, 댄스',
      minutes: 190,
      avatar: 62,
    },
    {
      roleId: (ownedRoles[1] ?? ownedRoles[0]).id,
      name: '배주완',
      age: 29,
      email: 'bjw.demo@applicant.dev',
      intro: '독립 장편 경험이 많고 촬영 일정은 전부 비어 있습니다.',
      skill: '액션, 운전',
      minutes: 1500,
      avatar: 63,
    },
  ];
  const insertApp = connection.prepare(
    `INSERT OR IGNORE INTO applications
    (id,role_id,actor_id,name,age,email,phone,introduction,photo_url,video_url,available,travel,pay_accepted,skill,receipt_token,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const item of freshApps) {
    const at = ago(item.minutes);
    insertApp.run(
      randomUUID(),
      item.roleId,
      null,
      item.name,
      item.age,
      item.email,
      '010-7777-8888',
      item.intro,
      `/avatars/p${String(((item.avatar - 1) % 20) + 1).padStart(2, '0')}.svg`,
      '',
      '전 일정 가능',
      '서울 외 이동 가능',
      'yes',
      item.skill,
      randomBytes(24).toString('hex'),
      at,
      at,
    );
  }

  // 읽지 않은 배우 메시지 (제작자 벨 배지)
  const thread = connection
    .prepare(
      `SELECT a.id FROM applications a JOIN roles r ON r.id = a.role_id
       WHERE r.owner_id = ? ORDER BY a.created_at LIMIT 1`,
    )
    .get(producer.id) as { id: string } | undefined;
  if (thread) {
    const marker = '지원서를 검토해 주셔서 감사합니다';
    const exists = connection
      .prepare(
        'SELECT 1 FROM chat_messages WHERE application_id=? AND body LIKE ?',
      )
      .get(thread.id, `%${marker}%`);
    if (!exists) {
      const insertMsg = connection.prepare(
        `INSERT INTO chat_messages (id,application_id,sender,kind,body,slots,place,preparation,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      );
      insertMsg.run(
        randomUUID(),
        thread.id,
        'actor',
        'text',
        '안녕하세요! 지원서를 검토해 주셔서 감사합니다 😊',
        '[]',
        '',
        '',
        ago(40),
      );
      insertMsg.run(
        randomUUID(),
        thread.id,
        'actor',
        'text',
        '필요하시면 추가 포트폴리오 영상도 바로 보내드릴게요!',
        '[]',
        '',
        '',
        ago(22),
      );
    }
  }

  // 배우에게 도착한 새 캐스팅 제안 + 제작자에게 도착한 수락 응답
  const insertProposal = connection.prepare(
    `INSERT OR IGNORE INTO proposals (id,producer_id,actor_id,role_id,message,status,created_at)
    VALUES (?,?,?,?,?,?,?)`,
  );
  const actorByEmail = (email: string) =>
    connection.prepare('SELECT id FROM users WHERE email=?').get(email) as
      | { id: string }
      | undefined;
  const actor01 = actorByEmail('actor01@demo.casting');
  if (actor01 && ownedRoles[0])
    insertProposal.run(
      randomUUID(),
      producer.id,
      actor01.id,
      ownedRoles[0].id,
      '프로필을 보고 배역과 잘 어울리실 것 같아 제안드립니다. 대본 일부를 보내드릴 테니 편하게 확인해 주세요.',
      'sent',
      ago(95),
    );
  const actor02 = actorByEmail('actor02@demo.casting');
  if (actor02 && ownedRoles[1])
    insertProposal.run(
      randomUUID(),
      producer.id,
      actor02.id,
      ownedRoles[1].id,
      '오디션 없이 바로 캐스팅 제안드리고 싶습니다. 일정 확인 부탁드려요.',
      'accepted',
      ago(300),
    );

  // 방금 올라온 새 공고 (배우 맞춤 공고·피드)
  const freshRoles = [
    {
      slug: 'demo-mv-heroine',
      projectTitle: '뮤직비디오 〈여름 밤〉',
      genre: '뮤직비디오',
      title: '여주인공',
      description: '청순한 이미지의 20대 여성 배우를 찾습니다. 노래 장면 위주의 감성 촬영입니다.',
      requirement: '20대 여성, 청순한 이미지, 노래·댄스 가능자 우대',
      location: '서울',
      pay: '회당 30만원',
      shootDate: ahead(14),
      deadline: ahead(10),
    },
    {
      slug: 'demo-indie-lead',
      projectTitle: '독립영화 〈귀가〉',
      genre: '독립영화',
      title: '주연 재민 역',
      description: '따뜻하고 담백한 톤의 생활 연기를 보여줄 20대 남성 주연을 구합니다.',
      requirement: '20대 남성, 자연스러운 대화 연기, 지방 촬영 가능',
      location: '서울',
      pay: '총 250만원',
      shootDate: ahead(20),
      deadline: ahead(12),
    },
  ];
  const insertProject = connection.prepare(
    'INSERT INTO projects (id,owner_id,title,genre,shoot_start,shoot_end,location,created_at) VALUES (?,?,?,?,?,?,?,?)',
  );
  const insertRole = connection.prepare(
    `INSERT INTO roles (id,slug,owner_id,project_id,project_title,title,description,shoot_date,location,pay,deadline,contact_name,announcement_date,requirement,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const item of freshRoles) {
    const existing = connection.prepare('SELECT 1 FROM roles WHERE slug=?').get(item.slug);
    if (existing) continue;
    const projectId = randomUUID();
    insertProject.run(
      projectId,
      producer.id,
      item.projectTitle,
      item.genre,
      item.shootDate,
      item.shootDate,
      item.location,
      ago(60),
    );
    insertRole.run(
      randomUUID(),
      item.slug,
      producer.id,
      projectId,
      item.projectTitle,
      item.title,
      item.description,
      item.shootDate,
      item.location,
      item.pay,
      item.deadline,
      '이지현',
      ahead(30),
      item.requirement,
      ago(60),
    );
  }
}

function addColumn(connection: DatabaseSync, table: string, column: string, definition: string) {
  const columns = connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column))
    connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export { db };

function roleFromRow(row: Record<string, unknown>): Role {
  return {
    id: String(row.id),
    slug: String(row.slug),
    projectTitle: String(row.project_title),
    title: String(row.title),
    description: String(row.description),
    shootDate: String(row.shoot_date),
    location: String(row.location),
    pay: String(row.pay),
    deadline: String(row.deadline),
    contactName: String(row.contact_name),
    announcementDate: String(row.announcement_date),
    requirement: String(row.requirement),
    isClosed: Boolean(row.is_closed),
    createdAt: String(row.created_at),
    applicationCount: Number(row.application_count || 0),
    newCount: Number(row.new_count || 0),
    shortlistCount: Number(row.shortlist_count || 0),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    projectId: row.project_id ? String(row.project_id) : null,
  };
}

function appFromRow(row: Record<string, unknown>): Application {
  return {
    id: String(row.id),
    roleId: String(row.role_id),
    name: String(row.name),
    age: row.age === null ? null : Number(row.age),
    email: String(row.email),
    phone: String(row.phone),
    introduction: String(row.introduction),
    photoUrl: String(row.photo_url),
    videoUrl: String(row.video_url),
    available: String(row.available),
    travel: String(row.travel),
    payAccepted: String(row.pay_accepted),
    skill: String(row.skill),
    note: String(row.note),
    status: row.status as ReviewStatus,
    shortlist: Boolean(row.shortlist),
    chatOpen: Boolean(row.chat_open),
    publicStage: row.public_stage as PublicStage,
    receiptToken: String(row.receipt_token),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.role_title !== undefined ? { roleTitle: String(row.role_title) } : {}),
    ...(row.project_title !== undefined ? { projectTitle: String(row.project_title) } : {}),
    ...(row.last_body !== undefined && row.last_body !== null
      ? {
          lastMessage: String(row.last_body),
          lastMessageAt: String(row.last_at),
          lastMessageSender: row.last_sender as ChatMessage['sender'],
        }
      : {}),
    ...(row.unread !== undefined ? { unreadCount: Number(row.unread) } : {}),
    offerStatus:
      row.offer_status === undefined || row.offer_status === null
        ? null
        : (row.offer_status as ChatMessage['status']),
    ...(row.confirmed_slot !== undefined && row.confirmed_slot !== null
      ? { confirmedSlot: String(row.confirmed_slot) }
      : {}),
  };
}

const CHAT_SUMMARY = `
  (SELECT m.body FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_body,
  (SELECT m.created_at FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_at,
  (SELECT m.sender FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_sender,
  (SELECT COUNT(*) FROM chat_messages m WHERE m.application_id=applications.id AND m.sender='actor'
    AND m.created_at > COALESCE((SELECT MAX(p.created_at) FROM chat_messages p WHERE p.application_id=applications.id AND p.sender='producer'),'')) unread,
  (SELECT m.status FROM chat_messages m WHERE m.application_id=applications.id AND m.kind='offer' ORDER BY m.created_at DESC LIMIT 1) offer_status,
  (SELECT m.selected_slot FROM chat_messages m WHERE m.application_id=applications.id AND m.kind='offer' AND m.status='confirmed' ORDER BY m.created_at DESC LIMIT 1) confirmed_slot`;

const ROLE_STATS = `SELECT roles.*, COUNT(applications.id) application_count,
      SUM(CASE WHEN applications.status='new' THEN 1 ELSE 0 END) new_count,
      COALESCE(SUM(applications.shortlist),0) shortlist_count
      FROM roles
    LEFT JOIN applications ON applications.role_id=roles.id`;

export function listRoles(ownerId: string) {
  return db()
    .prepare(
      `${ROLE_STATS} WHERE roles.owner_id=? GROUP BY roles.id ORDER BY roles.created_at DESC`,
    )
    .all(ownerId)
    .map((row) => roleFromRow(row as Record<string, unknown>));
}

export function listOpenRoles(today: string) {
  return db()
    .prepare(
      `${ROLE_STATS} WHERE roles.is_closed=0 AND roles.deadline>=? GROUP BY roles.id ORDER BY roles.created_at DESC`,
    )
    .all(today)
    .map((row) => roleFromRow(row as Record<string, unknown>));
}

export function getRole(slug: string) {
  const row = db()
    .prepare(
      `SELECT roles.*, COUNT(applications.id) application_count,
      SUM(CASE WHEN applications.status='new' THEN 1 ELSE 0 END) new_count,
      COALESCE(SUM(applications.shortlist),0) shortlist_count
      FROM roles
    LEFT JOIN applications ON applications.role_id=roles.id WHERE roles.slug=? GROUP BY roles.id`,
    )
    .get(slug);
  return row ? roleFromRow(row as Record<string, unknown>) : null;
}

export function getRoleById(id: string) {
  const row = db().prepare('SELECT * FROM roles WHERE id=?').get(id);
  return row ? roleFromRow(row as Record<string, unknown>) : null;
}

export type NewRole = Pick<
  Role,
  | 'projectTitle'
  | 'title'
  | 'description'
  | 'shootDate'
  | 'location'
  | 'pay'
  | 'deadline'
  | 'contactName'
  | 'announcementDate'
  | 'requirement'
>;

export function createRole(input: NewRole, ownerId: string | null, projectId: string | null) {
  const id = randomUUID();
  const slug = randomBytes(8).toString('hex');
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO roles (id,slug,owner_id,project_id,project_title,title,description,shoot_date,location,pay,deadline,contact_name,announcement_date,requirement,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      slug,
      ownerId,
      projectId,
      input.projectTitle,
      input.title,
      input.description,
      input.shootDate,
      input.location,
      input.pay,
      input.deadline,
      input.contactName,
      input.announcementDate,
      input.requirement,
      now,
    );
  recordEvent(id, null, 'role_published');
  return getRole(slug)!;
}

export function updateRole(id: string, input: Partial<Role>) {
  const current = getRoleById(id);
  if (!current) return null;
  db()
    .prepare(
      `UPDATE roles SET project_title=?,title=?,description=?,shoot_date=?,location=?,pay=?,deadline=?,contact_name=?,announcement_date=?,requirement=?,is_closed=? WHERE id=?`,
    )
    .run(
      input.projectTitle ?? current.projectTitle,
      input.title ?? current.title,
      input.description ?? current.description,
      input.shootDate ?? current.shootDate,
      input.location ?? current.location,
      input.pay ?? current.pay,
      input.deadline ?? current.deadline,
      input.contactName ?? current.contactName,
      input.announcementDate ?? current.announcementDate,
      input.requirement ?? current.requirement,
      Number(input.isClosed ?? current.isClosed),
      id,
    );
  return getRole(current.slug);
}

export function listApplications(roleId: string) {
  return db()
    .prepare(
      `SELECT applications.*, ${CHAT_SUMMARY} FROM applications WHERE role_id=? ORDER BY created_at DESC`,
    )
    .all(roleId)
    .map((row) => appFromRow(row as Record<string, unknown>));
}

export function listRecentApplications(ownerId: string, limit = 8) {
  return db()
    .prepare(
      `SELECT applications.*, roles.title role_title, roles.project_title, ${CHAT_SUMMARY}
      FROM applications JOIN roles ON roles.id=applications.role_id
      WHERE roles.owner_id=?
      ORDER BY applications.created_at DESC LIMIT ?`,
    )
    .all(ownerId, limit)
    .map((row) => appFromRow(row as Record<string, unknown>));
}

export function listActorApplications(actorId: string) {
  return db()
    .prepare(
      `SELECT applications.*, roles.title role_title, roles.project_title
      FROM applications JOIN roles ON roles.id=applications.role_id
      WHERE applications.actor_id=? ORDER BY applications.created_at DESC`,
    )
    .all(actorId)
    .map((row) => appFromRow(row as Record<string, unknown>));
}

export function roleOwnedBy(roleId: string, ownerId: string) {
  return Boolean(
    db().prepare('SELECT 1 FROM roles WHERE id=? AND owner_id=?').get(roleId, ownerId),
  );
}

export function applicationOwnedBy(applicationId: string, ownerId: string) {
  return Boolean(
    db()
      .prepare(
        'SELECT 1 FROM applications a JOIN roles r ON r.id=a.role_id WHERE a.id=? AND r.owner_id=?',
      )
      .get(applicationId, ownerId),
  );
}

export function listUpcomingAuditions(ownerId: string, now: string): Audition[] {
  return db()
    .prepare(
      `SELECT m.selected_slot slot, m.place, a.id application_id, a.name, a.photo_url,
      r.id role_id, r.title role_title, r.project_title
      FROM chat_messages m
      JOIN applications a ON a.id=m.application_id
      JOIN roles r ON r.id=a.role_id
      WHERE r.owner_id=? AND m.kind='offer' AND m.status='confirmed' AND m.selected_slot >= ?
      ORDER BY m.selected_slot ASC`,
    )
    .all(ownerId, now)
    .map((row) => ({
      applicationId: String((row as Record<string, unknown>).application_id),
      roleId: String((row as Record<string, unknown>).role_id),
      name: String((row as Record<string, unknown>).name),
      photoUrl: String((row as Record<string, unknown>).photo_url),
      roleTitle: String((row as Record<string, unknown>).role_title),
      projectTitle: String((row as Record<string, unknown>).project_title),
      slot: String((row as Record<string, unknown>).slot),
      place: String((row as Record<string, unknown>).place),
    }));
}

export function getApplication(id: string) {
  const row = db().prepare('SELECT * FROM applications WHERE id=?').get(id);
  return row ? appFromRow(row as Record<string, unknown>) : null;
}

export function getApplicationByReceipt(token: string) {
  const row = db().prepare('SELECT * FROM applications WHERE receipt_token=?').get(token);
  return row ? appFromRow(row as Record<string, unknown>) : null;
}

export type NewApplication = Pick<
  Application,
  | 'name'
  | 'age'
  | 'email'
  | 'phone'
  | 'introduction'
  | 'photoUrl'
  | 'videoUrl'
  | 'available'
  | 'travel'
  | 'payAccepted'
  | 'skill'
>;

export function createApplication(
  roleId: string,
  input: NewApplication,
  actorId: string | null = null,
) {
  const id = randomUUID();
  const receipt = randomBytes(24).toString('hex');
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO applications (id,role_id,actor_id,name,age,email,phone,introduction,photo_url,video_url,available,travel,pay_accepted,skill,receipt_token,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      roleId,
      actorId,
      input.name,
      input.age,
      input.email.toLowerCase(),
      input.phone,
      input.introduction,
      input.photoUrl,
      input.videoUrl,
      input.available,
      input.travel,
      input.payAccepted,
      input.skill,
      receipt,
      now,
      now,
    );
  recordEvent(roleId, id, 'application_submitted');
  return getApplication(id)!;
}

export function reviewApplication(
  id: string,
  input: { status?: ReviewStatus; note?: string; shortlist?: boolean; publicStage?: PublicStage },
) {
  const current = getApplication(id);
  if (!current) return null;
  const now = new Date().toISOString();
  db()
    .prepare(
      'UPDATE applications SET status=?,note=?,shortlist=?,public_stage=?,updated_at=? WHERE id=?',
    )
    .run(
      input.status ?? current.status,
      input.note ?? current.note,
      Number(input.shortlist ?? current.shortlist),
      input.publicStage ?? current.publicStage,
      now,
      id,
    );
  if (input.status && input.status !== current.status)
    recordEvent(current.roleId, id, 'review_status_changed');
  if (input.shortlist !== undefined && input.shortlist !== current.shortlist)
    recordEvent(current.roleId, id, 'shortlist_changed');
  if (input.publicStage && input.publicStage !== current.publicStage)
    recordEvent(current.roleId, id, 'public_result_confirmed');
  return getApplication(id)!;
}

export function recordEvent(roleId: string, applicationId: string | null, name: string) {
  db()
    .prepare('INSERT INTO events (id,role_id,application_id,name,created_at) VALUES (?,?,?,?,?)')
    .run(randomUUID(), roleId, applicationId, name, new Date().toISOString());
}

function messageFromRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    sender: row.sender as ChatMessage['sender'],
    kind: row.kind as ChatMessage['kind'],
    body: String(row.body),
    slots: JSON.parse(String(row.slots)) as string[],
    place: String(row.place),
    preparation: String(row.preparation),
    selectedSlot: String(row.selected_slot),
    status: row.status as ChatMessage['status'],
    createdAt: String(row.created_at),
  };
}

export function getLatestOffer(applicationId: string) {
  const row = db()
    .prepare(
      "SELECT * FROM chat_messages WHERE application_id=? AND kind='offer' ORDER BY created_at DESC LIMIT 1",
    )
    .get(applicationId);
  return row ? messageFromRow(row as Record<string, unknown>) : null;
}

export function listChatMessages(applicationId: string) {
  return db()
    .prepare('SELECT * FROM chat_messages WHERE application_id=? ORDER BY created_at ASC')
    .all(applicationId)
    .map((row) => messageFromRow(row as Record<string, unknown>));
}

export function getChatMessage(id: string) {
  const row = db().prepare('SELECT * FROM chat_messages WHERE id=?').get(id);
  return row ? messageFromRow(row as Record<string, unknown>) : null;
}

export function sendChatMessage(
  applicationId: string,
  input: Pick<ChatMessage, 'sender' | 'kind' | 'body' | 'slots' | 'place' | 'preparation'>,
) {
  const application = getApplication(applicationId);
  if (!application) return null;
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO chat_messages (id,application_id,sender,kind,body,slots,place,preparation,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      applicationId,
      input.sender,
      input.kind,
      input.body,
      JSON.stringify(input.slots),
      input.place,
      input.preparation,
      new Date().toISOString(),
    );
  if (input.sender === 'producer')
    db().prepare('UPDATE applications SET chat_open=1 WHERE id=?').run(applicationId);
  recordEvent(
    application.roleId,
    applicationId,
    input.kind === 'offer' ? 'audition_offer_sent' : 'chat_message_sent',
  );
  return getChatMessage(id)!;
}

export function respondToOffer(
  messageId: string,
  action: 'select' | 'decline' | 'request_change' | 'confirm',
  selectedSlot = '',
) {
  const message = getChatMessage(messageId);
  if (!message || message.kind !== 'offer') return null;
  if (action === 'select' && message.status === 'sent' && message.slots.includes(selectedSlot)) {
    db()
      .prepare("UPDATE chat_messages SET status='selected',selected_slot=? WHERE id=?")
      .run(selectedSlot, messageId);
  } else if (action === 'decline' && message.status === 'sent') {
    db().prepare("UPDATE chat_messages SET status='declined' WHERE id=?").run(messageId);
  } else if (action === 'request_change' && message.status === 'sent') {
    db().prepare("UPDATE chat_messages SET status='change_requested' WHERE id=?").run(messageId);
  } else if (action === 'confirm' && message.status === 'selected') {
    db().prepare("UPDATE chat_messages SET status='confirmed' WHERE id=?").run(messageId);
  } else return null;
  const application = getApplication(message.applicationId)!;
  recordEvent(application.roleId, application.id, `audition_offer_${action}`);
  return getChatMessage(messageId)!;
}

function seedDemo(connection: DatabaseSync) {
  const count = connection.prepare('SELECT COUNT(*) count FROM roles').get() as { count: number };
  if (count.count) return;
  const kstDateIn = (days: number) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.now() + days * 86_400_000));
  const shootDate = kstDateIn(13);
  const role = createRole(
    {
      projectTitle: '단편영화 〈봄날〉 · 샘플',
      title: '민수 역',
      description:
        '오랜 친구와 다시 만나는 장면이 중심인 20대 남성 배역입니다. 자연스러운 대화 연기 경험을 보고 싶습니다.',
      shootDate,
      location: '서울 마포구',
      pay: '1일 15만 원 · 교통비 별도',
      deadline: kstDateIn(10),
      contactName: '제작팀',
      announcementDate: kstDateIn(11),
      requirement: `${Number(shootDate.slice(5, 7))}월 ${Number(shootDate.slice(8, 10))}일 촬영 가능, 서울 이동 가능, 출연료 조건 확인`,
    },
    null,
    null,
  );
  const examples = [
    ['김도윤', 26, '단편 3편, 독립영화 주연 경험', 'yes', 'new', 12],
    ['박서연', 24, '독립영화 2편, 웹드라마 조연', 'yes', 'reviewing', 47],
    ['이준호', 25, '단편 4편, 연극 무대 경험', 'unsure', 'interested', 59],
    ['정하은', 23, '독립영화 조연, 연극 1편', 'yes', 'new', 44],
    ['윤태오', 27, '단편 2편, 광고 다수 출연', 'yes', 'hold', 33],
    ['한지민', 24, '웹드라마 주연, 단편 1편', 'unsure', 'new', 25],
  ] as const;
  for (const [name, age, introduction, available, status, photo] of examples) {
    const application = createApplication(role.id, {
      name,
      age,
      email: `${randomBytes(4).toString('hex')}@example.com`,
      phone: '010-0000-0000',
      introduction,
      photoUrl: `/avatars/p${String(((photo - 1) % 20) + 1).padStart(2, '0')}.svg`,
      videoUrl: 'https://example.com/showreel',
      available,
      travel: 'yes',
      payAccepted: 'yes',
      skill: '자연스러운 대화 연기',
    });
    if (status !== 'new') reviewApplication(application.id, { status });
  }
}

const DEMO_PASSWORD = 'demo1234';

function seedAccounts(connection: DatabaseSync) {
  const count = connection.prepare('SELECT COUNT(*) count FROM users').get() as { count: number };
  if (count.count) return;
  const now = new Date().toISOString();
  const producerId = randomUUID();
  connection
    .prepare(
      `INSERT INTO users (id,email,password_hash,role,name,phone,org_type,org_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      producerId,
      'producer@demo.casting',
      hashPassword(DEMO_PASSWORD),
      'producer',
      '이지현',
      '010-1234-5678',
      '학생 제작팀',
      '한빛대 영화과 졸업작품팀',
      now,
    );
  const orphans = connection
    .prepare(
      'SELECT DISTINCT project_title, location, shoot_date FROM roles WHERE owner_id IS NULL',
    )
    .all() as { project_title: string; location: string; shoot_date: string }[];
  for (const orphan of orphans) {
    const projectId = randomUUID();
    connection
      .prepare(
        `INSERT INTO projects (id,owner_id,title,genre,shoot_start,shoot_end,location,created_at)
        VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        projectId,
        producerId,
        orphan.project_title,
        '단편영화',
        orphan.shoot_date,
        orphan.shoot_date,
        orphan.location,
        now,
      );
    connection
      .prepare(
        'UPDATE roles SET owner_id=?, project_id=? WHERE owner_id IS NULL AND project_title=?',
      )
      .run(producerId, projectId, orphan.project_title);
  }
  const actors: [string, string, number, number, string, string[], string[], number[], string][] = [
    [
      '김도윤',
      'male',
      1999,
      181,
      '서울',
      ['소년미', '따뜻한', '차분한'],
      ['자연스러운 대화 연기', '영어'],
      [12, 13, 14],
      '단편영화 3편 주연. 담백한 감정 연기를 좋아합니다.',
    ],
    [
      '박서연',
      'female',
      2001,
      165,
      '서울',
      ['청순한', '사랑스러운'],
      ['노래', '댄스'],
      [47, 45, 44],
      '웹드라마 조연 2편, 뮤지컬 앙상블 경험이 있습니다.',
    ],
    [
      '이준호',
      'male',
      2000,
      178,
      '경기',
      ['시크한', '카리스마', '도시적인'],
      ['액션', '무술', '운전'],
      [59, 60, 57],
      '액션스쿨 수료, 독립 장편 조연 출연.',
    ],
    [
      '정하은',
      'female',
      2002,
      162,
      '서울',
      ['유쾌한', '사랑스러운'],
      ['즉흥 연기', '사투리'],
      [44, 43, 41],
      '연극 무대 4편, 코믹한 생활 연기가 강점입니다.',
    ],
    [
      '김서연',
      'female',
      1998,
      168,
      '서울',
      ['지적인', '차분한', '신비로운'],
      ['영어', '일본어'],
      [5, 9, 10],
      '단편영화 〈여름의 끝〉 주연, 광고 다수 출연.',
    ],
    [
      '이지훈',
      'male',
      1997,
      183,
      '서울',
      ['강인한', '카리스마'],
      ['액션', '수영'],
      [33, 32, 31],
      '웹드라마 〈청춘시대〉 조연, 액션 장면 경험 다수.',
    ],
    [
      '한지민',
      'female',
      2000,
      164,
      '인천',
      ['따뜻한', '청순한'],
      ['자연스러운 대화 연기', '악기 연주'],
      [25, 26, 24],
      '독립영화 2편, 피아노 연주가 가능합니다.',
    ],
    [
      '최민재',
      'male',
      2003,
      175,
      '경기',
      ['소년미', '유쾌한'],
      ['댄스', '즉흥 연기'],
      [51, 52, 53],
      '연기 전공 재학 중, 숏폼 콘텐츠 출연 다수.',
    ],
    [
      '윤태오',
      'male',
      1996,
      180,
      '부산',
      ['도시적인', '시크한'],
      ['사투리', '운전'],
      [15, 17, 18],
      '부산 사투리 가능, 단편 5편 출연.',
    ],
    [
      '오수아',
      'female',
      2004,
      160,
      '서울',
      ['사랑스러운', '청순한'],
      ['노래'],
      [16, 20, 23],
      '연기학원 수강생, 첫 작품을 찾고 있습니다.',
    ],
    [
      '강해린',
      'female',
      1999,
      170,
      '서울',
      ['시크한', '도시적인', '카리스마'],
      ['영어', '댄스'],
      [29, 32, 36],
      '모델 활동 3년, 광고·뮤직비디오 출연.',
    ],
    [
      '임도현',
      'male',
      1995,
      177,
      '대전',
      ['지적인', '차분한'],
      ['자연스러운 대화 연기'],
      [7, 8, 11],
      '연극 10년차, 독립 장편 주연 1편.',
    ],
    [
      '서예린',
      'female',
      2001,
      166,
      '경기',
      ['신비로운', '차분한'],
      ['일본어', '악기 연주'],
      [38, 39, 48],
      '단편영화 2편, 일본어 원어민 수준.',
    ],
    [
      '배준서',
      'male',
      2002,
      179,
      '서울',
      ['따뜻한', '소년미'],
      ['수영', '노래'],
      [54, 55, 56],
      '웹드라마 단역, 수영 강사 자격 보유.',
    ],
    [
      '문가은',
      'female',
      1997,
      163,
      '광주',
      ['따뜻한', '지적인'],
      ['사투리', '즉흥 연기'],
      [49, 1, 31],
      '전라도 사투리 가능, 연극 6편.',
    ],
    [
      '조현우',
      'male',
      1998,
      185,
      '서울',
      ['강인한', '도시적인'],
      ['무술', '액션', '운전'],
      [3, 4, 58],
      '무술 유단자, 액션 단편 3편.',
    ],
  ];
  actors.forEach(
    ([name, gender, birthYear, height, region, tags, skills, photos, intro], index) => {
      const userId = randomUUID();
      const number = String(index + 1).padStart(2, '0');
      connection
        .prepare(
          `INSERT INTO users (id,email,password_hash,role,name,phone,created_at) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          userId,
          `actor${number}@demo.casting`,
          hashPassword(DEMO_PASSWORD),
          'actor',
          name,
          '010-0000-0000',
          now,
        );
      connection
        .prepare(
          `INSERT INTO actor_profiles (user_id,gender,birth_year,height,weight,region,intro,tags,skills,photos,video_url,filmography,unavailable_dates,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          userId,
          gender,
          birthYear,
          height,
          gender === 'male' ? 70 : 50,
          region,
          intro,
          JSON.stringify(tags),
          JSON.stringify(skills),
          JSON.stringify(
            photos.map(
              (photo) => `/avatars/p${String(((photo - 1) % 20) + 1).padStart(2, '0')}.svg`,
            ),
          ),
          'https://www.youtube.com/watch?v=ScMzIvxBSi4',
          JSON.stringify([
            {
              year: '2025',
              title: `단편영화 〈${['봄의 끝', '파도', '새벽'][index % 3]}〉`,
              role: '주연',
            },
            {
              year: '2024',
              title: `웹드라마 〈${['청춘시대', '우리의 계절', '오후 세시'][index % 3]}〉`,
              role: '조연',
            },
          ]),
          JSON.stringify(index % 4 === 0 ? ['2026-10-26'] : []),
          now,
        );
    },
  );
}

function seedTeams(connection: DatabaseSync) {
  const seeded = connection.prepare('SELECT COUNT(*) count FROM team_members').get() as {
    count: number;
  };
  if (seeded.count) return;
  const producer = connection
    .prepare("SELECT id FROM users WHERE email='producer@demo.casting'")
    .get() as { id: string } | undefined;
  if (!producer) return;
  const producerId = producer.id;
  const now = new Date().toISOString();
  const ownedProjects = connection
    .prepare('SELECT id, title FROM projects WHERE owner_id=?')
    .all(producerId) as { id: string; title: string }[];
  for (const project of ownedProjects) {
    connection
      .prepare(
        'INSERT OR IGNORE INTO team_members (project_id,user_id,member_role,invited_at) VALUES (?,?,?,?)',
      )
      .run(project.id, producerId, 'owner', now);
  }
  const directorId = randomUUID();
  connection
    .prepare(
      `INSERT OR IGNORE INTO users (id,email,password_hash,role,name,phone,org_type,org_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      directorId,
      'director@demo.casting',
      hashPassword(DEMO_PASSWORD),
      'producer',
      '김감독',
      '010-7777-8888',
      '프리랜서',
      '김감독 스튜디오',
      now,
    );
  const director = connection
    .prepare("SELECT id FROM users WHERE email='director@demo.casting'")
    .get() as { id: string };
  const firstProject = ownedProjects[0];
  if (firstProject) {
    connection
      .prepare(
        'INSERT OR IGNORE INTO team_members (project_id,user_id,member_role,invited_at) VALUES (?,?,?,?)',
      )
      .run(firstProject.id, director.id, 'member', now);
    const sampleApps = connection
      .prepare(
        `SELECT a.id FROM applications a JOIN roles r ON a.role_id=r.id
         WHERE r.project_id=? ORDER BY a.created_at LIMIT 3`,
      )
      .all(firstProject.id) as { id: string }[];
    const [appA, appB, appC] = sampleApps;
    if (appA) {
      connection
        .prepare(
          'INSERT OR IGNORE INTO board_votes (application_id,user_id,created_at) VALUES (?,?,?)',
        )
        .run(appA.id, producerId, now);
      connection
        .prepare(
          'INSERT OR IGNORE INTO board_votes (application_id,user_id,created_at) VALUES (?,?,?)',
        )
        .run(appA.id, director.id, now);
      connection
        .prepare(
          'INSERT INTO board_notes (id,application_id,user_id,body,created_at) VALUES (?,?,?,?,?)',
        )
        .run(randomUUID(), appA.id, director.id, '첫인상이 배역 이미지와 잘 맞아요.', now);
    }
    if (appB) {
      connection
        .prepare(
          'INSERT OR IGNORE INTO board_votes (application_id,user_id,created_at) VALUES (?,?,?)',
        )
        .run(appB.id, producerId, now);
    }
    if (appC) {
      connection
        .prepare(
          'INSERT INTO board_notes (id,application_id,user_id,body,created_at) VALUES (?,?,?,?,?)',
        )
        .run(randomUUID(), appC.id, producerId, '연기 영상 확인 후 다시 얘기해요.', now);
    }
  }
}

export type ReviewStatus = 'new' | 'reviewing' | 'hold' | 'interested' | 'excluded';
export type PublicStage = 'received' | 'audition' | 'not_selected' | 'cast';

/** 배역 비중. 빈 값은 미지정. */
export type RoleType = 'lead' | 'supporting' | 'minor' | 'extra' | '';
/** 배역 성별 조건. any는 무관, 빈 값은 미지정. */
export type RoleGender = 'male' | 'female' | 'any' | '';
/** 배역 촬영일 정하는 방식. all = 작품 촬영 일정 일괄 적용(기본), custom = 이 배역만 따로 지정. */
export type ShootMode = 'all' | 'custom';

export type Role = {
  id: string;
  slug: string;
  projectTitle: string;
  title: string;
  description: string;
  /** 첫 촬영일. 예전 화면·추천과의 호환을 위해 shootDates의 첫날로 계속 채운다. */
  shootDate: string;
  /** 이 배역의 실제 촬영일 목록(YYYY-MM-DD). all이면 저장할 때 작품 촬영 기간을 날짜로 펼쳐 둔다. */
  shootDates: string[];
  shootMode: ShootMode;
  roleType: RoleType;
  gender: RoleGender;
  /** 연령대. 0이면 제한 없음. */
  ageMin: number;
  ageMax: number;
  /** 모집 인원 */
  headcount: number;
  location: string;
  pay: string;
  deadline: string;
  contactName: string;
  announcementDate: string;
  requirement: string;
  isClosed: boolean;
  createdAt: string;
  applicationCount?: number;
  newCount?: number;
  shortlistCount?: number;
  ownerId?: string | null;
  projectId?: string | null;
};

export type Application = {
  id: string;
  roleId: string;
  /** 로그인하고 지원했거나 나중에 계정에 연결된 경우의 배우 id (비로그인 지원은 null) */
  actorId: string | null;
  name: string;
  age: number | null;
  email: string;
  phone: string;
  introduction: string;
  /** 대표 사진 (photoUrls의 첫 장) */
  photoUrl: string;
  /** 이 공고에 내려고 고른 사진 전부 */
  photoUrls: string[];
  videoUrl: string;
  available: string;
  travel: string;
  payAccepted: string;
  skill: string;
  note: string;
  status: ReviewStatus;
  shortlist: boolean;
  chatOpen: boolean;
  publicStage: PublicStage;
  receiptToken: string;
  createdAt: string;
  updatedAt: string;
  roleTitle?: string;
  projectTitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSender?: ChatMessage['sender'];
  unreadCount?: number;
  offerStatus?: ChatMessage['status'] | null;
  confirmedSlot?: string;
};

export type Audition = {
  applicationId: string;
  roleId: string;
  name: string;
  photoUrl: string;
  roleTitle: string;
  projectTitle: string;
  slot: string;
  place: string;
};

export type ChatMessage = {
  id: string;
  applicationId: string;
  sender: 'producer' | 'actor';
  kind: 'text' | 'offer';
  body: string;
  slots: string[];
  place: string;
  preparation: string;
  selectedSlot: string;
  status: 'sent' | 'selected' | 'confirmed' | 'declined' | 'change_requested';
  createdAt: string;
};

export const reviewLabels: Record<ReviewStatus, string> = {
  new: '신규',
  reviewing: '검토 중',
  hold: '보류',
  interested: '관심 있음',
  excluded: '제외',
};

export const publicLabels: Record<PublicStage, string> = {
  received: '접수 완료',
  audition: '오디션 대상',
  not_selected: '미선정',
  cast: '캐스팅 확정',
};

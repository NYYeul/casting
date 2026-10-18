export type ReviewStatus = 'new' | 'reviewing' | 'hold' | 'interested' | 'excluded';
export type PublicStage = 'received' | 'audition' | 'not_selected' | 'cast';

export type Role = {
  id: string;
  slug: string;
  projectTitle: string;
  title: string;
  description: string;
  shootDate: string;
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
  name: string;
  age: number | null;
  email: string;
  phone: string;
  introduction: string;
  photoUrl: string;
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

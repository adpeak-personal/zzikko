export type UserRole = "BUYER" | "SELLER" | "ADMIN" | "SUB_ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BANNED" | "DELETED";

export interface Member {
  id: number;
  email: string | null;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface MemberListResponse {
  items: Member[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateMemberInput {
  id: number;
  role?: UserRole;
  status?: UserStatus;
}

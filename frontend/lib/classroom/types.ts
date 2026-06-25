export type ClassRoom = {
  id: number;
  teacher_user_id: number;
  name: string;
  entry_code: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type ClassMember = {
  membership_id: number;
  user_id: number;
  login_id: string | null;
  name: string | null;
  nickname: string | null;
  joined_at: string;
  is_active: boolean;
};

export type ClassRoomDetail = ClassRoom & {
  members: ClassMember[];
};

export type ClassRoomListResponse = {
  items: ClassRoom[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

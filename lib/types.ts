export type RoomStatus = 'lobby' | 'night' | 'day';
export type PlayerRole = 'wolf' | 'seer' | 'villager';

export interface Room {
  id: string;
  room_code: string;
  status: RoomStatus;
  host_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  role: PlayerRole | null;
  is_alive: boolean;
  joined_at: string;
}

export interface Action {
  id: string;
  room_id: string;
  player_id: string;
  target_id: string | null;
  action_type: string;
  round_number: number;
  created_at: string;
}

export type RoomStatus = 'lobby' | 'night' | 'day' | 'hunter_revenge';
export type PlayerRole = 'wolf' | 'seer' | 'villager' | 'bodyguard' | 'alpha_wolf' | 'witch' | 'hunter' | 'cult_leader';

export interface Room {
  id: string;
  room_code: string;
  status: RoomStatus;
  host_id: string | null;
  current_night_turn: string | null;
  turn_ends_at: string | null;
  selected_roles: Record<string, number> | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  role: PlayerRole | null;
  is_alive: boolean;
  potion_heal_used: boolean;
  potion_poison_used: boolean;
  alpha_infection_used: boolean;
  is_cult_member: boolean;
  last_protected_id: string | null;
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

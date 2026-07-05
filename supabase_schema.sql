-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'lobby',
  host_id UUID,
  current_night_turn VARCHAR(20),
  turn_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(20),
  is_alive BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create actions table
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  target_id UUID REFERENCES players(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  round_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
-- We will allow public access for this game since players join via room codes without authenticating.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to rooms" ON rooms FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to rooms" ON rooms FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to rooms" ON rooms FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous read access to players" ON players FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to players" ON players FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to players" ON players FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous read access to actions" ON actions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to actions" ON actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to actions" ON actions FOR DELETE TO anon USING (true);

-- Enable Supabase Realtime on these tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE actions;

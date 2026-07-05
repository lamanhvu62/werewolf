"use server";

import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(formData: FormData) {
  const playerName = formData.get("playerName") as string;
  if (!playerName) throw new Error("Player name is required");

  const roomCode = generateRoomCode();

  // 1. Create Room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert([{ room_code: roomCode, status: "lobby" }])
    .select()
    .single();

  if (roomError || !room) {
    throw new Error("Failed to create room: " + (roomError?.message || "Unknown error"));
  }

  // 2. Create Player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert([
      {
        room_id: room.id,
        name: playerName,
        role: null,
      },
    ])
    .select()
    .single();

  if (playerError || !player) {
    throw new Error("Failed to create player: " + (playerError?.message || "Unknown error"));
  }

  // 3. Update Room with Host ID
  await supabase
    .from("rooms")
    .update({ host_id: player.id })
    .eq("id", room.id);

  // Redirect to room
  redirect(`/room/${roomCode}?playerId=${player.id}`);
}

export async function joinRoom(formData: FormData) {
  const playerName = formData.get("playerName") as string;
  const roomCode = (formData.get("roomCode") as string).toUpperCase();

  if (!playerName || !roomCode) {
    throw new Error("Name and Room Code are required");
  }

  // 1. Find Room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (roomError || !room) {
    throw new Error("Room not found");
  }

  if (room.status !== "lobby") {
    throw new Error("Game has already started in this room");
  }

  // 2. Create Player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert([
      {
        room_id: room.id,
        name: playerName,
        role: null,
      },
    ])
    .select()
    .single();

  if (playerError || !player) {
    throw new Error("Failed to join room: " + (playerError?.message || "Unknown error"));
  }

  // Redirect to room
  redirect(`/room/${roomCode}?playerId=${player.id}`);
}

export async function submitAction(roomId: string, playerId: string, targetId: string, actionType: string) {
  const { error } = await supabase
    .from("actions")
    .insert([{
      room_id: roomId,
      player_id: playerId,
      target_id: targetId,
      action_type: actionType
    }]);

  if (error) {
    throw new Error("Failed to submit action: " + error.message);
  }
}

export async function processNightAndStartDay(roomId: string) {
  // 1. Get all night actions for this room
  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select("*")
    .eq("room_id", roomId)
    .eq("action_type", "kill");
    
  if (actionsError) throw new Error(actionsError.message);

  let killedPlayerId = null;
  if (actions && actions.length > 0) {
    const killAction = actions[actions.length - 1];
    killedPlayerId = killAction.target_id;
    
    // Update player to dead
    if (killedPlayerId) {
      await supabase
        .from("players")
        .update({ is_alive: false })
        .eq("id", killedPlayerId);
    }
  }

  // Clear actions to prepare for the day
  await supabase.from("actions").delete().eq("room_id", roomId);

  // 2. Change room status to day
  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "day" })
    .eq("id", roomId);

  if (roomError) throw new Error(roomError.message);
}

export async function processDayAndStartNight(roomId: string) {
  // 1. Get all votes
  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select("*")
    .eq("room_id", roomId)
    .eq("action_type", "vote");

  if (actionsError) throw new Error(actionsError.message);

  if (actions && actions.length > 0) {
    // Tally votes
    const voteCounts: Record<string, number> = {};
    for (const action of actions) {
      if (action.target_id) {
        voteCounts[action.target_id] = (voteCounts[action.target_id] || 0) + 1;
      }
    }

    // Find who has most votes
    let maxVotes = 0;
    let executedPlayerId = null;
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        executedPlayerId = targetId;
      }
    }

    // Execute player
    if (executedPlayerId) {
      await supabase
        .from("players")
        .update({ is_alive: false })
        .eq("id", executedPlayerId);
    }
  }

  // Clear actions
  await supabase.from("actions").delete().eq("room_id", roomId);

  // 2. Change room status back to night
  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "night" })
    .eq("id", roomId);

  if (roomError) throw new Error(roomError.message);
}


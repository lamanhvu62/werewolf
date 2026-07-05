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
      action_type: actionType,
      round_number: 1
    }]);

  if (error) {
    throw new Error("Failed to submit action: " + error.message);
  }
}

export async function getWolfTarget(roomId: string) {
  const { data, error } = await supabase
    .from("actions")
    .select("target_id")
    .eq("room_id", roomId)
    .in("action_type", ["kill", "infect"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.target_id;
}

export async function processNightAndStartDay(roomId: string) {
  // 1. Get all night actions for this room
  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select("*")
    .eq("room_id", roomId);
    
  if (actionsError) throw new Error(actionsError.message);

  let protectedId = null;
  let wolfKillId = null;
  let alphaInfectId = null;
  let healId = null;
  let poisonId = null;
  let convertId = null;
  let alphaWolfId = null;
  let witchId = null;
  let bodyguardId = null;

  if (actions) {
    for (const action of actions) {
      if (action.action_type === "protect") {
         protectedId = action.target_id;
         bodyguardId = action.player_id;
      }
      if (action.action_type === "kill") wolfKillId = action.target_id;
      if (action.action_type === "infect") {
         alphaInfectId = action.target_id;
         alphaWolfId = action.player_id;
      }
      if (action.action_type === "heal") {
         healId = action.target_id;
         witchId = action.player_id;
      }
      if (action.action_type === "poison") {
         poisonId = action.target_id;
         witchId = action.player_id;
      }
      if (action.action_type === "convert") convertId = action.target_id;
    }
  }

  const deadPlayerIds: string[] = [];

  // Resolve Bodyguard
  if (bodyguardId && protectedId) {
    await supabase.from("players").update({ last_protected_id: protectedId }).eq("id", bodyguardId);
  }

  // Resolve Wolf Kill
  if (wolfKillId) {
    if (wolfKillId === protectedId) {
      // Bodyguard blocked the kill!
    } else if (wolfKillId === healId) {
      // Witch healed the kill!
    } else {
      deadPlayerIds.push(wolfKillId);
    }
  }

  // Resolve Alpha Wolf Infection
  if (alphaInfectId && alphaWolfId) {
    if (alphaInfectId !== protectedId) {
      await supabase.from("players").update({ role: "wolf", is_cult_member: false }).eq("id", alphaInfectId);
      await supabase.from("players").update({ alpha_infection_used: true }).eq("id", alphaWolfId);
    }
  }

  // Resolve Witch Poison
  if (poisonId) {
    deadPlayerIds.push(poisonId);
  }

  if (healId && witchId) {
    await supabase.from("players").update({ potion_heal_used: true }).eq("id", witchId);
  }
  if (poisonId && witchId) {
    await supabase.from("players").update({ potion_poison_used: true }).eq("id", witchId);
  }

  // Resolve Cult Leader Convert
  if (convertId) {
    await supabase.from("players").update({ is_cult_member: true }).eq("id", convertId);
  }

  // Check if any of the dead players is a HUNTER
  let hasHunterDied = false;
  if (deadPlayerIds.length > 0) {
    const { data: deadPlayers } = await supabase.from("players").select("id, role").in("id", deadPlayerIds);
    if (deadPlayers) {
      for (const p of deadPlayers) {
        if (p.role === "hunter") {
          hasHunterDied = true;
        } else {
           await supabase.from("players").update({ is_alive: false }).eq("id", p.id);
        }
      }
    }
  }

  // Clear actions
  await supabase.from("actions").delete().eq("room_id", roomId);

  if (hasHunterDied) {
     const turnEndsAt = new Date(Date.now() + 15000).toISOString();
     const { error: roomError } = await supabase
       .from("rooms")
       .update({ 
         status: "hunter_revenge",
         current_night_turn: "hunter_night", // to know where we came from
         turn_ends_at: turnEndsAt
       })
       .eq("id", roomId);
     if (roomError) throw new Error(roomError.message);
  } else {
     const { error: roomError } = await supabase
       .from("rooms")
       .update({ 
         status: "day",
         current_night_turn: null,
         turn_ends_at: null
       })
       .eq("id", roomId);
     if (roomError) throw new Error(roomError.message);
  }
}

export async function processDayAndStartNight(roomId: string) {
  // 1. Get all votes
  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select("*")
    .eq("room_id", roomId)
    .eq("action_type", "vote");

  if (actionsError) throw new Error(actionsError.message);

  let hasHunterDied = false;

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
      const { data: execPlayer } = await supabase.from("players").select("role").eq("id", executedPlayerId).single();
      if (execPlayer?.role === "hunter") {
        hasHunterDied = true;
      } else {
        await supabase
          .from("players")
          .update({ is_alive: false })
          .eq("id", executedPlayerId);
      }
    }
  }

  // Clear actions
  await supabase.from("actions").delete().eq("room_id", roomId);

  if (hasHunterDied) {
     const turnEndsAt = new Date(Date.now() + 15000).toISOString();
     const { error: roomError } = await supabase
       .from("rooms")
       .update({ 
         status: "hunter_revenge",
         current_night_turn: "hunter_day", // came from day
         turn_ends_at: turnEndsAt
       })
       .eq("id", roomId);
     if (roomError) throw new Error(roomError.message);
  } else {
    // 2. Change room status back to night
    const turnEndsAt = new Date(Date.now() + 15000).toISOString();
    const { error: roomError } = await supabase
      .from("rooms")
      .update({ 
        status: "night",
        current_night_turn: "bodyguard",
        turn_ends_at: turnEndsAt
      })
      .eq("id", roomId);

    if (roomError) throw new Error(roomError.message);
  }
}


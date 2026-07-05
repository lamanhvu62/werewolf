import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { PlayerRole } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { roomId, hostId } = await request.json();

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing roomId or hostId" }, { status: 400 });
    }

    // Verify room and host
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.host_id !== hostId) {
      return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
    }

    if (room.status !== "lobby") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }

    // Fetch players
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId);

    if (playersError || !players) {
      return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
    }

    if (players.length < 3) {
      return NextResponse.json({ error: "Need at least 3 players to start" }, { status: 400 });
    }

    // Assign roles randomly
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    
    // MVP Roles: 1 Wolf, 1 Seer, rest Villagers
    const roles: PlayerRole[] = ["wolf", "seer"];
    while (roles.length < shuffledPlayers.length) {
      roles.push("villager");
    }

    // Shuffle roles to distribute them randomly
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);

    // Update players with assigned roles
    const updatePromises = shuffledPlayers.map((player, index) => 
      supabase
        .from("players")
        .update({ role: shuffledRoles[index], is_alive: true })
        .eq("id", player.id)
    );

    await Promise.all(updatePromises);

    // Change room status to night and initialize the night phase engine
    const turnEndsAt = new Date(Date.now() + 15000).toISOString();
    const { error: updateRoomError } = await supabase
      .from("rooms")
      .update({ 
        status: "night",
        current_night_turn: "wolf",
        turn_ends_at: turnEndsAt
      })
      .eq("id", roomId);

    if (updateRoomError) {
      return NextResponse.json({ error: "Failed to update room status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

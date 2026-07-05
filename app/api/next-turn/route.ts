import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processNightAndStartDay } from "@/app/actions";

const TURN_SEQUENCE = ["bodyguard", "wolf", "witch", "cult_leader", "seer"];

export async function POST(request: Request) {
  try {
    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    // Get room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "night") {
      return NextResponse.json({ error: "Not in night phase" }, { status: 400 });
    }

    const currentTurn = room.current_night_turn;
    const currentIndex = TURN_SEQUENCE.indexOf(currentTurn || "");

    const nextIndex = currentIndex + 1;

    if (nextIndex >= TURN_SEQUENCE.length) {
      // End of night, process night actions and start day
      await processNightAndStartDay(roomId);
      return NextResponse.json({ success: true, nextTurn: null });
    }

    // Move to next turn
    const nextTurn = TURN_SEQUENCE[nextIndex];

    // Check if the next role is alive and present
    let query = supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_alive", true);
      
    if (nextTurn === "wolf") {
      query = query.in("role", ["wolf", "alpha_wolf"]);
    } else {
      query = query.eq("role", nextTurn);
    }
    
    const { data: players, error: playersError } = await query;

    let nextTurnDuration = 15000; // 15 seconds by default
    
    // Fake Turn Logic
    if (playersError || !players || players.length === 0) {
      // Random fake turn time between 5s and 15s
      nextTurnDuration = Math.floor(Math.random() * 10000) + 5000;
    }

    const turnEndsAt = new Date(Date.now() + nextTurnDuration).toISOString();

    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        current_night_turn: nextTurn,
        turn_ends_at: turnEndsAt
      })
      .eq("id", roomId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update turn" }, { status: 500 });
    }

    return NextResponse.json({ success: true, nextTurn, turnEndsAt });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

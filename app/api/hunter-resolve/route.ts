import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "hunter_revenge") {
      return NextResponse.json({ error: "Not in hunter_revenge phase" }, { status: 400 });
    }

    // Get hunter's shoot action
    const { data: actions } = await supabase
      .from("actions")
      .select("*")
      .eq("room_id", roomId)
      .eq("action_type", "shoot");

    const deadPlayerIds: string[] = [];

    // Identify hunter
    const { data: hunter } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", roomId)
      .eq("role", "hunter")
      .single();

    if (hunter) deadPlayerIds.push(hunter.id);

    if (actions && actions.length > 0) {
      const shootAction = actions[actions.length - 1];
      if (shootAction.target_id) deadPlayerIds.push(shootAction.target_id);
    }

    // Process deaths
    if (deadPlayerIds.length > 0) {
      await supabase.from("players").update({ is_alive: false }).in("id", deadPlayerIds);
    }

    await supabase.from("actions").delete().eq("room_id", roomId);

    // Transition back
    const previousPhase = room.current_night_turn; // we saved it here
    
    if (previousPhase === "hunter_night") {
      // It was night, now go to day
      await supabase
        .from("rooms")
        .update({ 
          status: "day",
          current_night_turn: null,
          turn_ends_at: null
        })
        .eq("id", roomId);
    } else {
      // It was day (voting), now go to night
      const turnEndsAt = new Date(Date.now() + 15000).toISOString();
      await supabase
        .from("rooms")
        .update({ 
          status: "night",
          current_night_turn: "bodyguard",
          turn_ends_at: turnEndsAt
        })
        .eq("id", roomId);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

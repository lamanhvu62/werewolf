"use client";

import { useState, useEffect, useRef } from "react";
import { Player, Room } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Crosshair, Skull, Loader2, Clock } from "lucide-react";

interface HunterRevengeProps {
  room: Room;
  players: Player[];
  me: Player;
}

export default function HunterRevenge({ room, players, me }: HunterRevengeProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const alivePlayers = players.filter(p => p.is_alive && p.id !== me.id);
  const isMyTurn = me.role === "hunter" && !me.is_alive; // Hunter might be marked dead or not? Actually in actions.ts we delayed killing them. So me.role === "hunter"
  
  // Wait, if we didn't update is_alive to false for hunter, they are still alive?
  // Let's assume they are the hunter.
  const isHunter = me.role === "hunter";
  
  const autoProgressRef = useRef(false);

  // Timer logic
  useEffect(() => {
    if (!room.turn_ends_at) return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(room.turn_ends_at!).getTime();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(remaining);
      return remaining;
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room.turn_ends_at]);

  // Auto-progress logic for ALL clients
  useEffect(() => {
    if (!room.turn_ends_at) return;
    
    const now = new Date().getTime();
    const end = new Date(room.turn_ends_at).getTime();
    
    if (now >= end && !autoProgressRef.current) {
      autoProgressRef.current = true;
      const randomDelay = Math.floor(Math.random() * 1500);
      
      setTimeout(() => {
        fetch("/api/hunter-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        }).finally(() => {
          setTimeout(() => { autoProgressRef.current = false; }, 2000);
        });
      }, randomDelay);
    }
  }, [timeLeft, room.id, room.turn_ends_at]);

  const handleAction = async () => {
    if (isProcessing || !isHunter || !selectedTarget) return;
    
    setIsProcessing(true);
    try {
      // Hunter shoots!
      await supabase.from("actions").insert([{
        room_id: room.id,
        player_id: me.id,
        target_id: selectedTarget,
        action_type: "shoot",
        round_number: 1
      }]);
      setHasActed(true);
    } catch (err) {
      console.error(err);
      alert("Failed to shoot");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-4 mb-8">
        <div className="inline-flex p-3 rounded-full bg-red-900 border border-red-800">
          <Crosshair className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider text-red-500">
          Hunter's Revenge
        </h2>
      </div>

      {room.turn_ends_at && (
        <div className="flex items-center justify-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-6 mx-auto w-fit">
          <Clock className="w-5 h-5 text-red-400" />
          <span className="font-mono text-xl font-bold text-white">00:{timeLeft.toString().padStart(2, '0')}</span>
        </div>
      )}

      {!isHunter ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <Skull className="w-8 h-8 text-red-500 mx-auto animate-pulse" />
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">
            The Hunter is taking aim...
          </h3>
          <p className="text-neutral-400">Someone is about to die with them.</p>
        </div>
      ) : !hasActed ? (
        <div className="bg-red-900/10 backdrop-blur-sm border border-red-900/50 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 text-red-400">You are dying! Take someone with you:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id)}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedTarget === p.id
                    ? "bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                }`}
              >
                <span className="font-bold text-white">{p.name}</span>
              </button>
            ))}
            {alivePlayers.length === 0 && (
              <p className="text-neutral-500 col-span-full text-center py-4">No valid targets available.</p>
            )}
          </div>

          <button
            onClick={handleAction}
            disabled={!selectedTarget || isProcessing}
            className={`w-full mt-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              !selectedTarget 
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Shoot Target"}
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Crosshair className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Shot Fired</h3>
          <p className="text-neutral-400 mt-4">Waiting for your final breath...</p>
        </div>
      )}
    </div>
  );
}

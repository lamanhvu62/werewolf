"use client";

import { useState } from "react";
import { Player, Room } from "@/lib/types";
import { submitAction, processDayAndStartNight } from "@/app/actions";
import { Sun, Skull, Vote, Loader2 } from "lucide-react";

interface DayPhaseProps {
  room: Room;
  players: Player[];
  me: Player;
}

export default function DayPhase({ room, players, me }: DayPhaseProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const alivePlayers = players.filter(p => p.is_alive);
  const deadPlayers = players.filter(p => !p.is_alive);
  const isHost = room.host_id === me.id;

  const handleVote = async () => {
    if (!selectedTarget || hasVoted || isProcessing) return;
    
    setIsProcessing(true);
    try {
      await submitAction(room.id, me.id, selectedTarget, "vote");
      setHasVoted(true);
    } catch (err) {
      console.error(err);
      alert("Failed to submit vote");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndDay = async () => {
    setIsProcessing(true);
    try {
      await processDayAndStartNight(room.id);
    } catch (err) {
      console.error(err);
      alert("Failed to end day");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!me.is_alive) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Skull className="w-16 h-16 text-neutral-600" />
        <h2 className="text-3xl font-bold text-neutral-500">You are Dead</h2>
        <p className="text-neutral-600">You can watch the villagers debate, but you cannot vote.</p>
        {isHost && (
          <button 
            onClick={handleEndDay}
            disabled={isProcessing}
            className="mt-8 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold"
          >
            Force End Day (Host)
          </button>
        )}
      </div>
    );
  }

  // Check if game over (simplified logic: if wolves >= villagers, or wolves == 0)
  const aliveWolves = alivePlayers.filter(p => p.role === "wolf").length;
  const aliveVillagersAndSeers = alivePlayers.length - aliveWolves;

  if (aliveWolves === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Sun className="w-20 h-20 text-yellow-400 animate-spin-slow" />
        <h2 className="text-5xl font-black text-green-400 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">Villagers Win!</h2>
        <p className="text-neutral-300">All the werewolves have been eliminated.</p>
      </div>
    );
  } else if (aliveWolves >= aliveVillagersAndSeers) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Skull className="w-20 h-20 text-red-500 animate-bounce" />
        <h2 className="text-5xl font-black text-red-500 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">Werewolves Win!</h2>
        <p className="text-neutral-300">The wolves have overrun the village.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-8">
        <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <Sun className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-4xl font-black uppercase tracking-wider text-white">Day Phase</h2>
        
        {deadPlayers.length > 0 ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4 text-red-400">
            <p className="font-bold flex items-center justify-center gap-2">
              <Skull className="w-5 h-5" />
              Casualties:
            </p>
            <p className="mt-1">{deadPlayers.map(p => p.name).join(", ")}</p>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mt-4 text-green-400">
            <p className="font-bold">No one died last night!</p>
          </div>
        )}
      </div>

      {!hasVoted ? (
        <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-indigo-400" />
            Vote to Execute
          </h3>
          <p className="text-neutral-400 mb-6 text-sm">Discuss with the village and cast your vote.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id)}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedTarget === p.id
                    ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                    : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                }`}
              >
                <span className="font-bold text-white">{p.name}</span>
                {selectedTarget === p.id && <Vote className="w-5 h-5 text-indigo-400" />}
              </button>
            ))}
          </div>

          <button
            onClick={handleVote}
            disabled={!selectedTarget || isProcessing}
            className={`w-full mt-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              !selectedTarget 
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]"
            }`}
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cast Vote"}
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-indigo-500/20 border border-indigo-500/30 rounded-full flex items-center justify-center mb-4">
            <Vote className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Vote Cast</h3>
          <p className="text-neutral-400">Waiting for other villagers to vote...</p>
        </div>
      )}

      {isHost && (
        <div className="pt-8 border-t border-neutral-800 mt-8 text-center">
          <button 
            onClick={handleEndDay}
            disabled={isProcessing}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            End Day Phase (Host)
          </button>
          <p className="text-xs text-neutral-500 mt-2">Click when everyone has voted to reveal the result.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Player, Room } from "@/lib/types";
import { submitAction, processNightAndStartDay } from "@/app/actions";
import { Moon, Crosshair, Eye, ShieldAlert, Loader2 } from "lucide-react";

interface NightPhaseProps {
  room: Room;
  players: Player[];
  me: Player;
}

export default function NightPhase({ room, players, me }: NightPhaseProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const alivePlayers = players.filter(p => p.is_alive && p.id !== me.id);
  const isHost = room.host_id === me.id;

  const handleAction = async () => {
    if (!selectedTarget || hasActed || isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (me.role === "wolf") {
        await submitAction(room.id, me.id, selectedTarget, "kill");
        setHasActed(true);
      } else if (me.role === "seer") {
        await submitAction(room.id, me.id, selectedTarget, "investigate");
        const target = players.find(p => p.id === selectedTarget);
        setInvestigationResult(target?.role === "wolf" ? "WOLF" : "NOT A WOLF");
        setHasActed(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit action");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndNight = async () => {
    setIsProcessing(true);
    try {
      await processNightAndStartDay(room.id);
    } catch (err) {
      console.error(err);
      alert("Failed to end night");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!me.is_alive) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Moon className="w-16 h-16 text-neutral-600" />
        <h2 className="text-3xl font-bold text-neutral-500">You are Dead</h2>
        <p className="text-neutral-600">Wait for the living to finish their night.</p>
        {isHost && (
          <button 
            onClick={handleEndNight}
            disabled={isProcessing}
            className="mt-8 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold"
          >
            Force End Night (Host)
          </button>
        )}
      </div>
    );
  }

  if (me.role === "villager") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Moon className="w-16 h-16 text-indigo-400 animate-pulse" />
        <h2 className="text-3xl font-bold text-indigo-300">You are Sleeping</h2>
        <p className="text-neutral-400">Wait for the morning to come...</p>
        {isHost && (
          <button 
            onClick={handleEndNight}
            disabled={isProcessing}
            className="mt-8 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold"
          >
            {isProcessing ? "Processing..." : "End Night (Host)"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-8">
        <div className="inline-flex p-3 rounded-full bg-neutral-900 border border-neutral-800">
          {me.role === "wolf" ? (
            <ShieldAlert className="w-8 h-8 text-red-500" />
          ) : (
            <Eye className="w-8 h-8 text-blue-400" />
          )}
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider text-white">
          {me.role === "wolf" ? "Werewolf Phase" : "Seer Phase"}
        </h2>
        <p className="text-neutral-400">
          {me.role === "wolf" 
            ? "Select a player to kill tonight." 
            : "Select a player to investigate."}
        </p>
      </div>

      {!hasActed ? (
        <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 text-white">Alive Players</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id)}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedTarget === p.id
                    ? me.role === "wolf" 
                      ? "bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                      : "bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                    : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                }`}
              >
                <span className="font-bold text-white">{p.name}</span>
                {selectedTarget === p.id && (
                  me.role === "wolf" ? <Crosshair className="w-5 h-5 text-red-500" /> : <Eye className="w-5 h-5 text-blue-400" />
                )}
              </button>
            ))}
            {alivePlayers.length === 0 && (
              <p className="text-neutral-500 col-span-full text-center py-4">No other players alive.</p>
            )}
          </div>

          <button
            onClick={handleAction}
            disabled={!selectedTarget || isProcessing}
            className={`w-full mt-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              !selectedTarget 
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                : me.role === "wolf"
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              me.role === "wolf" ? "Confirm Kill" : "Investigate"
            )}
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Moon className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Action Confirmed</h3>
          
          {investigationResult && (
            <div className={`p-4 rounded-xl inline-block mt-4 ${
              investigationResult === "WOLF" 
                ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                : "bg-green-500/20 text-green-400 border border-green-500/30"
            }`}>
              Result: <span className="font-black tracking-widest">{investigationResult}</span>
            </div>
          )}
          
          <p className="text-neutral-400 mt-4">Waiting for morning...</p>
        </div>
      )}

      {isHost && (
        <div className="pt-8 border-t border-neutral-800 mt-8 text-center">
          <button 
            onClick={handleEndNight}
            disabled={isProcessing}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            End Night Phase (Host)
          </button>
        </div>
      )}
    </div>
  );
}

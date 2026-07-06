"use client";

import { useState, useEffect, useRef } from "react";
import { Player, Room } from "@/lib/types";
import { submitAction, getWolfTarget } from "@/app/actions";
import { Moon, Crosshair, Eye, ShieldAlert, Loader2, Clock, Shield, FlaskConical, Skull, HeartPulse, UserPlus } from "lucide-react";
import Image from "next/image";
import { soundManager } from "@/lib/sound-manager";

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
  const [timeLeft, setTimeLeft] = useState(0);

  // Special State for new roles
  const [alphaMode, setAlphaMode] = useState<"kill" | "infect">("kill");
  const [witchMode, setWitchMode] = useState<"heal" | "poison">(me.potion_heal_used ? "poison" : "heal");
  const [wolfVictim, setWolfVictim] = useState<Player | null>(null);
  const [localHealUsed, setLocalHealUsed] = useState(me.potion_heal_used);

  const alivePlayers = players.filter(p => p.is_alive && p.id !== me.id);
  const isMyTurn = 
    me.role === room.current_night_turn ||
    (me.role === "alpha_wolf" && room.current_night_turn === "wolf");
  
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

  // Audio for turn ticking
  useEffect(() => {
    if (isMyTurn && !hasActed && timeLeft > 0) {
      soundManager.startTicking();
    } else {
      soundManager.stopTicking();
    }
    
    return () => {
      soundManager.stopTicking();
    };
  }, [isMyTurn, hasActed, timeLeft]);

  // Auto-progress logic for ALL clients
  useEffect(() => {
    if (!room.turn_ends_at) return;
    
    const now = new Date().getTime();
    const end = new Date(room.turn_ends_at).getTime();
    
    if (now >= end && !autoProgressRef.current) {
      autoProgressRef.current = true;
      const randomDelay = Math.floor(Math.random() * 1500);
      setTimeout(() => {
        fetch("/api/next-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        }).finally(() => {
          setTimeout(() => { autoProgressRef.current = false; }, 2000);
        });
      }, randomDelay);
    }
  }, [timeLeft, room.id, room.turn_ends_at]);

  // Reset local state when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setHasActed(false);
      setInvestigationResult(null);
      setSelectedTarget(null);
      
      if (me.role === "witch") {
        getWolfTarget(room.id).then(targetId => {
          const victim = players.find(p => p.id === targetId);
          setWolfVictim(victim || null);
        });
      }
    }
  }, [isMyTurn, me.role, room.id, players]);

  let selectablePlayers = alivePlayers;
  if (me.role === "bodyguard") {
     selectablePlayers = players.filter(p => p.is_alive && p.id !== me.last_protected_id); 
  } else if (me.role === "cult_leader") {
     selectablePlayers = alivePlayers.filter(p => !p.is_cult_member);
  }

  const handleAction = async () => {
    if (isProcessing || !isMyTurn) return;
    
    setIsProcessing(true);
    try {
      if (me.role === "wolf") {
        if (!selectedTarget) return;
        await submitAction(room.id, me.id, selectedTarget, "kill");
        setHasActed(true);
      } else if (me.role === "alpha_wolf") {
        if (!selectedTarget) return;
        await submitAction(room.id, me.id, selectedTarget, alphaMode);
        setHasActed(true);
      } else if (me.role === "seer") {
        if (!selectedTarget) return;
        await submitAction(room.id, me.id, selectedTarget, "investigate");
        const target = players.find(p => p.id === selectedTarget);
        setInvestigationResult(target?.role === "wolf" || target?.role === "alpha_wolf" ? "WOLF" : "NOT A WOLF");
        setHasActed(true);
      } else if (me.role === "bodyguard") {
        if (!selectedTarget) return;
        await submitAction(room.id, me.id, selectedTarget, "protect");
        setHasActed(true);
      } else if (me.role === "cult_leader") {
        if (!selectedTarget) return;
        await submitAction(room.id, me.id, selectedTarget, "convert");
        setHasActed(true);
      } else if (me.role === "witch") {
        if (witchMode === "heal") {
           if (wolfVictim) await submitAction(room.id, me.id, wolfVictim.id, "heal");
           setLocalHealUsed(true);
           if (!me.potion_poison_used) {
             setWitchMode("poison");
           } else {
             setHasActed(true);
           }
        } else if (witchMode === "poison") {
           if (selectedTarget) await submitAction(room.id, me.id, selectedTarget, "poison");
           setHasActed(true);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit action");
    } finally {
      setIsProcessing(false);
      soundManager.stopTicking();
      if (me.role === "seer" && investigationResult) {
         soundManager.playSeerAction();
      }
    }
  };

  if (!me.role) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
        <h2 className="text-xl font-bold text-neutral-400">Assigning Roles...</h2>
      </div>
    );
  }

  if (!me.is_alive) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Skull className="w-16 h-16 text-red-900" />
        <h2 className="text-3xl font-bold text-red-500">You are Dead</h2>
        <p className="text-neutral-600">Wait for the living to finish their night.</p>
      </div>
    );
  }

  if (me.role === "villager" || me.role === "hunter") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <Moon className="w-16 h-16 text-indigo-400 animate-pulse" />
        <h2 className="text-3xl font-bold text-indigo-300">You are Sleeping</h2>
        <p className="text-neutral-400">Wait for the morning to come...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="text-center space-y-4 mb-8">
        <div className="relative w-32 h-32 mx-auto rounded-full bg-neutral-900 border-2 border-neutral-800 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-110">
          <Image 
            src={`/roles/${me.role}.png`} 
            alt={me.role.replace("_", " ")} 
            fill
            className="object-cover opacity-90"
            sizes="128px"
            priority
          />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider text-white">
          {me.role.replace("_", " ")} Phase
        </h2>
      </div>

      {room.turn_ends_at && (
        <div className="flex items-center justify-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-6 mx-auto w-fit">
          <Clock className="w-5 h-5 text-indigo-400" />
          <span className="font-mono text-xl font-bold text-white">00:{timeLeft.toString().padStart(2, '0')}</span>
        </div>
      )}

      {!isMyTurn ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <Moon className="w-8 h-8 text-neutral-500 mx-auto animate-pulse" />
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">
            Waiting for {room.current_night_turn}...
          </h3>
          <p className="text-neutral-400">Please wait for your turn.</p>
        </div>
      ) : !hasActed ? (
        <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
          
          {me.role === "alpha_wolf" && (
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setAlphaMode("kill")}
                className={`flex-1 py-3 rounded-lg font-bold border ${alphaMode === "kill" ? "bg-red-600/20 border-red-500 text-red-400" : "bg-neutral-800 border-neutral-700 text-neutral-400"}`}
              >Kill</button>
              <button 
                onClick={() => setAlphaMode("infect")}
                disabled={me.alpha_infection_used}
                className={`flex-1 py-3 rounded-lg font-bold border ${alphaMode === "infect" ? "bg-green-600/20 border-green-500 text-green-400" : "bg-neutral-800 border-neutral-700 text-neutral-400"} disabled:opacity-50`}
              >Infect (Once)</button>
            </div>
          )}

          {me.role === "witch" && (
            <div className="mb-6 space-y-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => setWitchMode("heal")}
                  disabled={localHealUsed}
                  className={`flex-1 py-3 rounded-lg font-bold border ${witchMode === "heal" ? "bg-green-600/20 border-green-500 text-green-400" : "bg-neutral-800 border-neutral-700 text-neutral-400"} disabled:opacity-50`}
                >Heal Potion</button>
                <button 
                  onClick={() => setWitchMode("poison")}
                  disabled={me.potion_poison_used}
                  className={`flex-1 py-3 rounded-lg font-bold border ${witchMode === "poison" ? "bg-purple-600/20 border-purple-500 text-purple-400" : "bg-neutral-800 border-neutral-700 text-neutral-400"} disabled:opacity-50`}
                >Poison Potion</button>
              </div>

              {witchMode === "heal" && (
                <div className="p-6 border border-green-900 bg-green-900/10 rounded-xl text-center space-y-4">
                  <HeartPulse className="w-12 h-12 text-green-500 mx-auto" />
                  {wolfVictim ? (
                    <p className="text-lg text-white">The wolves attacked <span className="font-bold text-red-400">{wolfVictim.name}</span>.</p>
                  ) : (
                    <p className="text-lg text-white">Nobody was attacked by wolves.</p>
                  )}
                  <div className="flex gap-4 pt-4">
                    <button onClick={handleAction} disabled={!wolfVictim || isProcessing} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold disabled:opacity-50">
                      Heal Them
                    </button>
                    <button onClick={() => { setLocalHealUsed(true); if(!me.potion_poison_used) setWitchMode("poison"); else setHasActed(true); }} className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white py-3 rounded-lg font-bold">
                      Skip Healing
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(me.role !== "witch" || witchMode === "poison") && (
            <>
              <h3 className="text-lg font-bold mb-4 text-white">Select a Target</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {selectablePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedTarget(p.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                      selectedTarget === p.id
                        ? "bg-indigo-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                    }`}
                  >
                    <span className="font-bold text-white">{p.name}</span>
                  </button>
                ))}
                {selectablePlayers.length === 0 && (
                  <p className="text-neutral-500 col-span-full text-center py-4">No valid targets available.</p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleAction}
                  disabled={!selectedTarget || isProcessing}
                  className={`flex-1 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    !selectedTarget 
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Action"}
                </button>
                {me.role === "witch" && witchMode === "poison" && (
                  <button onClick={() => setHasActed(true)} className="px-6 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-bold text-white">
                    Skip Poison
                  </button>
                )}
              </div>
            </>
          )}

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
          
          <p className="text-neutral-400 mt-4">Waiting for next turn...</p>
        </div>
      )}
    </div>
  );
}

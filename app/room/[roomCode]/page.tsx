"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Player, Room } from "@/lib/types";
import { Crown, Users, Play, Loader2, Copy, Check } from "lucide-react";
import NightPhase from "@/components/NightPhase";
import DayPhase from "@/components/DayPhase";
import HunterRevenge from "@/components/HunterRevenge";
import { soundManager } from "@/lib/sound-manager";

export default function RoomPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode: rawRoomCode } = use(params);
  const roomCode = rawRoomCode.toUpperCase();
  const searchParams = useSearchParams();
  const playerId = searchParams.get("playerId");

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rolesUpdating, setRolesUpdating] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!playerId) {
      setError("No player ID provided. Please join from the home page.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    let playersSubscription: ReturnType<typeof supabase.channel> | null = null;
    let roomSubscription: ReturnType<typeof supabase.channel> | null = null;

    const fetchInitialData = async () => {
      // Fetch Room
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode)
        .single();

      if (roomError || !roomData) {
        setError("Room not found");
        setLoading(false);
        return;
      }
      setRoom(roomData);

      // Fetch Players
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomData.id)
        .order("joined_at", { ascending: true });

      if (!playersError && playersData) {
        setPlayers(playersData);
      }

      if (!isMounted) return;
      setLoading(false);

      // Subscribe to player changes
      playersSubscription = supabase
        .channel(`room:${roomData.id}:players-${Math.random()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setPlayers((prev) => [...prev, payload.new as Player]);
            } else if (payload.eventType === "UPDATE") {
              setPlayers((prev) =>
                prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p))
              );
            } else if (payload.eventType === "DELETE") {
              setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Subscribe to room status changes (to know when game starts)
      roomSubscription = supabase
        .channel(`room:${roomData.id}:status-${Math.random()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomData.id}`,
          },
          (payload) => {
            setRoom(payload.new as Room);
          }
        )
        .subscribe();
    };

    fetchInitialData();

    return () => {
      isMounted = false;
      if (playersSubscription) supabase.removeChannel(playersSubscription);
      if (roomSubscription) supabase.removeChannel(roomSubscription);
    };
  }, [roomCode, playerId]);

  // Audio & Background transitions effect based on status
  useEffect(() => {
    if (!room) return;
    
    if (room.status === "night") {
      soundManager.playWolfHowl();
      soundManager.playNightAmbient();
    } else {
      soundManager.stopNightAmbient();
    }
    
    return () => {
       soundManager.stopNightAmbient();
    };
  }, [room?.status]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = (role: string, delta: number) => {
    if (!room || room.host_id !== playerId) return;
    const currentRoles = room.selected_roles || { wolf: 1, seer: 1 };
    const currentCount = currentRoles[role] || 0;
    const newCount = Math.max(0, currentCount + delta);
    
    const newRoles = { ...currentRoles, [role]: newCount };
    if (newCount === 0) delete newRoles[role];
    
    // Optimistic update
    setRoom({ ...room, selected_roles: newRoles });
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setRolesUpdating(true);
      try {
        const { updateRoomRoles } = await import("@/app/actions");
        await updateRoomRoles(room.id, newRoles);
      } catch (err) {
        console.error(err);
      } finally {
        setRolesUpdating(false);
      }
    }, 500);
  };

  const handleStartGame = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/start-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room?.id, hostId: playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start game");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error || "Something went wrong"}</p>
          <a href="/" className="mt-6 inline-block bg-neutral-900 text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  const isHost = room.host_id === playerId;
  const me = players.find(p => p.id === playerId);
  
  const SPECIAL_ROLES = ["wolf", "seer", "bodyguard", "witch", "hunter", "alpha_wolf", "cult_leader"];
  const selectedRoles = room.selected_roles || { wolf: 1, seer: 1 };
  const totalSelectedRoles = Object.values(selectedRoles).reduce((a, b) => a + (b as number), 0);
  const isValidRoleCount = totalSelectedRoles <= players.length;

  return (
    <main className={`min-h-screen flex flex-col items-center p-6 relative overflow-hidden transition-colors duration-1000 ${
      room.status === "day" ? "bg-amber-50 text-neutral-900" : "bg-neutral-950 text-neutral-100"
    }`}>
      {/* Background Effect */}
      <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${
        room.status === "day" ? "bg-amber-400/20" : "bg-indigo-500/10"
      }`} />

      {room.status === "lobby" && (
        <div className="z-10 w-full max-w-2xl mt-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                <span className="text-neutral-400 font-medium uppercase tracking-wider text-sm">Lobby</span>
              </div>
              <h1 className="text-4xl font-black text-white">Waiting Room</h1>
            </div>
            
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 backdrop-blur-md">
              <div>
                <p className="text-xs text-neutral-500 uppercase font-semibold tracking-wider mb-1">Room Code</p>
                <p className="text-2xl font-mono font-bold text-white tracking-widest">{roomCode}</p>
              </div>
              <button 
                onClick={copyRoomCode}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-300 hover:text-white"
              >
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Players
                </h2>
                <span className="bg-neutral-800 text-neutral-300 text-xs px-3 py-1 rounded-full font-medium">
                  {players.length} Joined
                </span>
              </div>
              
              <div className="space-y-3">
                {players.map((player) => (
                  <div 
                    key={player.id}
                    className={`p-4 rounded-xl flex items-center justify-between border transition-all ${
                      player.id === playerId 
                        ? "bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]" 
                        : "bg-neutral-900/50 border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white flex items-center gap-2">
                          {player.name}
                          {player.id === playerId && (
                            <span className="text-[10px] uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded flex-shrink-0">You</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {player.id === room.host_id && (
                      <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                        <Crown className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Host</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Role Setup</h3>
                  {rolesUpdating && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                </div>
                
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {SPECIAL_ROLES.map(role => {
                    const count = selectedRoles[role] || 0;
                    return (
                      <div key={role} className="flex items-center justify-between bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50">
                        <span className="text-sm font-medium text-white capitalize">{role.replace("_", " ")}</span>
                        {isHost ? (
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleRoleChange(role, -1)} disabled={count === 0} className="w-6 h-6 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 rounded disabled:opacity-50 text-white font-bold">-</button>
                            <span className="w-4 text-center text-sm font-bold text-white">{count}</span>
                            <button onClick={() => handleRoleChange(role, 1)} className="w-6 h-6 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">+</button>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-indigo-400">x{count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-6 p-4 rounded-xl border ${isValidRoleCount ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-sm text-neutral-400">Total Special Roles</span>
                     <span className={`font-bold ${isValidRoleCount ? 'text-indigo-400' : 'text-red-400'}`}>{totalSelectedRoles}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-neutral-400">Total Players</span>
                     <span className="font-bold text-white">{players.length}</span>
                   </div>
                   {isValidRoleCount && players.length > 0 && (
                     <p className="text-xs text-neutral-500 mt-3 pt-3 border-t border-neutral-800">
                       Any remaining {players.length - totalSelectedRoles} players will automatically become <strong>Villagers</strong>.
                     </p>
                   )}
                   {!isValidRoleCount && (
                     <p className="text-xs text-red-400 mt-3 pt-3 border-t border-red-900/50">
                       Cannot select more roles than players!
                     </p>
                   )}
                </div>
                
                {isHost ? (
                  <button
                    onClick={handleStartGame}
                    disabled={players.length < 3 || starting || !isValidRoleCount}
                    className="w-full mt-6 group relative flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 px-4 rounded-xl overflow-hidden hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:shadow-none"
                  >
                    {starting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        Start Game
                      </>
                    )}
                  </button>
                ) : (
                  <div className="mt-6 p-4 bg-neutral-800/50 rounded-xl text-center border border-neutral-700/50">
                    <p className="text-sm text-neutral-400">Waiting for host to start...</p>
                  </div>
                )}
                {isHost && players.length < 3 && (
                  <p className="text-xs text-center text-red-400 mt-3">Need at least 3 players to start.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {room.status === "night" && me && (
        <div className="z-10 w-full mt-12">
          <NightPhase room={room} players={players} me={me} />
        </div>
      )}

      {room.status === "day" && me && (
        <div className="z-10 w-full mt-12">
          <DayPhase room={room} players={players} me={me} />
        </div>
      )}

      {room.status === "hunter_revenge" && me && (
        <div className="z-10 w-full mt-12">
          <HunterRevenge room={room} players={players} me={me} />
        </div>
      )}
    </main>
  );
}

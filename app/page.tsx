"use client";

import { useState } from "react";
import { createRoom, joinRoom } from "./actions";
import { Moon, Users, Play, ArrowRight } from "lucide-react";

export default function Home() {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    try {
      if (isJoining) {
        await joinRoom(formData);
      } else {
        await createRoom(formData);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="z-10 w-full max-w-md">
        <div className="text-center mb-10 space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Moon className="w-20 h-20 text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
              <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
            WEREWOLF
          </h1>
          <p className="text-neutral-400 text-lg">Trust no one. Survive the night.</p>
        </div>

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex gap-4 mb-8 p-1 bg-neutral-950 rounded-2xl">
            <button
              onClick={() => { setIsJoining(false); setError(null); }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                !isJoining 
                  ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]" 
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => { setIsJoining(true); setError(null); }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                isJoining 
                  ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]" 
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              Join Room
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="playerName" className="text-sm font-medium text-neutral-300 ml-1">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-neutral-500" />
                </div>
                <input
                  type="text"
                  id="playerName"
                  name="playerName"
                  required
                  placeholder="Enter your alias..."
                  className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                />
              </div>
            </div>

            {isJoining && (
              <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                <label htmlFor="roomCode" className="text-sm font-medium text-neutral-300 ml-1">
                  Room Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Play className="h-5 w-5 text-neutral-500" />
                  </div>
                  <input
                    type="text"
                    id="roomCode"
                    name="roomCode"
                    required
                    maxLength={6}
                    placeholder="6-digit code"
                    className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl py-3 pl-12 pr-4 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600 placeholder:tracking-normal font-mono"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-in fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full group relative flex items-center justify-center gap-2 bg-white text-black font-bold py-4 px-8 rounded-xl overflow-hidden hover:scale-[1.02] transition-transform active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <span className="relative z-10">{isJoining ? "Enter Lobby" : "Initialize Game"}</span>
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

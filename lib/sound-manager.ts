"use client";

import { Howl } from "howler";

class SoundManager {
  private nightAmbient: Howl | null = null;
  private wolfHowl: Howl | null = null;
  private clockTick: Howl | null = null;
  private seerAction: Howl | null = null;
  public isMuted: boolean = false;

  constructor() {
    // Only initialize if we are in the browser
    if (typeof window !== "undefined") {
      this.nightAmbient = new Howl({
        src: ["https://ycjqhugjlnwewvolmgwh.supabase.co/storage/v1/object/public/sound/night-ambient.mp3"],
        loop: true,
        volume: 0.3,
      });

      this.wolfHowl = new Howl({
        src: ["https://ycjqhugjlnwewvolmgwh.supabase.co/storage/v1/object/public/sound/wolf-howl.mp3"],
        volume: 0.6,
      });

      this.clockTick = new Howl({
        src: ["https://ycjqhugjlnwewvolmgwh.supabase.co/storage/v1/object/public/sound/clock-tick.mp3"],
        loop: true,
        volume: 0.4,
      });

      this.seerAction = new Howl({
        src: ["https://ycjqhugjlnwewvolmgwh.supabase.co/storage/v1/object/public/sound/seer-action.mp3"],
        volume: 0.5,
      });
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    Howler.mute(muted);
  }

  playNightAmbient() {
    if (this.isMuted || !this.nightAmbient) return;
    if (!this.nightAmbient.playing()) {
      this.nightAmbient.play();
      this.nightAmbient.fade(0, 0.3, 2000);
    }
  }

  stopNightAmbient() {
    if (this.nightAmbient && this.nightAmbient.playing()) {
      this.nightAmbient.fade(0.3, 0, 1000);
      setTimeout(() => this.nightAmbient?.stop(), 1000);
    }
  }

  playWolfHowl() {
    if (this.isMuted || !this.wolfHowl) return;
    this.wolfHowl.play();
  }

  startTicking() {
    if (this.isMuted || !this.clockTick) return;
    if (!this.clockTick.playing()) {
      this.clockTick.play();
    }
  }

  stopTicking() {
    if (this.clockTick && this.clockTick.playing()) {
      this.clockTick.stop();
    }
  }

  playSeerAction() {
    if (this.isMuted || !this.seerAction) return;
    this.seerAction.play();
  }
}

// Export a singleton instance
export const soundManager = new SoundManager();

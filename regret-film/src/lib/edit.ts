/**
 * Typed access to the edit data.
 *
 * - music.json    : beat grid / downbeats / sections (from tools/analysis)
 * - shots.json    : creative shot list (clip, motion, transition, fx)
 * - timeline.json : frame-accurate ranges computed by tools/build_timeline.py
 * - energy.json   : smoothed loudness per frame (0..1), used for "breathing"
 */
import musicData from "../data/music.json";
import shotsData from "../data/shots.json";
import timelineData from "../data/timeline.json";
import energyData from "../data/energy.json";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = musicData.fps;
export const TOTAL_FRAMES = musicData.durationInFrames;

/** Letterbox to ~2.2:1 inside the 16:9 frame. Set to 0 to disable. */
export const LETTERBOX_PX = 104;

export type TransitionIn =
  | { type: "fromBlack"; frames: number }
  | { type: "dissolve"; frames: number }
  | { type: "blur"; frames: number }
  | { type: "dip"; outFrames: number; inFrames: number }
  | { type: "cut" };

export type Motion = {
  scaleFrom: number;
  scaleTo: number;
  /** translation in px at start / end of the shot */
  x: [number, number];
  y: [number, number];
  /** transform origin in % of the frame */
  origin: [number, number];
  /** 0..1 amount of slow handheld drift */
  handheld?: number;
  ease?: "linear" | "in" | "inOut";
};

export type Fx = {
  fog: number;
  rain: number;
  dust: number;
  glow?: { x: number; y: number; strength: number };
};

export type ShotDef = {
  id: string;
  clip: string;
  desc: string;
  chapter: string;
  transition: TransitionIn;
  motion: Motion;
  fx: Fx;
};

export type TimelineEntry = {
  id: string;
  clip: string;
  from: number;
  durationInFrames: number;
  cutIn: number;
  cutOut: number;
  transitionIn: TransitionIn;
  transitionOut: TransitionIn | null;
};

const defs = new Map<string, ShotDef>(
  (shotsData.shots as unknown as ShotDef[]).map((s) => [s.id, s]),
);

export const SHOTS: { def: ShotDef; tl: TimelineEntry; index: number }[] = (
  timelineData.shots as unknown as TimelineEntry[]
).map((tl, index) => {
  const def = defs.get(tl.id);
  if (!def) {
    throw new Error(`timeline.json references unknown shot ${tl.id}`);
  }
  return { def, tl, index };
});

export const ENDING = shotsData.ending as { fadeStartSec: number; fadeEndSec: number };

export const ENERGY: number[] = energyData as number[];

export const energyAt = (frame: number): number =>
  ENERGY[Math.max(0, Math.min(ENERGY.length - 1, frame))] ?? 0.5;

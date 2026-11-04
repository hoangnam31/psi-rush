"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_COURSE_WIDTH, courseWidthForPlayers, MAPS, survivalSizeForPlayers } from "../lib/game";
import { GameAudio } from "../lib/game-audio";
import { tileCollapseState } from "../lib/tile-collapse";
import type { Player } from "../lib/types";

type Props = {
  me: Player;
  players: Player[];
  mapId: string | null;
  round: number;
  startedAt: string;
  onProgress: (value: number, positionX: number) => void;
  onFinish: (timeMs: number) => void;
  onEliminate: (timeMs: number) => void;
};

type Obstacle = {
  x: number; y: number; w: number; h: number;
  kind: "block" | "pad" | "bumper" | "mover";
  color: string; amp?: number; speed?: number; phase?: number; low?: boolean; icePlatform?: boolean;
};
type Spinner = { x: number; y: number; len: number; speed: number; phase: number; color: string };
type Pit = { x: number; y: number; w: number; h: number };
type SpecialZone = { kind: "tiles" | "rings" | "arena" | "sweep"; x: number; y: number; w: number; h: number; phase: number };
type RingPlatform = { x: number; y: number; r: number; speed: number; phase: number; moveSpeed: number; moveAmp: number };
type BridgePlatform = { x: number; y: number; w: number; h: number; amp: number; speed: number; phase: number; color: string };
type SweepRect = { x: number; y: number; w: number; h: number; low: boolean; color: string; vx: number; vy: number };
type LaserBeam = { x1: number; y1: number; x2: number; y2: number; vx: number; vy: number; color: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type RemoteState = { x: number; y: number; targetX: number; targetY: number; vx: number; vy: number; targetAt: number };

const COURSE = 10000;
const START_LINE = 230;
const PLAYER_R = 38;
const DEFAULT_CHECKPOINTS = [80, 2500, 5000, 7500];
// Each Neon Sky checkpoint sits on a solid recovery strip after a ring abyss
// and before the next neon obstacle group.
const NEON_SKY_CHECKPOINTS = [80, 2100, 4230, 6380, 8500];
const JUMP_SPEED = 650;
const GRAVITY = 1450;
const PIT_LENGTH = 180;
const FINISH_CLEARANCE = 650;
const SURVIVAL_Y = 3900;
const EDGE_SUPPORT = PLAYER_R * .68;
const ICE_BRIDGE_SUPPORT = PLAYER_R * .92;
const CAMERA_FOLLOW_SPEED = 13;

function mapSeed(id: string) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function stableHash(value: string) {
  return [...value].reduce((result, char) => ((result * 31 + char.charCodeAt(0)) >>> 0), 7);
}

function tileRectsForZone(zone: SpecialZone) {
  const columns = 10, rows = 8, gap = 14, padX = 28, padY = 28;
  const width = (zone.w - padX * 2 - gap * (columns - 1)) / columns;
  const height = (zone.h - padY * 2 - gap * (rows - 1)) / rows;
  return Array.from({ length: columns * rows }, (_, index) => ({
    x: zone.x + padX + (index % columns) * (width + gap),
    y: zone.y + padY + Math.floor(index / columns) * (height + gap),
    w: width, h: height, index,
  }));
}

function buildCourse(id: string, courseWidth: number, playerCount: number) {
  const seed = mapSeed(id);
  const colors = ["#ff3d9a", "#ffe14a", "#35dcff", "#b6f43b"];
  const obstacles: Obstacle[] = [];
  const spinners: Spinner[] = [];
  const pits: Pit[] = [];
  const bridgePits: Pit[] = [];
  const bridges: BridgePlatform[] = [];
  const zones: SpecialZone[] = [];
  const survivalSize = survivalSizeForPlayers(playerCount);
  const survivalX = (courseWidth - survivalSize) / 2;

  if (id === "jungle") {
    zones.push({ kind: "tiles", x: survivalX, y: SURVIVAL_Y, w: survivalSize, h: Math.round(survivalSize * .82), phase: seed * .01 });
  } else if (id === "sky") {
    [720, 2860, 5000, 7140].forEach((y, index) => {
      zones.push({ kind: "rings", x: 0, y, w: courseWidth, h: 1250, phase: index });
      spinners.push({ x: courseWidth / 2, y: y + 610, len: 190 + index * 18, speed: (index % 2 ? -1 : 1) * (1.6 + index * .22), phase: index, color: colors[index % colors.length] });
    });
    [2250, 4390, 6530, 8670].forEach((y, index) => {
      const gate = courseWidth * (.2 + ((seed + index * 17) % 32) / 100);
      const gap = Math.max(360, courseWidth * .22);
      obstacles.push(
        { x: 0, y, w: gate, h: 92, kind: "block", color: colors[index % 4] },
        { x: gate + gap, y, w: Math.max(140, courseWidth - gate - gap), h: 92, kind: "block", color: colors[index % 4] },
        { x: courseWidth / 2 - 120, y: y + 270, w: 240, h: 94, kind: "mover", color: colors[(index + 1) % 4], amp: Math.min(650, courseWidth * .34), speed: 1.35 + index * .17, phase: index },
        { x: 130 + index * 170 % Math.max(200, courseWidth - 300), y: y + 500, w: 88, h: 88, kind: "bumper", color: colors[(index + 2) % 4], phase: index },
      );
    });
  } else if (id === "sweep") {
    zones.push({ kind: "sweep", x: survivalX, y: SURVIVAL_Y, w: survivalSize, h: survivalSize, phase: seed * .01 });
  } else if (id === "lava") {
    zones.push({ kind: "arena", x: survivalX, y: SURVIVAL_Y, w: survivalSize, h: survivalSize, phase: 0 });
  }

  for (let zone = 1; zone <= (id === "ice" ? 12 : 0); zone++) {
    const y = 650 + zone * 720 + (seed * zone) % 145;
    const difficulty = zone / 12;
    const type: number = zone % 4;
    if (type === 0) {
      const gapWidth = 390;
      const gap = 160 + (seed * zone * 13) % (courseWidth - gapWidth - 320);
      obstacles.push(
        { x: 0, y, w: gap, h: 86, kind: "block", color: colors[zone % 4] },
        { x: gap + gapWidth, y, w: courseWidth - gap - gapWidth, h: 86, kind: "block", color: colors[zone % 4] },
      );
    } else if (type === 1) {
      spinners.push({
        x: zone % 2 ? courseWidth * .3 : courseWidth * .7, y, len: 265 + (seed + zone) % 75,
        speed: (zone % 2 ? 1 : -1) * (.72 + difficulty * 1.7), phase: zone, color: colors[zone % 4],
      });
    } else if (type === 2) {
      obstacles.push({
        x: courseWidth / 2 - 125, y, w: 250, h: 88, kind: "mover", color: colors[zone % 4],
        amp: Math.min(650, courseWidth * .34), speed: .55 + difficulty * 1.35, phase: zone,
      });
    } else {
      obstacles.push(
        { x: 150 + (zone * 137) % 620, y, w: 220, h: 88, kind: "block", color: colors[zone % 4] },
        { x: courseWidth - 560 + (zone * 73) % 300, y: y + 245, w: 210, h: 88, kind: "block", color: colors[(zone + 1) % 4] },
      );
    }
    obstacles.push({
      x: 150 + (seed * zone * 19) % Math.max(200, courseWidth - 300), y: y + 360, w: 84, h: 84,
      kind: "bumper", color: colors[(zone + 2) % 4], phase: zone,
    });
    if (zone % 3 === 0) {
      obstacles.push({ x: courseWidth / 2 - 120, y: y + 500, w: 240, h: 100, kind: "pad", color: "#b6f43b" });
    }
    if (zone % 4 === 0) {
      const pitY = y + (zone % 3 === 0 ? 680 : 535);
      pits.push({ x: 210 + (seed * zone * 23) % Math.max(300, courseWidth - 650), y: pitY, w: 330, h: PIT_LENGTH });
    }
    obstacles.push(
      { x: 35, y: y + 160, w: 150, h: 96, kind: zone % 2 ? "block" : "bumper", color: "#d8f9ff", phase: zone },
      { x: courseWidth - 185, y: y + 300, w: 150, h: 96, kind: zone % 2 ? "bumper" : "block", color: "#71dfff", phase: zone + 1 },
    );
  }
  if (id === "ice") {
    // A gentle introduction before the first random obstacle group so the
    // opening stretch is readable without feeling empty.
    obstacles.push(
      { x: 70, y: 540, w: courseWidth * .24, h: 94, kind: "block", color: "#d8f9ff" },
      { x: courseWidth * .72, y: 540, w: courseWidth * .28 - 70, h: 94, kind: "block", color: "#71dfff" },
      { x: courseWidth / 2 - 145, y: 870, w: 290, h: 96, kind: "mover", color: "#7ce9ff", amp: Math.min(310, courseWidth * .2), speed: .42, phase: .4 },
      { x: courseWidth * .18, y: 1160, w: 96, h: 96, kind: "bumper", color: "#f1fdff", phase: 0 },
      { x: courseWidth * .76, y: 1160, w: 96, h: 96, kind: "bumper", color: "#d8f9ff", phase: 1 },
    );
    [3000, 6200].forEach((y, pitIndex) => {
      // Extend the abyss past both road edges so it cannot be bypassed by
      // hugging the outer collision boundary. The larger floes leave clear,
      // jumpable gaps while giving crowded rooms enough landing space.
      const pit = { x: -PLAYER_R * 2, y, w: courseWidth + PLAYER_R * 4, h: 1080 };
      pits.push(pit); bridgePits.push(pit);
      for (let row = 0; row < 4; row++) bridges.push({
        x: courseWidth / 2 - 250, y: y + 25 + row * 270, w: 500, h: 185,
        amp: Math.min(pitIndex ? 420 : 300, courseWidth / 2 - 330),
        speed: pitIndex ? .68 : .38,
        phase: pitIndex * .55 + row * .2,
        color: row % 2 ? "#7ce9ff" : "#f1fdff",
      });
    });
  }
  const courseLimit = COURSE - FINISH_CLEARANCE;
  const overlapsBridgePit = (y: number, height: number) => bridgePits.some((pit) => y < pit.y + pit.h && y + height > pit.y);
  return {
    obstacles: obstacles.filter((obstacle) => obstacle.y + obstacle.h <= courseLimit && !overlapsBridgePit(obstacle.y, obstacle.h)),
    spinners: spinners.filter((spinner) => spinner.y + spinner.len <= courseLimit && !overlapsBridgePit(spinner.y - spinner.len, spinner.len * 2)),
    pits: pits.filter((pit) => pit.y + pit.h <= courseLimit && (bridgePits.includes(pit) || !overlapsBridgePit(pit.y, pit.h))),
    bridges: bridges.filter((bridge) => bridge.y + bridge.h <= courseLimit),
    zones: zones.filter((zone) => zone.y + zone.h <= courseLimit),
  };
}

export function RaceGame({ me, players, mapId, round, startedAt, onProgress, onFinish, onEliminate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const progressCb = useRef(onProgress);
  const finishCb = useRef(onFinish);
  const eliminateCb = useRef(onEliminate);
  const playersRef = useRef(players);
  const input = useRef({ x: 0, y: 0, jump: false, dash: false });
  const [countdown, setCountdown] = useState("3");
  const [dash, setDash] = useState(100);
  const [mana, setMana] = useState(100);
  const [elapsed, setElapsed] = useState(0);
  const [localProgress, setLocalProgress] = useState(0);
  const [impact, setImpact] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const map = MAPS.find((item) => item.id === mapId) ?? MAPS[0];
  const isSurvival = map.mode === "survival";

  useEffect(() => { progressCb.current = onProgress; finishCb.current = onFinish; eliminateCb.current = onEliminate; }, [onProgress, onFinish, onEliminate]);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const audio = new GameAudio(map.id);
    audioRef.current = audio;
    void audio.unlock();
    let raf = 0;
    let last = performance.now();
    let start = 0;
    let lastSync = 0;
    let lastUi = 0;
    let lastImpact = 0;
    let shake = 0;
    let renderScale = .6;
    const playerCount = Math.max(1, playersRef.current.length);
    const courseWidth = courseWidthForPlayers(playerCount);
    const checkpoints = map.id === "sky" ? NEON_SKY_CHECKPOINTS : DEFAULT_CHECKPOINTS;
    const { obstacles, spinners, pits, bridges, zones } = buildCourse(map.id, courseWidth, playerCount);
    const survivalZone = isSurvival ? zones[0] : null;
    function spawnFor(playerId: string) {
      if (map.start === "tiles" && survivalZone) {
        const tiles = tileRectsForZone(survivalZone);
        const tile = tiles[stableHash(playerId) % tiles.length];
        return { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 };
      }
      if (map.start === "arena" && survivalZone) {
        const angle = stableHash(playerId) / 0xffffffff * Math.PI * 2;
        const radius = Math.min(survivalZone.w, survivalZone.h) * .25;
        return { x: survivalZone.x + survivalZone.w / 2 + Math.cos(angle) * radius, y: survivalZone.y + survivalZone.h / 2 + Math.sin(angle) * radius };
      }
      if (map.start === "square" && survivalZone) {
        const columns = Math.max(5, Math.ceil(Math.sqrt(playerCount)));
        const rosterIndex = playersRef.current.findIndex((player) => player.id === playerId);
        const index = rosterIndex >= 0 ? rosterIndex : stableHash(playerId) % Math.max(1, playerCount);
        const row = Math.floor(index / columns), column = index % columns;
        const rows = Math.ceil(playerCount / columns);
        return {
          x: survivalZone.x + survivalZone.w * (.18 + .64 * (column + .5) / columns),
          y: survivalZone.y + survivalZone.h * (.18 + .64 * (row + .5) / rows),
        };
      }
      return { x: courseWidth / 2, y: 80 };
    }
    const spawn = spawnFor(me.id);
    let cameraX = spawn.x;
    let cameraY = spawn.y;
    let finished = false;
    let eliminationSent = false;
    const normalizedStartedAt = startedAt.includes("T") ? startedAt : `${startedAt.replace(" ", "T")}Z`;
    const roundGoEpoch = (Number.isFinite(Date.parse(normalizedStartedAt)) ? Date.parse(normalizedStartedAt) : Date.now()) + 3000;
    const readyAt = performance.now() + Math.max(0, roundGoEpoch - Date.now());
    const p = {
      x: spawn.x, y: spawn.y, vx: 0, vy: 0, z: 0, vz: 0, stun: 0, hitCd: 0,
      dashCd: 0, dashTime: 0, mana: 100, lastJump: -Infinity,
      falling: false, fallTime: 0, fallPit: null as Pit | null, fallEdge: false,
      disintegrating: false, disintegrateTime: 0, checkpoint: spawn.y, checkpointIndex: 0,
    };
    const particles: Particle[] = [];
    const remoteStates = new Map<string, RemoteState>();
    const keys: Record<string, boolean> = {};

    const down = (event: KeyboardEvent) => {
      void audio.unlock();
      keys[event.key.toLowerCase()] = true;
      if (event.code === "Space") input.current.jump = true;
      if (event.key === "Shift") input.current.dash = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => { keys[event.key.toLowerCase()] = false; };
    const unlockAudio = () => { void audio.unlock(); };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("pointerdown", unlockAudio);

    function resize() {
      const dpr = Math.min(devicePixelRatio, 2);
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener("resize", resize);

    function movingX(obstacle: Obstacle, time: number) {
      if (obstacle.kind !== "mover") return obstacle.x;
      return obstacle.x + Math.sin(time * (obstacle.speed ?? 1) + (obstacle.phase ?? 0)) * (obstacle.amp ?? 0);
    }

    function burst(x: number, y: number, color: string, amount = 9) {
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 110 + Math.random() * 260;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .35, color });
      }
    }

    function showImpact(label: string, now: number) {
      if (now - lastImpact < 280) return;
      lastImpact = now;
      setImpact(label);
      window.setTimeout(() => setImpact(""), 520);
    }

    function resolveRect(obstacle: Obstacle, obstacleX: number, now: number) {
      const nearX = Math.max(obstacleX, Math.min(p.x, obstacleX + obstacle.w));
      const nearY = Math.max(obstacle.y, Math.min(p.y, obstacle.y + obstacle.h));
      let dx = p.x - nearX, dy = p.y - nearY;
      const distance = Math.hypot(dx, dy);
      if (distance >= PLAYER_R) return false;

      let nx = 0, ny = 0, penetration = 0;
      if (distance > .001) {
        nx = dx / distance; ny = dy / distance; penetration = PLAYER_R - distance;
      } else {
        const sides = [
          { gap: Math.abs(p.x - obstacleX), nx: -1, ny: 0 },
          { gap: Math.abs(obstacleX + obstacle.w - p.x), nx: 1, ny: 0 },
          { gap: Math.abs(p.y - obstacle.y), nx: 0, ny: -1 },
          { gap: Math.abs(obstacle.y + obstacle.h - p.y), nx: 0, ny: 1 },
        ].sort((a, b) => a.gap - b.gap)[0];
        nx = sides.nx; ny = sides.ny; penetration = PLAYER_R + sides.gap;
      }

      p.x += nx * (penetration + 1.5);
      p.y += ny * (penetration + 1.5);
      const intoSurface = p.vx * nx + p.vy * ny;
      if (intoSurface < 0) {
        p.vx -= intoSurface * 1.22 * nx;
        p.vy -= intoSurface * 1.22 * ny;
      }
      if (p.hitCd <= 0) {
        const force = obstacle.kind === "mover" ? 440 : 185;
        p.vx += nx * force; p.vy += ny * force;
        p.stun = obstacle.kind === "mover" ? .34 : .16;
        p.hitCd = .18;
        shake = obstacle.kind === "mover" ? .72 : .32;
        audio.collision(obstacle.kind === "mover");
        burst(p.x, p.y, obstacle.color, obstacle.kind === "mover" ? 12 : 7);
        showImpact(obstacle.kind === "mover" ? "BỊ HÚC!" : "VA CHẠM!", now);
      }
      return true;
    }

    function hitBumper(obstacle: Obstacle, obstacleX: number, now: number) {
      const radius = obstacle.w / 2;
      const cx = obstacleX + radius, cy = obstacle.y + radius;
      const dx = p.x - cx, dy = p.y - cy, distance = Math.hypot(dx, dy) || 1;
      if (distance > radius + PLAYER_R || p.hitCd > 0) return;
      const overlap = radius + PLAYER_R - distance;
      p.x += dx / distance * (overlap + 2); p.y += dy / distance * (overlap + 2);
      p.vx = dx / distance * 760;
      p.vy = dy / distance * 760;
      p.vz = 260;
      p.stun = .58;
      p.hitCd = .3;
      shake = .9;
      audio.collision(true);
      burst(cx, cy, obstacle.color, 16);
      showImpact("BOING!", now);
    }

    function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
      const dx = x2 - x1, dy = y2 - y1;
      const length = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    function updateRemotePlayers(now: number, dt: number) {
      const active = new Set<string>();
      for (const other of playersRef.current) {
        if (other.id === me.id || other.finishPosition) continue;
        active.add(other.id);
        const otherSpawn = spawnFor(other.id);
        const waitingForFirstSync = isSurvival && other.progress < 1;
        const targetX = waitingForFirstSync ? otherSpawn.x : Number.isFinite(other.positionX) ? other.positionX : otherSpawn.x;
        const targetY = waitingForFirstSync ? otherSpawn.y : other.progress / 100 * COURSE;
        let state = remoteStates.get(other.id);
        if (!state) {
          state = { x: targetX, y: targetY, targetX, targetY, vx: 0, vy: 0, targetAt: now };
          remoteStates.set(other.id, state);
        } else if (Math.abs(targetX - state.targetX) > .01 || Math.abs(targetY - state.targetY) > .01) {
          const sampleTime = Math.max(.08, Math.min(1.2, (now - state.targetAt) / 1000));
          state.vx = Math.max(-900, Math.min(900, (targetX - state.targetX) / sampleTime));
          state.vy = Math.max(-650, Math.min(900, (targetY - state.targetY) / sampleTime));
          state.targetX = targetX; state.targetY = targetY; state.targetAt = now;
        }
        const predictionTime = Math.min(.32, Math.max(0, (now - state.targetAt) / 1000));
        const predictedX = state.targetX + state.vx * predictionTime;
        const predictedY = state.targetY + state.vy * predictionTime;
        const easing = 1 - Math.exp(-dt * 11);
        state.x += (predictedX - state.x) * easing;
        state.y += (predictedY - state.y) * easing;
      }
      for (const id of remoteStates.keys()) if (!active.has(id)) remoteStates.delete(id);
    }

    function collideWithPlayers(now: number) {
      for (const other of playersRef.current) {
        if (other.id === me.id || other.progress >= 100 || other.finishPosition) continue;
        const remote = remoteStates.get(other.id);
        const otherY = remote?.y ?? other.progress / 100 * COURSE;
        const otherX = remote?.x ?? other.positionX ?? 150 + hash(other.id) % (courseWidth - 300);
        let dx = p.x - otherX, dy = p.y - otherY;
        let distance = Math.hypot(dx, dy);
        if (distance >= PLAYER_R * 2) continue;
        if (distance < .001) {
          const angle = hash(`${me.id}:${other.id}`) / 0xffffffff * Math.PI * 2;
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
        }
        const nx = dx / distance, ny = dy / distance;
        const overlap = PLAYER_R * 2 - distance;
        p.x += nx * (overlap + 1.5); p.y += ny * (overlap + 1.5);
        const inward = p.vx * nx + p.vy * ny;
        if (inward < 0) { p.vx -= inward * nx; p.vy -= inward * ny; }
        if (p.hitCd <= 0) {
          p.vx += nx * 135; p.vy += ny * 135; p.stun = .1; p.hitCd = .12; shake = .2;
          burst((p.x + otherX) / 2, (p.y + otherY) / 2, "#ffffff", 5);
          showImpact("BUMP!", now);
        }
      }
    }

    function bridgeX(bridge: BridgePlatform, time: number) {
      return bridge.x + Math.sin(time * bridge.speed + bridge.phase) * bridge.amp;
    }

    function getSupportingBridge(time: number) {
      return bridges.find((bridge) => circleTouchesRect(p.x, p.y, ICE_BRIDGE_SUPPORT, { ...bridge, x: bridgeX(bridge, time) })) ?? null;
    }

    function getPitAtPlayer(time: number) {
      const pit = pits.find((item) => p.x > item.x + EDGE_SUPPORT && p.x < item.x + item.w - EDGE_SUPPORT && p.y > item.y + EDGE_SUPPORT && p.y < item.y + item.h - EDGE_SUPPORT) ?? null;
      if (!pit || getSupportingBridge(time)) return null;
      return pit;
    }

    function getTileRects(zone: SpecialZone) {
      return tileRectsForZone(zone);
    }

    function tileState(index: number, time: number) {
      return tileCollapseState(index, time, round);
    }

    function getRingCenters(zone: SpecialZone, time: number): RingPlatform[] {
      const scale = Math.min(1.42, zone.w / BASE_COURSE_WIDTH);
      const radius = 245 * scale;
      const center = zone.x + zone.w / 2, offset = 290 * scale;
      return [
        { x: center - offset, y: zone.y + 150, r: radius * 1.04, speed: .48 + zone.phase * .04, phase: zone.phase * .7, moveSpeed: .52, moveAmp: Math.min(190, zone.w * .07) },
        { x: center + offset, y: zone.y + 455, r: radius, speed: -.76 - zone.phase * .05, phase: 1.2 + zone.phase * .7, moveSpeed: .68, moveAmp: Math.min(220, zone.w * .08) },
        { x: center - offset, y: zone.y + 765, r: radius * 1.06, speed: 1.02 + zone.phase * .06, phase: 2.4 + zone.phase * .7, moveSpeed: .84, moveAmp: Math.min(190, zone.w * .07) },
        { x: center + offset, y: zone.y + 1060, r: radius, speed: -1.28 - zone.phase * .07, phase: 3.6 + zone.phase * .7, moveSpeed: 1.02, moveAmp: Math.min(220, zone.w * .08) },
      ].map((ring) => ({ ...ring, x: ring.x + Math.sin(time * ring.moveSpeed + ring.phase) * ring.moveAmp }));
    }

    function circleTouchesRect(x: number, y: number, radius: number, rect: { x: number; y: number; w: number; h: number }) {
      const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
      const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
      return Math.hypot(x - nearX, y - nearY) <= radius;
    }

    function getSupportingRing(time: number) {
      for (const zone of zones) {
        if (zone.kind !== "rings") continue;
        const ring = getRingCenters(zone, time).find((item) => Math.hypot(p.x - item.x, p.y - item.y) <= item.r + EDGE_SUPPORT);
        if (ring) return ring;
      }
      return null;
    }

    function getSpecialPitAtPlayer(time: number) {
      const zone = zones.find((item) => p.x > item.x && p.x < item.x + item.w && p.y > item.y && p.y < item.y + item.h);
      if (!zone) return isSurvival && survivalZone ? { x: survivalZone.x, y: survivalZone.y, w: survivalZone.w, h: survivalZone.h } : null;
      let safe = false;
      if (zone.kind === "tiles") {
        safe = getTileRects(zone).some((item) => !tileState(item.index, time).collapsed && circleTouchesRect(p.x, p.y, EDGE_SUPPORT, item));
      } else if (zone.kind === "rings") {
        safe = getRingCenters(zone, time).some((ring) => Math.hypot(p.x - ring.x, p.y - ring.y) <= ring.r + EDGE_SUPPORT);
      } else if (zone.kind === "arena") {
        safe = Math.hypot(p.x - (zone.x + zone.w / 2), p.y - (zone.y + zone.h / 2)) <= Math.min(zone.w, zone.h) * .43 + EDGE_SUPPORT;
      } else {
        safe = p.x >= zone.x - EDGE_SUPPORT && p.x <= zone.x + zone.w + EDGE_SUPPORT && p.y >= zone.y - EDGE_SUPPORT && p.y <= zone.y + zone.h + EDGE_SUPPORT;
      }
      return safe ? null : { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    }

    function getSweepRects(time: number): SweepRect[] {
      if (map.id !== "sweep" || !survivalZone || time < 2) return [];
      const rects: SweepRect[] = [];
      const cadence = 3.3;
      const currentWave = Math.floor((time - 2) / cadence);
      for (let wave = Math.max(0, currentWave - 3); wave <= currentWave; wave++) {
        const startAt = 2 + wave * cadence;
        const duration = Math.max(3.25, 6.2 - wave * .075);
        const copies = 1 + Math.min(2, Math.floor(wave / 9));
        for (let copy = 0; copy < copies; copy++) {
          const progress = (time - startAt - copy * .5) / duration;
          if (progress < 0 || progress > 1) continue;
          const direction = (wave + copy) % 4;
          const low = (wave + copy * 2) % 3 === 0;
          const gapSize = Math.max(210, Math.min(survivalZone.w, survivalZone.h) * Math.max(.14, .27 - wave * .004));
          const gapOffset = ((stableHash(`${round}:${wave}:${copy}`) % 1000) / 1000 - .5) * .42;
          const thickness = 92 + Math.min(55, wave * 2.4);
          const horizontalTravel = direction === 0 || direction === 2;
          if (horizontalTravel) {
            const from = direction === 0 ? survivalZone.x - thickness : survivalZone.x + survivalZone.w + thickness;
            const to = direction === 0 ? survivalZone.x + survivalZone.w + thickness : survivalZone.x - thickness;
            const x = from + (to - from) * progress;
            const gapCenter = survivalZone.y + survivalZone.h * (.5 + gapOffset);
            const vx = (to - from) / duration;
            if (low) rects.push({ x, y: survivalZone.y, w: thickness, h: survivalZone.h, low: true, color: "#ff4fa3", vx, vy: 0 });
            else {
              rects.push({ x, y: survivalZone.y, w: thickness, h: Math.max(0, gapCenter - gapSize / 2 - survivalZone.y), low: false, color: "#8f6cff", vx, vy: 0 });
              rects.push({ x, y: gapCenter + gapSize / 2, w: thickness, h: Math.max(0, survivalZone.y + survivalZone.h - gapCenter - gapSize / 2), low: false, color: "#8f6cff", vx, vy: 0 });
            }
          } else {
            const from = direction === 1 ? survivalZone.y - thickness : survivalZone.y + survivalZone.h + thickness;
            const to = direction === 1 ? survivalZone.y + survivalZone.h + thickness : survivalZone.y - thickness;
            const y = from + (to - from) * progress;
            const gapCenter = survivalZone.x + survivalZone.w * (.5 + gapOffset);
            const vy = (to - from) / duration;
            if (low) rects.push({ x: survivalZone.x, y, w: survivalZone.w, h: thickness, low: true, color: "#ffcf4d", vx: 0, vy });
            else {
              rects.push({ x: survivalZone.x, y, w: Math.max(0, gapCenter - gapSize / 2 - survivalZone.x), h: thickness, low: false, color: "#35dcff", vx: 0, vy });
              rects.push({ x: gapCenter + gapSize / 2, y, w: Math.max(0, survivalZone.x + survivalZone.w - gapCenter - gapSize / 2), h: thickness, low: false, color: "#35dcff", vx: 0, vy });
            }
          }
        }
      }
      return rects;
    }

    function getLaserBeams(time: number): LaserBeam[] {
      if (map.id !== "lava" || !survivalZone || time < 2.5) return [];
      const beams: LaserBeam[] = [];
      const cadence = 3.6;
      const wave = Math.floor((time - 2.5) / cadence);
      const centerX = survivalZone.x + survivalZone.w / 2, centerY = survivalZone.y + survivalZone.h / 2;
      const radius = Math.min(survivalZone.w, survivalZone.h) * .43;
      const count = 1 + Math.min(2, Math.floor(time / 22));
      for (let offset = 0; offset < count; offset++) {
        const startAt = 2.5 + (wave - offset) * cadence;
        const duration = Math.max(3, 5.8 - wave * .07);
        const progress = (time - startAt) / duration;
        if (progress < 0 || progress > 1) continue;
        const vertical = time > 24 && (wave - offset) % 2 !== 0;
        const reverse = (wave + offset) % 3 === 0;
        const t = reverse ? 1 - progress : progress;
        if (vertical) {
          const x = centerX - radius + radius * 2 * t;
          const chord = Math.sqrt(Math.max(0, radius * radius - (x - centerX) ** 2));
          beams.push({ x1: x, y1: centerY - chord, x2: x, y2: centerY + chord, vx: (reverse ? -1 : 1) * radius * 2 / duration, vy: 0, color: offset % 2 ? "#ffe14a" : "#ff3d9a" });
        } else {
          const y = centerY - radius + radius * 2 * t;
          const chord = Math.sqrt(Math.max(0, radius * radius - (y - centerY) ** 2));
          beams.push({ x1: centerX - chord, y1: y, x2: centerX + chord, y2: y, vx: 0, vy: (reverse ? -1 : 1) * radius * 2 / duration, color: offset % 2 ? "#35dcff" : "#ff375f" });
        }
      }
      return beams;
    }

    function hitDynamicHazards(time: number, now: number) {
      for (const rect of getSweepRects(time)) {
        if (rect.low && p.z > 46) continue;
        if (resolveRect({ ...rect, kind: "mover" }, rect.x, now)) {
          p.vx += rect.vx * .72; p.vy += rect.vy * .72;
          p.vz = Math.max(p.vz, rect.low ? 115 : 185);
        }
      }
      for (const laser of getLaserBeams(time)) {
        if (p.disintegrating || p.z > 58 || p.hitCd > 0 || segmentDistance(p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2) > PLAYER_R + 18) continue;
        p.disintegrating = true; p.disintegrateTime = 0; p.vx = 0; p.vy = 0; p.vz = 0; p.stun = 1; p.hitCd = 1;
        shake = 1.15; audio.collision(true);
        burst(p.x, p.y, laser.color, 24); burst(p.x, p.y, "#ffffff", 18); burst(p.x, p.y, "#ff3d9a", 14);
        showImpact("BỊ LASER LOẠI!", now);
        return;
      }
    }

    function beginFall(now: number, pit: Pit | null, edge = false) {
      if (p.falling) return;
      p.falling = true; p.fallTime = 0; p.fallPit = pit; p.fallEdge = edge; p.vx *= .28; p.vy *= .28; p.vz = -120;
      shake = .75; burst(p.x, p.y, "#ab7cff", 14); showImpact("RƠI XUỐNG VỰC!", now);
    }

    function respawn(now: number) {
      p.x = courseWidth / 2; p.y = p.checkpoint + 45; p.vx = 0; p.vy = 0; p.z = 0; p.vz = 0;
      p.falling = false; p.fallTime = 0; p.fallPit = null; p.fallEdge = false; p.stun = .55; p.hitCd = .8;
      p.disintegrating = false; p.disintegrateTime = 0;
      p.mana = 100; p.lastJump = -Infinity; p.dashCd = 0; p.dashTime = 0;
      cameraX = p.x; cameraY = p.y;
      progressCb.current(Math.min(99.8, p.y / COURSE * 100), p.x);
      audio.respawn();
      burst(p.x, p.y, "#8df6ff", 20); showImpact("HỒI SINH · MANA ĐẦY!", now);
    }

    function update(dt: number, now: number) {
      const remain = readyAt - now;
      if (remain > 0) { setCountdown(String(Math.ceil(remain / 1000))); return; }
      if (!start) {
        start = now;
        setCountdown("GO!");
        window.setTimeout(() => setCountdown(""), 520);
      }
      const raceSeconds = Math.max(0, (Date.now() - roundGoEpoch) / 1000);
      updateRemotePlayers(now, dt);
      p.stun = Math.max(0, p.stun - dt);
      p.hitCd = Math.max(0, p.hitCd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.dashTime = Math.max(0, p.dashTime - dt);

      if (p.disintegrating) {
        p.disintegrateTime += dt;
        if (p.disintegrateTime >= .48 && !eliminationSent) {
          eliminationSent = true; finished = true;
          eliminateCb.current(Math.max(0, Date.now() - roundGoEpoch));
        }
      } else if (p.falling) {
        p.fallTime += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.z -= (260 + p.fallTime * 520) * dt;
        if (p.fallTime >= 1.05) {
          if (isSurvival) {
            if (!eliminationSent) { eliminationSent = true; finished = true; eliminateCb.current(Math.max(0, Date.now() - roundGoEpoch)); }
          } else respawn(now);
        }
      } else {

        let ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + input.current.x;
        let iy = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) + input.current.y;
        const inputLength = Math.hypot(ix, iy);
        if (inputLength > 1) { ix /= inputLength; iy /= inputLength; }
        if (input.current.jump && p.z <= 1 && p.stun <= .2) {
          if (p.mana >= 25) {
            p.vz = JUMP_SPEED;
            p.mana -= 25;
            p.lastJump = now;
            audio.jump();
            burst(p.x, p.y, "#8df6ff", 7);
          } else {
            showImpact("HẾT MANA!", now);
          }
        }
        input.current.jump = false;
        if (input.current.dash && p.dashCd <= 0 && p.stun <= .2) { p.dashTime = .35; p.dashCd = 3; audio.boost(); burst(p.x, p.y - 25, map.accent, 9); }
        input.current.dash = false;
        if (now - p.lastJump > 900 && p.mana < 100) p.mana = Math.min(100, p.mana + 8.5 * dt);

        const control = p.stun > 0 ? .1 : 1;
        const acceleration = 1280 * control;
        const maxSpeed = p.dashTime > 0 ? 850 : (map.id === "ice" ? 420 : 365);
        p.vx += ix * acceleration * dt;
        p.vy += iy * acceleration * dt;
        const friction = Math.pow(map.id === "ice" ? .34 : .055, dt);
        p.vx *= friction; p.vy *= friction;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > maxSpeed) { p.vx = p.vx / speed * maxSpeed; p.vy = p.vy / speed * maxSpeed; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vz -= GRAVITY * dt; p.z += p.vz * dt;
        if (p.z < 0) { p.z = 0; p.vz = 0; }
        p.y = Math.max(-120, p.y);

        if (map.id === "sky" && p.z <= 2) {
          const ring = getSupportingRing(raceSeconds);
          if (ring) {
            const dx = p.x - ring.x, dy = p.y - ring.y;
            // Canvas Y points down while world Y points forward/up on screen.
            // Invert the angular velocity so physical carry matches the visible spin.
            const surfaceSpin = -ring.speed;
            const angle = surfaceSpin * dt * .82;
            const cosine = Math.cos(angle), sine = Math.sin(angle);
            p.x = ring.x + dx * cosine - dy * sine;
            p.y = ring.y + dx * sine + dy * cosine;
            p.x += Math.cos(raceSeconds * ring.moveSpeed + ring.phase) * ring.moveAmp * ring.moveSpeed * dt;
            p.vx += -dy * surfaceSpin * dt * .24 + Math.cos(raceSeconds * ring.moveSpeed + ring.phase) * ring.moveAmp * ring.moveSpeed * dt;
            p.vy += dx * surfaceSpin * dt * .24;
          }
        }

        if (map.id === "ice" && p.z <= 2) {
          const bridge = getSupportingBridge(raceSeconds);
          if (bridge) {
            const carry = Math.cos(raceSeconds * bridge.speed + bridge.phase) * bridge.amp * bridge.speed;
            p.x += carry * dt;
            p.vx += carry * dt * .3;
          }
        }

        if (map.start === "tiles" && survivalZone) {
          const minX = survivalZone.x + PLAYER_R, maxX = survivalZone.x + survivalZone.w - PLAYER_R;
          const minY = survivalZone.y + PLAYER_R, maxY = survivalZone.y + survivalZone.h - PLAYER_R;
          if (p.x < minX || p.x > maxX) { p.x = Math.max(minX, Math.min(maxX, p.x)); p.vx *= -.28; }
          if (p.y < minY || p.y > maxY) { p.y = Math.max(minY, Math.min(maxY, p.y)); p.vy *= -.28; }
        }

        for (let pass = 0; pass < 2; pass++) {
          for (const obstacle of obstacles) {
            if (Math.abs(p.y - obstacle.y) > 210) continue;
            const obstacleX = movingX(obstacle, raceSeconds);
            if (obstacle.kind === "pad") {
              if (pass === 0 && p.x > obstacleX && p.x < obstacleX + obstacle.w && p.y > obstacle.y && p.y < obstacle.y + obstacle.h && p.z < 18) {
                p.vy = Math.max(p.vy, 790); p.vz = 130; burst(p.x, p.y, obstacle.color, 10); showImpact("BOOST!", now);
              }
            } else if (obstacle.kind === "bumper") {
              if (pass === 0) hitBumper(obstacle, obstacleX, now);
            } else resolveRect(obstacle, obstacleX, now);
          }
        }

        for (const spinner of spinners) {
          if (Math.abs(p.y - spinner.y) > spinner.len + 60 || p.hitCd > 0) continue;
          const angle = raceSeconds * spinner.speed + spinner.phase;
          const dx = Math.cos(angle) * spinner.len, dy = Math.sin(angle) * spinner.len;
          if (p.z < 60 && segmentDistance(p.x, p.y, spinner.x - dx, spinner.y - dy, spinner.x + dx, spinner.y + dy) < PLAYER_R + 17) {
            const direction = Math.sign(Math.cos(angle) * (p.y - spinner.y) - Math.sin(angle) * (p.x - spinner.x)) || 1;
            p.vx = Math.cos(angle + Math.PI / 2) * direction * 760;
            p.vy = Math.sin(angle + Math.PI / 2) * direction * 560 - 180;
            p.vz = 220; p.stun = .7; p.hitCd = .38; shake = 1;
            audio.collision(true);
            burst(p.x, p.y, spinner.color, 18); showImpact("VĂNG RA!", now);
          }
        }
        hitDynamicHazards(raceSeconds, now);
        if (!p.disintegrating) {
          collideWithPlayers(now);

          for (let index = isSurvival ? 0 : checkpoints.length - 1; index >= 1; index--) {
            if (p.y >= checkpoints[index] && index > p.checkpointIndex) {
              p.checkpointIndex = index; p.checkpoint = checkpoints[index];
              audio.checkpoint();
              burst(p.x, p.y, "#45f4ff", 18); showImpact(`CHECKPOINT ${index}!`, now);
              break;
            }
          }
          const activePit = p.z < 48 ? getPitAtPlayer(raceSeconds) ?? getSpecialPitAtPlayer(raceSeconds) : null;
          const fellLeft = p.x < -PLAYER_R * 1.5, fellRight = p.x > courseWidth + PLAYER_R * 1.5, fellBack = p.y < -80;
          const edgePit = fellLeft
            ? { x: -courseWidth, y: p.y - 700, w: courseWidth, h: 1400 }
            : fellRight
              ? { x: courseWidth, y: p.y - 700, w: courseWidth, h: 1400 }
              : fellBack
                ? { x: 0, y: -1200, w: courseWidth, h: 1200 }
                : null;
          if (edgePit || activePit) beginFall(now, activePit ?? edgePit, Boolean(edgePit));
        }
      }

      if (![p.x, p.y, p.vx, p.vy, p.z, p.vz].every(Number.isFinite)) respawn(now);
      const cameraFollow = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * dt);
      cameraX += (p.x - cameraX) * cameraFollow;
      cameraY += (p.y - cameraY) * cameraFollow;

      for (const particle of particles) {
        particle.x += particle.vx * dt; particle.y += particle.vy * dt;
        particle.vx *= .92; particle.vy *= .92; particle.life -= dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      shake = Math.max(0, shake - dt * 3.4);

      const progress = Math.max(0, Math.min(100, p.y / COURSE * 100));
      const syncDelay = playersRef.current.length > 100 ? 700 : playersRef.current.length > 50 ? 500 : 300;
      if (now - lastSync > syncDelay) { lastSync = now; progressCb.current(progress, p.x); }
      if (now - lastUi > 80) {
        lastUi = now;
        setLocalProgress(progress); setDash(Math.max(0, (1 - p.dashCd / 3) * 100)); setMana(p.mana); setElapsed(Math.max(0, Date.now() - roundGoEpoch));
      }
      if (!isSurvival && p.y >= COURSE && !finished) { finished = true; progressCb.current(100, p.x); finishCb.current(Math.max(0, Date.now() - roundGoEpoch)); }
    }

    function hash(value: string) {
      return [...value].reduce((result, char) => ((result * 31 + char.charCodeAt(0)) >>> 0), 7);
    }

    function draw(now: number) {
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const survivalFit = survivalZone ? Math.min(w / (survivalZone.w + 220), h / (survivalZone.h + 260)) : .4;
      const raceFit = w / (courseWidth + 160);
      const baseScale = isSurvival
        ? Math.max(.42, Math.min(.9, survivalFit * 1.42))
        : Math.max(.42, Math.min(.9, raceFit * 1.08));
      renderScale = baseScale;
      const playerScreenY = isSurvival ? h * .52 : h * .72;
      const raceSeconds = Math.max(0, (Date.now() - roundGoEpoch) / 1000);
      const sy = (worldY: number) => playerScreenY - (worldY - cameraY) * baseScale;
      const perspective = (_worldY: number) => 1;
      const sx = (worldX: number, _worldY: number) => w / 2 + (worldX - cameraX) * baseScale;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - .5) * shake * 14, (Math.random() - .5) * shake * 10);
      drawWorld(ctx, w, h, now, cameraY, baseScale, sx, sy, perspective);

      for (const zone of zones) {
        const zoneStart = sy(zone.y);
        const zoneEnd = sy(zone.y + zone.h);
        if (Math.max(zoneStart, zoneEnd) < -200 || Math.min(zoneStart, zoneEnd) > h + 200) continue;
        drawSpecialZone(ctx, zone, raceSeconds, sx, sy, perspective, now);
      }

      for (const pit of [...pits].sort((a, b) => b.y - a.y)) {
        const pitStart = sy(pit.y);
        const pitEnd = sy(pit.y + pit.h);
        // Long Ice Drift abysses may straddle the camera after the player has
        // crossed them. Cull only when both ends are completely off-screen.
        if (Math.max(pitStart, pitEnd) < -220 || Math.min(pitStart, pitEnd) > h + 220) continue;
        drawPit(ctx, pit, sx, sy, perspective, now);
      }

      if (p.falling) {
        const fallScale = Math.max(.06, 1 - p.fallTime * 1.15);
        const fallAlpha = Math.max(.04, 1 - p.fallTime * 1.08);
        const fallDrop = Math.min(h * .88, p.fallTime * p.fallTime * 620 + p.fallTime * 70);
        const playerScale = 35 * baseScale * fallScale;
        const playerY = sy(p.y) + fallDrop;
        ctx.save();
        if (p.fallPit) clipPit(ctx, p.fallPit, sx, sy);
        drawBean(ctx, sx(p.x, p.y), playerY, playerScale, me.color, me.name, fallAlpha, raceSeconds, true, p.stun);
        ctx.restore();

        // Repaint solid platforms after the falling bean so the character truly
        // travels behind the floor instead of floating over it.
        for (const zone of zones) {
          const zoneStart = sy(zone.y), zoneEnd = sy(zone.y + zone.h);
          if (Math.max(zoneStart, zoneEnd) < -200 || Math.min(zoneStart, zoneEnd) > h + 200) continue;
          drawSpecialZone(ctx, zone, raceSeconds, sx, sy, perspective, now, false);
        }
        if (p.fallPit && !p.fallEdge) drawPitRim(ctx, p.fallPit, sx, sy, perspective);
      }

      for (const bridge of bridges) {
        const y = sy(bridge.y);
        if (y < -180 || y > h + 180) continue;
        drawBox(ctx, { ...bridge, kind: "block", icePlatform: true }, bridgeX(bridge, raceSeconds), sx, sy, perspective);
      }

      const sortedObstacles = [...obstacles].sort((a, b) => b.y - a.y);
      for (const obstacle of sortedObstacles) {
        const y = sy(obstacle.y);
        if (y < -130 || y > h + 160) continue;
        const obstacleX = movingX(obstacle, raceSeconds);
        if (obstacle.kind === "bumper") drawBumper(ctx, obstacle, obstacleX, sx, sy, perspective, now);
        else if (obstacle.kind === "pad") drawPad(ctx, obstacle, obstacleX, sx, sy, perspective);
        else drawBox(ctx, obstacle, obstacleX, sx, sy, perspective);
      }

      for (const spinner of [...spinners].sort((a, b) => b.y - a.y)) {
        const y = sy(spinner.y);
        if (y < -350 || y > h + 350) continue;
        drawSpinner(ctx, spinner, raceSeconds, sx, sy, perspective);
      }

      for (const hazard of getSweepRects(raceSeconds)) {
        drawBox(ctx, { ...hazard, kind: "mover" }, hazard.x, sx, sy, perspective);
      }
      for (const laser of getLaserBeams(raceSeconds)) drawLaser(ctx, laser, sx, sy, baseScale, now);

      const visiblePlayers = playersRef.current
        .filter((other) => other.id !== me.id && !other.finishPosition)
        .map((other) => {
          const remote = remoteStates.get(other.id);
          return { ...other, worldY: remote?.y ?? other.progress / 100 * COURSE, worldX: remote?.x ?? other.positionX ?? 150 + hash(other.id) % (courseWidth - 300) };
        })
        .filter((other) => sy(other.worldY) > -90 && sy(other.worldY) < h + 100)
        .sort((a, b) => b.worldY - a.worldY);
      for (const other of visiblePlayers) {
        const scale = 35 * baseScale;
        drawBean(ctx, sx(other.worldX, other.worldY), sy(other.worldY), scale, other.color, other.name, .9, raceSeconds, false, 0);
      }

      for (const particle of particles) {
        const y = sy(particle.y);
        if (y < -20 || y > h + 20) continue;
        ctx.globalAlpha = Math.max(0, particle.life * 1.8);
        ctx.fillStyle = particle.color;
        ctx.beginPath(); ctx.arc(sx(particle.x, particle.y), y, 3 + particle.life * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!p.falling && !p.disintegrating) drawBean(ctx, sx(p.x, p.y), sy(p.y) - p.z * baseScale, 35 * baseScale, me.color, me.name, 1, raceSeconds, true, p.stun);
      ctx.restore();

    }

    function drawWorld(
      context: CanvasRenderingContext2D, w: number, h: number, now: number, cameraY: number, baseScale: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const sky = context.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, map.sky); sky.addColorStop(.55, colorMix(map.sky, "#ffffff", .13)); sky.addColorStop(1, "#170a39");
      context.fillStyle = sky; context.fillRect(0, 0, w, h);
      drawScenery(context, w, h, now, cameraY, sx, sy, perspective);
      if (isSurvival) return;

      const topLeft = sx(0, cameraY + h / baseScale * 1.2), topRight = sx(courseWidth, cameraY + h / baseScale * 1.2);
      const bottomLeft = sx(0, cameraY - h / baseScale * .35), bottomRight = sx(courseWidth, cameraY - h / baseScale * .35);
      const roadGradient = context.createLinearGradient(0, 0, 0, h);
      roadGradient.addColorStop(0, colorMix(map.floor, "#ffffff", .12)); roadGradient.addColorStop(1, colorMix(map.floor, "#000000", .1));
      context.fillStyle = roadGradient;
      context.beginPath(); context.moveTo(topLeft, 0); context.lineTo(topRight, 0); context.lineTo(bottomRight, h); context.lineTo(bottomLeft, h); context.closePath(); context.fill();

      const firstGrid = Math.floor((cameraY - 700) / 250) * 250;
      for (let worldY = firstGrid; worldY < cameraY + 2300; worldY += 250) {
        const y = sy(worldY); if (y < 0 || y > h) continue;
        context.globalAlpha = .11; context.strokeStyle = "#ffffff"; context.lineWidth = Math.max(1, 4 * perspective(worldY));
        context.beginPath(); context.moveTo(sx(0, worldY), y); context.lineTo(sx(courseWidth, worldY), y); context.stroke();
      }
      context.globalAlpha = .08;
      for (const laneX of [courseWidth / 3, courseWidth * 2 / 3]) {
        context.strokeStyle = "#ffffff"; context.lineWidth = 3;
        context.beginPath(); context.moveTo(sx(laneX, cameraY + 2400), 0); context.lineTo(sx(laneX, cameraY - 600), h); context.stroke();
      }
      context.globalAlpha = 1;

      context.strokeStyle = map.accent; context.lineWidth = 13; context.lineCap = "round";
      context.beginPath(); context.moveTo(topLeft, 0); context.lineTo(bottomLeft, h); context.moveTo(topRight, 0); context.lineTo(bottomRight, h); context.stroke();
      context.strokeStyle = "rgba(255,255,255,.35)"; context.lineWidth = 3;
      context.beginPath(); context.moveTo(topLeft + 8, 0); context.lineTo(bottomLeft + 8, h); context.moveTo(topRight - 8, 0); context.lineTo(bottomRight - 8, h); context.stroke();

      if (map.start === "line") drawCheckeredLine(context, START_LINE, "XUẤT PHÁT", sx, sy, perspective);
      drawCheckeredLine(context, COURSE, "VỀ ĐÍCH", sx, sy, perspective);
      for (let index = 1; index < checkpoints.length; index++) {
        drawCheckpointLine(context, checkpoints[index], index, sx, sy, perspective);
      }

      const firstPost = Math.floor((cameraY - 600) / 320) * 320;
      for (let worldY = firstPost; worldY < cameraY + 2300; worldY += 320) {
        const y = sy(worldY); if (y < -20 || y > h + 20) continue;
        const postSize = 9 * perspective(worldY);
        for (const x of [0, courseWidth]) {
          context.fillStyle = worldY / 320 % 2 ? map.accent : "#ffffff";
          context.beginPath(); context.arc(sx(x, worldY), y, postSize, 0, Math.PI * 2); context.fill();
        }
      }
    }

    function drawCheckpointLine(
      context: CanvasRenderingContext2D, worldY: number, index: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const y = sy(worldY); if (y < -50 || y > canvas!.getBoundingClientRect().height + 50) return;
      const left = sx(0, worldY), right = sx(courseWidth, worldY), height = Math.max(7, 17 * perspective(worldY));
      const gradient = context.createLinearGradient(left, 0, right, 0);
      gradient.addColorStop(0, "#45f4ff"); gradient.addColorStop(.5, "#ffffff"); gradient.addColorStop(1, "#45f4ff");
      context.fillStyle = gradient; context.fillRect(left, y - height / 2, right - left, height);
      context.font = `900 ${Math.max(8, 12 * perspective(worldY))}px system-ui`;
      context.textAlign = "center"; context.fillStyle = "#ffffff"; context.strokeStyle = "#14234c"; context.lineWidth = 4;
      context.strokeText(`CHECKPOINT ${index}`, (left + right) / 2, y - height - 5);
      context.fillText(`CHECKPOINT ${index}`, (left + right) / 2, y - height - 5);
    }

    function drawPit(
      context: CanvasRenderingContext2D, pit: Pit,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number, now: number,
    ) {
      const x1 = sx(pit.x, pit.y), x2 = sx(pit.x + pit.w, pit.y);
      const x3 = sx(pit.x + pit.w, pit.y + pit.h), x4 = sx(pit.x, pit.y + pit.h);
      const y1 = sy(pit.y), y2 = sy(pit.y + pit.h);
      const glow = .34 + Math.sin(now * .004 + pit.y) * .08;
      context.save();
      context.shadowColor = "#8e50ff"; context.shadowBlur = 18 * perspective(pit.y);
      context.fillStyle = "#100621"; context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y1); context.lineTo(x3, y2); context.lineTo(x4, y2); context.closePath(); context.fill();
      context.shadowBlur = 0; context.strokeStyle = `rgba(190,130,255,${glow})`; context.lineWidth = Math.max(2, 7 * perspective(pit.y)); context.stroke();
      context.fillStyle = "rgba(180,100,255,.17)";
      for (let i = 0; i < 3; i++) {
        const t = (i + 1) / 4, yy = y1 + (y2 - y1) * t;
        context.fillRect(x1 + (x4 - x1) * t + 10, yy, Math.max(0, (x2 + (x3 - x2) * t) - (x1 + (x4 - x1) * t) - 20), 3);
      }
      context.restore();
    }

    function drawSpecialZone(
      context: CanvasRenderingContext2D, zone: SpecialZone, time: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number, now: number,
      includePit = true,
    ) {
      if (includePit) drawPit(context, { x: zone.x, y: zone.y, w: zone.w, h: zone.h }, sx, sy, perspective, now);
      if (zone.kind === "tiles") {
        for (const tile of getTileRects(zone)) {
          const { collapsed, warning } = tileState(tile.index, time);
          const left = sx(tile.x, tile.y), right = sx(tile.x + tile.w, tile.y);
          const nearY = sy(tile.y), farY = sy(tile.y + tile.h);
          context.save(); context.globalAlpha = collapsed ? .13 : 1;
          context.fillStyle = collapsed ? "#2a1134" : warning ? "#ff5a67" : (tile.index % 2 ? "#60d98d" : "#a4f06b");
          context.fillRect(left, farY, right - left, nearY - farY);
          context.strokeStyle = collapsed ? "#a85bba" : "rgba(255,255,255,.7)"; context.lineWidth = Math.max(2, 4 * renderScale); context.strokeRect(left, farY, right - left, nearY - farY);
          if (warning && !collapsed) {
            context.fillStyle = "rgba(255,255,255,.72)"; context.font = `900 ${Math.max(10, 18 * renderScale)}px system-ui`; context.textAlign = "center";
            context.fillText("!", (left + right) / 2, (nearY + farY) / 2 + 6);
          }
          context.restore();
        }
        const left = sx(zone.x, zone.y), right = sx(zone.x + zone.w, zone.y);
        const top = sy(zone.y + zone.h), bottom = sy(zone.y);
        context.save();
        context.strokeStyle = "#ffe14a"; context.lineWidth = Math.max(7, 20 * renderScale); context.shadowColor = "#ffb238"; context.shadowBlur = 18;
        context.strokeRect(left, top, right - left, bottom - top);
        context.shadowBlur = 0; context.strokeStyle = "rgba(255,255,255,.72)"; context.lineWidth = Math.max(2, 5 * renderScale);
        context.strokeRect(left + 7, top + 7, right - left - 14, bottom - top - 14);
        context.restore();
      } else if (zone.kind === "rings") {
        for (const [index, ring] of getRingCenters(zone, time).entries()) {
          const x = sx(ring.x, ring.y), y = sy(ring.y), radius = ring.r * renderScale;
          context.fillStyle = "rgba(5,10,40,.45)"; context.beginPath(); context.arc(x + 8, y + 10, radius, 0, Math.PI * 2); context.fill();
          const gradient = context.createRadialGradient(x - radius * .25, y - radius * .3, 5, x, y, radius);
          gradient.addColorStop(0, "#d8f9ff"); gradient.addColorStop(.46, index % 2 ? "#46bce8" : "#715df3"); gradient.addColorStop(1, "#253484");
          context.fillStyle = gradient; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
          context.strokeStyle = index % 2 ? "#ffe14a" : "#ffffff"; context.lineWidth = Math.max(3, 9 * renderScale); context.stroke();
          context.save(); context.translate(x, y); context.rotate(time * ring.speed + ring.phase);
          context.strokeStyle = "rgba(255,255,255,.34)"; context.lineWidth = Math.max(2, 4 * renderScale); context.lineCap = "round";
          for (let spoke = 0; spoke < 8; spoke++) {
            context.rotate(Math.PI / 4); context.beginPath(); context.moveTo(radius * .2, 0); context.lineTo(radius * .78, 0); context.stroke();
          }
          context.strokeStyle = "rgba(255,225,74,.72)"; context.lineWidth = Math.max(2, 5 * renderScale);
          context.beginPath(); context.arc(0, 0, radius * .58, -.75, .75); context.stroke();
          context.restore();
          context.fillStyle = "rgba(255,255,255,.88)"; context.beginPath(); context.arc(x, y, Math.max(5, radius * .09), 0, Math.PI * 2); context.fill();
        }
      } else if (zone.kind === "arena") {
        const cx = sx(zone.x + zone.w / 2, zone.y + zone.h / 2), cy = sy(zone.y + zone.h / 2), radius = Math.min(zone.w, zone.h) * .43 * renderScale;
        const gradient = context.createRadialGradient(cx - radius * .25, cy - radius * .3, 10, cx, cy, radius);
        gradient.addColorStop(0, "#ffb13b"); gradient.addColorStop(.62, "#d44a32"); gradient.addColorStop(1, "#68152a");
        context.fillStyle = "rgba(15,2,18,.5)"; context.beginPath(); context.arc(cx + 10, cy + 12, radius, 0, Math.PI * 2); context.fill();
        context.fillStyle = gradient; context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.fill();
        context.strokeStyle = "#ffdd42"; context.lineWidth = Math.max(4, 11 * renderScale); context.stroke();
        context.strokeStyle = "rgba(255,255,255,.22)"; context.lineWidth = Math.max(2, 4 * renderScale);
        for (const fraction of [.35, .68]) { context.beginPath(); context.arc(cx, cy, radius * fraction, 0, Math.PI * 2); context.stroke(); }
      } else {
        const left = sx(zone.x, zone.y), right = sx(zone.x + zone.w, zone.y);
        const top = sy(zone.y + zone.h), bottom = sy(zone.y);
        const gradient = context.createLinearGradient(left, top, right, bottom);
        gradient.addColorStop(0, "#34227f"); gradient.addColorStop(.5, "#6c4cff"); gradient.addColorStop(1, "#271264");
        context.fillStyle = gradient; context.fillRect(left, top, right - left, bottom - top);
        context.strokeStyle = "#ff56a9"; context.lineWidth = Math.max(6, 16 * renderScale); context.strokeRect(left, top, right - left, bottom - top);
        context.strokeStyle = "rgba(255,255,255,.13)"; context.lineWidth = 2;
        const cells = Math.max(8, Math.round(zone.w / 180));
        for (let index = 1; index < cells; index++) {
          const x = left + (right - left) * index / cells, y = top + (bottom - top) * index / cells;
          context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
        }
      }
    }

    function clipPit(
      context: CanvasRenderingContext2D, pit: Pit,
      sx: (x: number, y: number) => number, sy: (y: number) => number,
    ) {
      context.beginPath();
      context.moveTo(sx(pit.x, pit.y), sy(pit.y));
      context.lineTo(sx(pit.x + pit.w, pit.y), sy(pit.y));
      context.lineTo(sx(pit.x + pit.w, pit.y + pit.h), sy(pit.y + pit.h));
      context.lineTo(sx(pit.x, pit.y + pit.h), sy(pit.y + pit.h));
      context.closePath(); context.clip();
    }

    function drawPitRim(
      context: CanvasRenderingContext2D, pit: Pit,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const y = sy(pit.y), left = sx(pit.x, pit.y), right = sx(pit.x + pit.w, pit.y);
      context.strokeStyle = "#08020f"; context.lineWidth = Math.max(8, 16 * perspective(pit.y));
      context.beginPath(); context.moveTo(left, y + 3); context.lineTo(right, y + 3); context.stroke();
      context.strokeStyle = "rgba(194,137,255,.88)"; context.lineWidth = Math.max(2, 4 * perspective(pit.y));
      context.beginPath(); context.moveTo(left, y - 3); context.lineTo(right, y - 3); context.stroke();
    }

    function drawScenery(
      context: CanvasRenderingContext2D, w: number, h: number, now: number, cameraY: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      context.globalAlpha = .18;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 283 + now * .008) % (w + 240)) - 120;
        const y = 70 + (i % 3) * 95;
        context.fillStyle = "#ffffff"; context.beginPath(); context.ellipse(x, y, 60 + i % 2 * 30, 18, 0, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 1;
      const first = Math.floor((cameraY - 400) / 430) * 430;
      for (let worldY = first; worldY < cameraY + 2500; worldY += 430) {
        const y = sy(worldY); if (y < -80 || y > h + 100) continue;
        const size = 36 * perspective(worldY);
        for (const side of [-1, 1]) {
          const x = sx(side < 0 ? -145 : courseWidth + 145, worldY);
          if (map.id === "jungle") {
            context.fillStyle = "#174d3e"; context.fillRect(x - size * .12, y, size * .24, size * 1.25);
            context.fillStyle = "#55dd88"; context.beginPath(); context.arc(x, y - size * .25, size * .65, 0, Math.PI * 2); context.fill();
          } else if (map.id === "ice") {
            context.fillStyle = "#c9f7ff"; context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size * .45, y + size * .4); context.lineTo(x - size * .35, y + size * .25); context.closePath(); context.fill();
          } else if (map.id === "lava") {
            context.fillStyle = "#54202b"; context.beginPath(); context.arc(x, y, size * .55, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#ff7b35"; context.lineWidth = 3; context.stroke();
          } else {
            context.fillStyle = colorMix(map.accent, "#ffffff", .12); context.beginPath(); context.arc(x, y, size * .55, 0, Math.PI * 2); context.fill();
          }
        }
      }
    }

    function drawCheckeredLine(
      context: CanvasRenderingContext2D, worldY: number, label: string,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const y = sy(worldY); if (y < -60 || y > canvas!.getBoundingClientRect().height + 60) return;
      const left = sx(0, worldY), right = sx(courseWidth, worldY), cells = 18, cellWidth = (right - left) / cells;
      const cellHeight = 34 * perspective(worldY);
      for (let row = 0; row < 2; row++) for (let column = 0; column < cells; column++) {
        context.fillStyle = (row + column) % 2 ? "#ffffff" : "#1c0a3e";
        context.fillRect(left + column * cellWidth, y + row * cellHeight, cellWidth + 1, cellHeight + 1);
      }
      context.font = `900 ${Math.max(8, 13 * perspective(worldY))}px system-ui`;
      context.textAlign = "center"; context.fillStyle = "#ffffff"; context.strokeStyle = "#17082f"; context.lineWidth = 4;
      context.strokeText(label, (left + right) / 2, y - 10); context.fillText(label, (left + right) / 2, y - 10);
    }

    function drawBox(
      context: CanvasRenderingContext2D, obstacle: Obstacle, obstacleX: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const scale = perspective(obstacle.y);
      const left = sx(obstacleX, obstacle.y), right = sx(obstacleX + obstacle.w, obstacle.y);
      const nearY = sy(obstacle.y), farY = sy(obstacle.y + obstacle.h);
      const highSweepWall = map.id === "sweep" && obstacle.kind === "mover" && obstacle.low === false;
      const rise = obstacle.icePlatform
        ? Math.max(12, 25 * renderScale)
        : obstacle.low
        ? Math.max(10, 18 * renderScale)
        : highSweepWall
          ? Math.max(42, 160 * renderScale)
          : Math.max(26, 56 * renderScale);
      const topColor = colorMix(obstacle.color, "#ffffff", .28), sideColor = colorMix(obstacle.color, "#000000", .23);
      context.fillStyle = "rgba(13,4,38,.28)";
      context.fillRect(left + 7, farY + 7, Math.max(0, right - left), Math.max(5, nearY - farY));
      context.fillStyle = obstacle.color;
      context.beginPath(); context.moveTo(left, nearY); context.lineTo(right, nearY); context.lineTo(right, nearY - rise); context.lineTo(left, nearY - rise); context.closePath(); context.fill();
      context.fillStyle = sideColor;
      context.beginPath(); context.moveTo(right, nearY); context.lineTo(right, farY); context.lineTo(right, farY - rise); context.lineTo(right, nearY - rise); context.closePath(); context.fill();
      context.fillStyle = topColor;
      context.beginPath(); context.moveTo(left, nearY - rise); context.lineTo(right, nearY - rise); context.lineTo(right, farY - rise); context.lineTo(left, farY - rise); context.closePath(); context.fill();
      context.strokeStyle = "rgba(255,255,255,.72)"; context.lineWidth = Math.max(2, 3 * renderScale);
      context.strokeRect(left, farY - rise, Math.max(0, right - left), Math.max(0, nearY - farY));
      context.fillStyle = "rgba(255,255,255,.38)"; context.fillRect(left + 10 * scale, nearY - rise + 8 * scale, Math.max(0, right - left - 20 * scale), 6 * scale);
      if (obstacle.icePlatform) {
        context.save();
        context.lineJoin = "round";
        context.strokeStyle = "#ffffff";
        context.lineWidth = Math.max(3, 7 * renderScale);
        context.shadowColor = "#35dcff";
        context.shadowBlur = 9;
        context.beginPath();
        context.moveTo(left, nearY - rise);
        context.lineTo(right, nearY - rise);
        context.lineTo(right, farY - rise);
        context.lineTo(left, farY - rise);
        context.closePath();
        context.stroke();
        context.restore();
      }
      if (highSweepWall) {
        context.save();
        context.globalAlpha = .42;
        context.strokeStyle = "#ffffff";
        context.lineWidth = Math.max(2, 5 * renderScale);
        const stripeCount = Math.max(2, Math.min(7, Math.floor((right - left) / 34)));
        for (let index = 1; index <= stripeCount; index++) {
          const stripeX = left + (right - left) * index / (stripeCount + 1);
          context.beginPath();
          context.moveTo(stripeX - 7 * scale, nearY - 7 * scale);
          context.lineTo(stripeX + 7 * scale, nearY - rise + 9 * scale);
          context.stroke();
        }
        context.restore();
      }
      if (obstacle.kind === "mover") {
        context.fillStyle = "#ffffff"; context.font = `900 ${Math.max(8, 17 * scale)}px system-ui`; context.textAlign = "center"; context.fillText("⇆", (left + right) / 2, nearY - rise * .35);
      }
    }

    function drawLaser(
      context: CanvasRenderingContext2D, laser: LaserBeam,
      sx: (x: number, y: number) => number, sy: (y: number) => number, scale: number, now: number,
    ) {
      const x1 = sx(laser.x1, laser.y1), y1 = sy(laser.y1), x2 = sx(laser.x2, laser.y2), y2 = sy(laser.y2);
      context.save();
      context.lineCap = "round"; context.shadowColor = laser.color; context.shadowBlur = 22 + Math.sin(now * .01) * 5;
      context.strokeStyle = laser.color; context.lineWidth = Math.max(8, 20 * scale);
      context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
      context.shadowBlur = 0; context.strokeStyle = "rgba(255,255,255,.92)"; context.lineWidth = Math.max(2, 5 * scale);
      context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
      context.fillStyle = "#ffffff";
      for (const [x, y] of [[x1, y1], [x2, y2]]) { context.beginPath(); context.arc(x, y, Math.max(5, 12 * scale), 0, Math.PI * 2); context.fill(); }
      context.restore();
    }

    function drawBumper(
      context: CanvasRenderingContext2D, obstacle: Obstacle, obstacleX: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number, now: number,
    ) {
      const scale = perspective(obstacle.y), radius = obstacle.w / 2 * basePixel(scale);
      const x = sx(obstacleX + obstacle.w / 2, obstacle.y), y = sy(obstacle.y + obstacle.h / 2);
      const pulse = 1 + Math.sin(now * .006 + (obstacle.phase ?? 0)) * .05;
      context.fillStyle = "rgba(12,4,35,.28)"; context.beginPath(); context.ellipse(x + 5, y + radius * .62, radius * 1.05, radius * .34, 0, 0, Math.PI * 2); context.fill();
      const gradient = context.createRadialGradient(x - radius * .28, y - radius * .35, 2, x, y, radius * pulse);
      gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.22, colorMix(obstacle.color, "#ffffff", .25)); gradient.addColorStop(1, colorMix(obstacle.color, "#000000", .22));
      context.fillStyle = gradient; context.beginPath(); context.arc(x, y, radius * pulse, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "rgba(255,255,255,.8)"; context.lineWidth = Math.max(2, radius * .13); context.stroke();
      context.fillStyle = "#ffffff"; context.beginPath(); context.arc(x, y, radius * .22, 0, Math.PI * 2); context.fill();
    }

    function basePixel(scale: number) { return renderScale * scale; }

    function drawPad(
      context: CanvasRenderingContext2D, obstacle: Obstacle, obstacleX: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const left = sx(obstacleX, obstacle.y), right = sx(obstacleX + obstacle.w, obstacle.y);
      const farY = sy(obstacle.y + obstacle.h), nearY = sy(obstacle.y), scale = perspective(obstacle.y);
      context.fillStyle = obstacle.color; context.beginPath(); context.moveTo(left, nearY); context.lineTo(right, nearY); context.lineTo(sx(obstacleX + obstacle.w, obstacle.y + obstacle.h), farY); context.lineTo(sx(obstacleX, obstacle.y + obstacle.h), farY); context.closePath(); context.fill();
      context.strokeStyle = "#ffffff"; context.lineWidth = Math.max(2, 4 * scale);
      for (let i = 0; i < 3; i++) { const x = left + (right - left) * (.28 + i * .22); context.beginPath(); context.moveTo(x - 8 * scale, nearY - 6 * scale); context.lineTo(x + 4 * scale, nearY); context.lineTo(x - 8 * scale, nearY + 6 * scale); context.stroke(); }
    }

    function drawSpinner(
      context: CanvasRenderingContext2D, spinner: Spinner, time: number,
      sx: (x: number, y: number) => number, sy: (y: number) => number, perspective: (y: number) => number,
    ) {
      const angle = time * spinner.speed + spinner.phase, scale = renderScale * perspective(spinner.y);
      const x = sx(spinner.x, spinner.y), y = sy(spinner.y), dx = Math.cos(angle) * spinner.len * scale, dy = -Math.sin(angle) * spinner.len * scale;
      context.strokeStyle = "rgba(12,4,35,.25)"; context.lineWidth = 34 * scale; context.lineCap = "round"; context.beginPath(); context.moveTo(x - dx + 7, y - dy + 9); context.lineTo(x + dx + 7, y + dy + 9); context.stroke();
      const bar = context.createLinearGradient(x - dx, y - dy, x + dx, y + dy); bar.addColorStop(0, colorMix(spinner.color, "#000000", .18)); bar.addColorStop(.5, spinner.color); bar.addColorStop(1, colorMix(spinner.color, "#ffffff", .25));
      context.strokeStyle = bar; context.lineWidth = 30 * scale; context.beginPath(); context.moveTo(x - dx, y - dy); context.lineTo(x + dx, y + dy); context.stroke();
      context.strokeStyle = "rgba(255,255,255,.38)"; context.lineWidth = 5 * scale; context.beginPath(); context.moveTo(x - dx, y - dy - 5 * scale); context.lineTo(x + dx, y + dy - 5 * scale); context.stroke();
      context.fillStyle = "#ffffff"; context.beginPath(); context.arc(x, y, 35 * scale, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#4a208d"; context.beginPath(); context.arc(x, y, 18 * scale, 0, Math.PI * 2); context.fill();
    }

    function drawBean(
      context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, name: string,
      alpha: number, time: number, isMe: boolean, stun: number,
    ) {
      const run = Math.min(1, Math.hypot(p.vx, p.vy) / 280);
      const bob = isMe ? Math.abs(Math.sin(time * 9)) * radius * .13 * run : Math.sin(time * 5 + hash(name)) * radius * .05;
      const tilt = isMe ? Math.max(-.2, Math.min(.2, p.vx / 1200)) : 0;
      const squish = isMe && stun > .2 ? .78 : 1;
      context.save(); context.globalAlpha = alpha; context.translate(x, y - bob); context.rotate(tilt); context.scale(1 / squish, squish);
      context.fillStyle = "rgba(12,4,35,.28)"; context.beginPath(); context.ellipse(4, radius * 1.27 + bob, radius * .95, radius * .34, 0, 0, Math.PI * 2); context.fill();
      const limbSwing = Math.sin(time * 10) * radius * .23 * run;
      context.strokeStyle = color; context.lineWidth = radius * .45; context.lineCap = "round";
      context.beginPath(); context.moveTo(-radius * .56, radius * .15); context.lineTo(-radius * .92, radius * .3 + limbSwing); context.moveTo(radius * .56, radius * .15); context.lineTo(radius * .92, radius * .3 - limbSwing); context.stroke();
      context.beginPath(); context.moveTo(-radius * .33, radius * .72); context.lineTo(-radius * .38 - limbSwing * .32, radius * 1.22); context.moveTo(radius * .33, radius * .72); context.lineTo(radius * .38 + limbSwing * .32, radius * 1.22); context.stroke();
      const bodyGradient = context.createLinearGradient(-radius, -radius, radius, radius);
      bodyGradient.addColorStop(0, colorMix(color, "#ffffff", .32)); bodyGradient.addColorStop(.52, color); bodyGradient.addColorStop(1, colorMix(color, "#000000", .28));
      context.fillStyle = bodyGradient; context.strokeStyle = isMe ? "#ffffff" : colorMix(color, "#000000", .35); context.lineWidth = Math.max(2, radius * .12);
      context.beginPath(); context.roundRect(-radius, -radius * 1.25, radius * 2, radius * 2.35, radius * .78); context.fill(); context.stroke();
      context.fillStyle = "rgba(255,255,255,.19)"; context.beginPath(); context.ellipse(-radius * .34, -radius * .73, radius * .2, radius * .4, -.45, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#ffffff"; context.beginPath(); context.ellipse(0, -radius * .46, radius * .65, radius * .46, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#170831"; context.beginPath(); context.ellipse(-radius * .21, -radius * .47, radius * .085, radius * .15, 0, 0, Math.PI * 2); context.ellipse(radius * .21, -radius * .47, radius * .085, radius * .15, 0, 0, Math.PI * 2); context.fill();
      context.restore();
      context.globalAlpha = alpha; context.font = `900 ${Math.max(9, radius * .36)}px system-ui`; context.textAlign = "center"; context.strokeStyle = "#15062f"; context.lineWidth = 5; context.strokeText(name, x, y - radius * 1.72 - bob); context.fillStyle = isMe ? "#ffe14a" : "#ffffff"; context.fillText(name, x, y - radius * 1.72 - bob); context.globalAlpha = 1;
    }

    function colorMix(color: string, mix: string, amount: number) {
      const parse = (value: string) => value.replace("#", "").match(/.{2}/g)!.map((part) => parseInt(part, 16));
      const a = parse(color), b = parse(mix);
      return `rgb(${a.map((channel, index) => Math.round(channel * (1 - amount) + b[index] * amount)).join(",")})`;
    }

    function loop(now: number) {
      const dt = Math.min(.033, (now - last) / 1000);
      last = now;
      if (!finished) update(dt, now);
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      audio.stop();
      if (audioRef.current === audio) audioRef.current = null;
      removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("pointerdown", unlockAudio); removeEventListener("resize", resize);
    };
  }, [map.id, map.accent, map.floor, map.sky, me.color, me.id, me.name, round, startedAt, isSurvival, map.start]);

  function pointerAxis(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    input.current.x = dx / length * Math.min(1, length / 42);
    input.current.y = -dy / length * Math.min(1, length / 42);
    const knob = event.currentTarget.firstElementChild as HTMLElement;
    knob.style.transform = `translate(${dx / length * Math.min(38, length)}px,${dy / length * Math.min(38, length)}px)`;
  }
  function clearAxis(event: React.PointerEvent<HTMLDivElement>) {
    input.current.x = input.current.y = 0;
    (event.currentTarget.firstElementChild as HTMLElement).style.transform = "";
  }

  const aliveCount = players.filter((player) => !player.finishPosition).length;
  const survivalPercent = players.length ? aliveCount / players.length * 100 : 100;

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    audioRef.current?.setEnabled(next);
  }

  return <div className="race-game">
    <canvas ref={canvasRef}/>
    {countdown && <div className="race-countdown">{countdown}</div>}
    {impact && <div className="impact-callout">{impact}</div>}
    <button className={`sound-toggle ${soundOn ? "" : "muted"}`} onClick={toggleSound} aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}><b>{soundOn ? "♪" : "×"}</b><span>{soundOn ? "ÂM THANH" : "ĐÃ TẮT"}</span></button>
    <div className="player-hud">
      <div><small>{isSurvival?"CÒN TRỤ":"TIẾN ĐỘ"}</small><b>{isSurvival?aliveCount:`${Math.min(100, Math.round(localProgress))}%`}</b></div>
      <div className="hud-map"><span>{map.name} · {isSurvival?"SINH TỒN":"ROUND"} {round}</span><i><b style={{ width: `${isSurvival?survivalPercent:localProgress}%` }}/></i></div>
      <div><small>THỜI GIAN</small><b>{(elapsed / 1000).toFixed(1)}s</b></div>
    </div>
    <div className="control-hint"><span><b>WASD</b> DI CHUYỂN</span><span><b>SPACE</b> NHẢY</span><span><b>SHIFT</b> BOOST</span></div>
    <div className="boost-hud"><span>SHIFT</span><i><b style={{ width: `${dash}%` }}/></i></div>
    <div className={`mana-hud ${mana < 25 ? "low" : ""}`}><div className="mana-label"><span><b>SPACE</b> MANA NHẢY</span><em>{Math.round(mana)}</em></div><i><b style={{ width: `${mana}%` }}/></i></div>
    <div className="touch-controls">
      <div className="touch-stick" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pointerAxis(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pointerAxis(event); }} onPointerUp={clearAxis} onPointerCancel={clearAxis}><i/></div>
      <div><button className={mana < 25 ? "empty" : ""} onPointerDown={() => input.current.jump = true}>↑<small>{mana < 25 ? "HẾT MANA" : "NHẢY"}</small></button><button onPointerDown={() => input.current.dash = true}>»<small>BOOST</small></button></div>
    </div>
  </div>;
}

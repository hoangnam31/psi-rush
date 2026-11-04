export const MAPS = [
  { id: "sky", name: "Neon Sky Gauntlet", subtitle: "Đĩa xoay chuyển động xen kẽ đường đua neon", mode: "race", start: "line", sky: "#1a3a91", floor: "#6459e8", accent: "#35dcff" },
  { id: "jungle", name: "Caro Sụp Đổ", subtitle: "Sinh tồn trên bàn caro khép kín", mode: "survival", start: "tiles", sky: "#0f5f53", floor: "#45c77e", accent: "#ffb238" },
  { id: "ice", name: "Ice Drift", subtitle: "Băng trượt, vực lớn và cầu nổi di chuyển", mode: "race", start: "line", sky: "#2756a6", floor: "#a6edff", accent: "#ffffff" },
  { id: "sweep", name: "Block Storm", subtitle: "Luồn khe, nhảy thấp và sống sót trên sàn vuông", mode: "survival", start: "square", sky: "#391177", floor: "#6c4cff", accent: "#ff56a9" },
  { id: "lava", name: "Đảo Laser", subtitle: "Né các lượt laser quét ngày càng dày đặc", mode: "survival", start: "arena", sky: "#5a1522", floor: "#c84930", accent: "#ff376f" },
] as const;

export type GameMode = "race" | "survival";

export function getMapMode(id?: string | null): GameMode {
  return MAPS.find((map) => map.id === id)?.mode ?? "race";
}

export type RoomStatus = "waiting" | "racing" | "results" | "finished";

export const COLORS = ["#8b5cf6", "#ff3d9a", "#b6f43b", "#35dcff", "#ffb238", "#ff6557"];

export const BASE_COURSE_WIDTH = 1600;

export function courseWidthForPlayers(playerCount: number) {
  const count = Math.max(1, Math.min(200, playerCount));
  return Math.round(Math.min(3000, BASE_COURSE_WIDTH + Math.max(0, count - 24) * 8));
}

export function survivalSizeForPlayers(playerCount: number) {
  const count = Math.max(1, Math.min(200, playerCount));
  return Math.round(Math.min(2700, 1500 + Math.max(0, count - 20) * 7));
}

export function scoreForPosition(position: number) {
  const podium = [100, 80, 65, 55, 48, 42, 36, 30, 25, 20];
  return podium[position - 1] ?? Math.max(5, 20 - Math.floor((position - 10) / 5) * 2);
}

export function pickMap(pool: string[], previous?: string | null) {
  const choices = pool.filter((id) => id !== previous);
  const source = choices.length ? choices : pool;
  return source[Math.floor(Math.random() * source.length)] ?? MAPS[0].id;
}

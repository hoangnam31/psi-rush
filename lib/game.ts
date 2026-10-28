export const MAPS = [
  { id: "neon", name: "Neon Gauntlet", subtitle: "Đường đua va đập hỗn loạn", mode: "race", start: "line", sky: "#24105f", floor: "#8b5cf6", accent: "#ff3d9a" },
  { id: "sky", name: "Sky Ring Run", subtitle: "Xuất hiện ngay trên đĩa bay đầu tiên", mode: "race", start: "ring", sky: "#176baf", floor: "#53c9f5", accent: "#ffe14a" },
  { id: "jungle", name: "Caro Sụp Đổ", subtitle: "Sinh tồn trên bàn caro khép kín", mode: "survival", start: "tiles", sky: "#0f5f53", floor: "#45c77e", accent: "#ffb238" },
  { id: "ice", name: "Ice Drift", subtitle: "Đường trượt và tường quét ngang", mode: "race", start: "line", sky: "#2756a6", floor: "#a6edff", accent: "#ffffff" },
  { id: "lava", name: "Đảo Xoay Sinh Tồn", subtitle: "Sinh tồn trên một đảo xoay", mode: "survival", start: "arena", sky: "#5a1522", floor: "#c84930", accent: "#ffdd42" },
] as const;

export type GameMode = "race" | "survival";

export function getMapMode(id?: string | null): GameMode {
  return MAPS.find((map) => map.id === id)?.mode ?? "race";
}

export type RoomStatus = "waiting" | "racing" | "results" | "finished";

export const COLORS = ["#8b5cf6", "#ff3d9a", "#b6f43b", "#35dcff", "#ffb238", "#ff6557"];

export function scoreForPosition(position: number) {
  const podium = [100, 80, 65, 55, 48, 42, 36, 30, 25, 20];
  return podium[position - 1] ?? Math.max(5, 20 - Math.floor((position - 10) / 5) * 2);
}

export function pickMap(pool: string[], previous?: string | null) {
  const choices = pool.filter((id) => id !== previous);
  const source = choices.length ? choices : pool;
  return source[Math.floor(Math.random() * source.length)] ?? MAPS[0].id;
}

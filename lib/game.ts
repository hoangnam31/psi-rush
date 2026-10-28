export const MAPS = [
  { id: "neon", name: "Neon Gauntlet", subtitle: "Đường đua va đập hỗn loạn", sky: "#24105f", floor: "#8b5cf6", accent: "#ff3d9a" },
  { id: "sky", name: "Sky Ring Run", subtitle: "Nhảy qua chuỗi đảo tròn lơ lửng", sky: "#176baf", floor: "#53c9f5", accent: "#ffe14a" },
  { id: "jungle", name: "Caro Sụp Đổ", subtitle: "Ô sàn cảnh báo rồi biến mất", sky: "#0f5f53", floor: "#45c77e", accent: "#ffb238" },
  { id: "ice", name: "Ice Drift", subtitle: "Đường trượt và tường quét ngang", sky: "#2756a6", floor: "#a6edff", accent: "#ffffff" },
  { id: "lava", name: "Đảo Xoay Sinh Tồn", subtitle: "Vòng tròn xoay đẩy người xuống vực", sky: "#5a1522", floor: "#c84930", accent: "#ffdd42" },
] as const;

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

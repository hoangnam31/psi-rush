export const MAPS = [
  { id: "sky", icon: "✦", name: "PSI Neon Sky", subtitle: "Đĩa bay và cổng thử thách trên tầng mây", mode: "race", start: "line", sky: "#315b91", floor: "#5877ba", accent: "#f2b63f", guide: { objective: "Vượt toàn bộ đường đua trên không và chạm vạch đích nhanh nhất.", tips: ["Nhảy qua khoảng trống giữa các đĩa", "Đĩa xoay sẽ kéo bạn theo chiều quay", "Checkpoint sẽ lưu vị trí hồi sinh"] } },
  { id: "jungle", icon: "▦", name: "Caro Sụp Đổ", subtitle: "Sinh tồn trên bàn caro khép kín", mode: "survival", start: "tiles", sky: "#327064", floor: "#78bd8d", accent: "#f2ad40", guide: { objective: "Đứng vững trên bàn caro lâu nhất khi các ô lần lượt sụp xuống.", tips: ["Các ô rơi theo từng nhịp cảnh báo", "Quan sát màu ô trước khi di chuyển", "Rơi khỏi bàn là bị loại khỏi round"] } },
  { id: "ice", icon: "❄", name: "PSI Ice Drift", subtitle: "Băng trượt, vực lớn và sông băng Bắc Cực", mode: "race", start: "line", sky: "#5b88ad", floor: "#b9e8ee", accent: "#fff2cf", guide: { objective: "Giữ thăng bằng trên băng, vượt vực và băng qua sông Bắc Cực để về đích.", tips: ["Nhả hướng sớm vì mặt băng còn trượt", "Nhảy liên tục để đi nhanh hơn khi qua sông", "Né gấu bắc cực đang bơi ngang dòng"] } },
  { id: "sweep", icon: "▰", name: "PSI Block Storm", subtitle: "Luồn khe, nhảy thấp và trụ lại trên sàn tập", mode: "survival", start: "square", sky: "#243d70", floor: "#4d69a7", accent: "#f0ae39", guide: { objective: "Né các bức tường quét và trở thành người cuối cùng còn trên sàn.", tips: ["Nhảy qua vật cản thấp", "Luồn qua khe của tường cao", "Vật cản sẽ chạy nhanh dần theo thời gian"] } },
  { id: "lava", icon: "⌁", name: "Đảo Laser PSI", subtitle: "Né các lượt laser quét ngày càng dày đặc", mode: "survival", start: "arena", sky: "#43394f", floor: "#c86756", accent: "#ffd05a", guide: { objective: "Sống sót trước các tia laser và trở thành người cuối cùng còn lại.", tips: ["Mỗi người chỉ có một mạng", "Nhảy đúng lúc laser quét ngang", "Chạm laser hoặc rơi khỏi đảo sẽ bị loại"] } },
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

export function pickMap(pool: string[], previous?: string | null, roundNumber = 1, roomSeed = "") {
  const validIds = new Set<string>(MAPS.map((map) => map.id));
  const source = [...new Set(pool.filter((id) => validIds.has(id)))];
  const maps = source.length ? source : MAPS.map((map) => map.id);
  let state = [...`${roomSeed}:${maps.join(":")}`].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 2166136261);
  const shuffled = [...maps];
  for (let index = shuffled.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const selected = shuffled[(Math.max(1, roundNumber) - 1) % shuffled.length];
  if (shuffled.length > 1 && selected === previous && roundNumber === 1) return shuffled[1];
  return selected ?? MAPS[0].id;
}

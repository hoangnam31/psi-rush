export const MAP_BRIEFING_MS = 10_000;
export const ROUND_COUNTDOWN_MS = 3_000;
export const ROUND_START_DELAY_MS = MAP_BRIEFING_MS + ROUND_COUNTDOWN_MS;

export function serverEpoch(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const epoch = Date.parse(normalized);
  return Number.isFinite(epoch) ? epoch : Date.now();
}


export const TILE_COUNT = 80;
export const TILES_PER_WAVE = 8;
export const TILE_WAVE_START = 7;
export const TILE_WAVE_INTERVAL = 4.25;
export const TILE_WARNING_TIME = 2;

export function tileCollapseState(index: number, time: number, round: number) {
  const order = (index * 37 + round * 13) % TILE_COUNT;
  const wave = Math.floor(order / TILES_PER_WAVE);
  const dropAt = TILE_WAVE_START + wave * TILE_WAVE_INTERVAL;
  return {
    wave,
    dropAt,
    collapsed: time >= dropAt,
    warning: time >= dropAt - TILE_WARNING_TIME && time < dropAt,
  };
}

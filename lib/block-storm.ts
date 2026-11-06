export type BlockStormDirection = 0 | 1 | 2 | 3;

export type BlockStormWave = {
  index: number;
  direction: BlockStormDirection;
  duration: number;
  progress: number;
  low: boolean;
  gapCenterRatio: number;
  gapSizeRatio: number;
};

const INTRO_SECONDS = 2.5;
const REST_SECONDS = .85;
const DIRECTIONS: readonly BlockStormDirection[] = [0, 2, 1, 3];

function stableHash(value: string) {
  return [...value].reduce((result, char) => ((result * 31 + char.charCodeAt(0)) >>> 0), 7);
}

/**
 * Returns at most one active Block Storm wave. A new wall starts only after
 * the previous wall has completely crossed the arena plus a short clear gap.
 * Difficulty increases through travel speed, never through overlapping walls.
 */
export function blockStormWaveAt(time: number, round: number): BlockStormWave | null {
  if (time < INTRO_SECONDS) return null;

  let startAt = INTRO_SECONDS;
  for (let index = 0; index < 240; index++) {
    // Each wall still clears the arena before the next one appears, but its
    // crossing time drops noticeably wave by wave. The previous .085-second
    // step was too subtle to feel during a normal round.
    const duration = Math.max(1.9, 5.8 - index * .24);
    const endAt = startAt + duration;
    if (time < startAt) return null;
    if (time <= endAt) {
      const direction = DIRECTIONS[(index + Math.max(0, round - 1)) % DIRECTIONS.length];
      const random = stableHash(`${round}:${index}`) / 0xffffffff;
      return {
        index,
        direction,
        duration,
        progress: Math.max(0, Math.min(1, (time - startAt) / duration)),
        low: (index + round) % 3 === 0,
        gapCenterRatio: .5 + (random - .5) * .4,
        gapSizeRatio: .27,
      };
    }
    startAt = endAt + REST_SECONDS;
  }

  return null;
}

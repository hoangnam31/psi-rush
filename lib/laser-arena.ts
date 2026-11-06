export type LaserSweepFrame = {
  vertical: boolean;
  offset: number;
  extent: number;
  velocity: number;
  color: string;
};

/**
 * Normalized laser positions shared by gameplay physics and the Admin map.
 * Offsets and velocities are expressed in arena-radius units.
 */
export function laserSweepFramesAt(time: number): LaserSweepFrame[] {
  if (time < 2.5) return [];
  const frames: LaserSweepFrame[] = [];
  const cadence = 4.2;
  const currentWave = Math.floor((time - 2.5) / cadence);
  const travelRadius = 1.28;

  for (let wave = Math.max(0, currentWave - 2); wave <= currentWave; wave++) {
    const waveStart = 2.5 + wave * cadence;
    const beamCount = waveStart >= 42 ? 3 : waveStart >= 20 ? 2 : 1;
    for (let variant = 0; variant < beamCount; variant++) {
      const startAt = waveStart + variant * (beamCount === 3 ? 1.05 : 1.35);
      const duration = Math.max(2.8, 4.8 - wave * .055);
      const progress = (time - startAt) / duration;
      if (progress < 0 || progress > 1) continue;
      const vertical = waveStart >= 24 && (wave + variant) % 2 !== 0;
      const reverse = (wave + variant) % 3 === 0;
      const travel = reverse ? 1 - progress : progress;
      frames.push({
        vertical,
        offset: -travelRadius + travelRadius * 2 * travel,
        extent: 1.08,
        velocity: (reverse ? -1 : 1) * travelRadius * 2 / duration,
        color: variant % 2 ? (vertical ? "#ffe14a" : "#35dcff") : vertical ? "#ff3d9a" : "#ff375f",
      });
    }
  }
  return frames;
}


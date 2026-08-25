export type Rng = () => number;

export const createRng = (seed: number): Rng => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

export const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(between(rng, min, max + 1));

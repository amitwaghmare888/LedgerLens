/**
 * Deterministic pseudo-random number generator (xoshiro128**)
 * and ID generation for synthetic dataset.
 *
 * Given the same seed, produces the exact same sequence.
 * Different seeds produce different sequences.
 */

/**
 * Creates a seeded PRNG using the xoshiro128** algorithm.
 * Returns a function that produces numbers in [0, 1).
 */
export function createRng(seed: number): () => number {
  // Use splitmix32 to initialize state from a single seed
  let s0 = splitmix32(seed);
  let s1 = splitmix32(s0);
  let s2 = splitmix32(s1);
  let s3 = splitmix32(s2);

  function splitmix32(a: number): number {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  }

  return function next(): number {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;

    s2 ^= t;
    s3 = rotl(s3, 11);

    return result / 0x100000000;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * A higher-level RNG utility built on the seeded PRNG.
 */
export class SeededRandom {
  private rng: () => number;

  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  /** Returns a number in [0, 1). */
  next(): number {
    return this.rng();
  }

  /** Returns an integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  /** Picks a random element from an array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(this.rng() * arr.length)];
  }

  /** Shuffles an array in-place (Fisher-Yates). Returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Returns true with the given probability (0 to 1). */
  chance(probability: number): boolean {
    return this.rng() < probability;
  }
}

/**
 * Generates a deterministic ID string from seed components.
 * Uses a simple hash to produce a hex string.
 */
export function deterministicId(prefix: string, ...parts: (string | number)[]): string {
  const input = parts.join(':');
  let hash = 0x811c9dc5; // FNV-1a offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
    hash >>>= 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Generates a deterministic date within a range.
 */
export function deterministicDate(
  rng: SeededRandom,
  startMs: number,
  endMs: number
): Date {
  const ms = rng.int(startMs, endMs);
  return new Date(ms);
}

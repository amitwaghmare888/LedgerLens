import { describe, it, expect } from 'vitest';
import { createRng, SeededRandom, deterministicId } from '../lib/deterministic';

describe('deterministic module', () => {
  describe('createRng', () => {
    it('same seed produces same sequence', () => {
      const rng1 = createRng(42);
      const rng2 = createRng(42);
      const seq1 = Array.from({ length: 100 }, () => rng1());
      const seq2 = Array.from({ length: 100 }, () => rng2());
      expect(seq1).toEqual(seq2);
    });

    it('different seeds produce different sequences', () => {
      const rng1 = createRng(42);
      const rng2 = createRng(99);
      const seq1 = Array.from({ length: 20 }, () => rng1());
      const seq2 = Array.from({ length: 20 }, () => rng2());
      expect(seq1).not.toEqual(seq2);
    });

    it('produces values in [0, 1)', () => {
      const rng = createRng(42);
      for (let i = 0; i < 1000; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('SeededRandom', () => {
    it('int produces values in range', () => {
      const sr = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const val = sr.int(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('pick returns elements from array', () => {
      const sr = new SeededRandom(42);
      const arr = ['a', 'b', 'c'] as const;
      for (let i = 0; i < 50; i++) {
        const val = sr.pick(arr);
        expect(arr).toContain(val);
      }
    });

    it('pick throws on empty array', () => {
      const sr = new SeededRandom(42);
      expect(() => sr.pick([])).toThrow();
    });

    it('shuffle is deterministic', () => {
      const sr1 = new SeededRandom(42);
      const sr2 = new SeededRandom(42);
      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      sr1.shuffle(arr1);
      sr2.shuffle(arr2);
      expect(arr1).toEqual(arr2);
    });

    it('chance respects probability bounds', () => {
      const sr = new SeededRandom(42);
      // probability 0 should always return false
      for (let i = 0; i < 100; i++) {
        expect(sr.chance(0)).toBe(false);
      }
    });
  });

  describe('deterministicId', () => {
    it('same inputs produce same ID', () => {
      const id1 = deterministicId('pay', 1, 2);
      const id2 = deterministicId('pay', 1, 2);
      expect(id1).toBe(id2);
    });

    it('different inputs produce different IDs', () => {
      const id1 = deterministicId('pay', 1, 2);
      const id2 = deterministicId('pay', 1, 3);
      expect(id1).not.toBe(id2);
    });

    it('includes prefix', () => {
      const id = deterministicId('pay', 1, 2);
      expect(id.startsWith('pay_')).toBe(true);
    });

    it('produces consistent length', () => {
      const id = deterministicId('test', 'a', 'b', 'c');
      // prefix + _ + 8 hex chars
      expect(id).toMatch(/^test_[0-9a-f]{8}$/);
    });
  });
});

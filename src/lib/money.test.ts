import { describe, it, expect } from 'vitest';
import {
  validatePaise,
  isValidPaise,
  addPaise,
  subtractPaise,
  sumPaise,
  paiseToRupeeDisplay,
  rupeesToPaise,
  absPaise,
} from '../lib/money';

describe('money module', () => {
  describe('validatePaise', () => {
    it('accepts valid integers', () => {
      expect(() => validatePaise(0)).not.toThrow();
      expect(() => validatePaise(100)).not.toThrow();
      expect(() => validatePaise(-500)).not.toThrow();
      expect(() => validatePaise(Number.MAX_SAFE_INTEGER)).not.toThrow();
    });

    it('rejects NaN', () => {
      expect(() => validatePaise(NaN)).toThrow('NaN');
    });

    it('rejects Infinity', () => {
      expect(() => validatePaise(Infinity)).toThrow('Infinity');
      expect(() => validatePaise(-Infinity)).toThrow('Infinity');
    });

    it('rejects fractional values', () => {
      expect(() => validatePaise(10.5)).toThrow('fractional');
      expect(() => validatePaise(0.01)).toThrow('fractional');
    });

    it('rejects unsafe integers', () => {
      expect(() => validatePaise(Number.MAX_SAFE_INTEGER + 1)).toThrow('safe integer');
    });
  });

  describe('isValidPaise', () => {
    it('returns true for valid values', () => {
      expect(isValidPaise(0)).toBe(true);
      expect(isValidPaise(100)).toBe(true);
      expect(isValidPaise(-999)).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isValidPaise(NaN)).toBe(false);
      expect(isValidPaise(Infinity)).toBe(false);
      expect(isValidPaise(1.5)).toBe(false);
    });
  });

  describe('addPaise', () => {
    it('adds two amounts', () => {
      expect(addPaise(100, 200)).toBe(300);
      expect(addPaise(0, 500)).toBe(500);
      expect(addPaise(-100, 100)).toBe(0);
    });

    it('rejects invalid inputs', () => {
      expect(() => addPaise(1.5, 2)).toThrow();
      expect(() => addPaise(1, NaN)).toThrow();
    });
  });

  describe('subtractPaise', () => {
    it('subtracts amounts', () => {
      expect(subtractPaise(500, 200)).toBe(300);
      expect(subtractPaise(100, 100)).toBe(0);
      expect(subtractPaise(0, 100)).toBe(-100);
    });

    it('rejects invalid inputs', () => {
      expect(() => subtractPaise(Infinity, 1)).toThrow();
    });
  });

  describe('sumPaise', () => {
    it('sums an array of amounts', () => {
      expect(sumPaise([100, 200, 300])).toBe(600);
      expect(sumPaise([])).toBe(0);
      expect(sumPaise([1000])).toBe(1000);
    });

    it('handles negative amounts', () => {
      expect(sumPaise([100, -50, 200])).toBe(250);
    });
  });

  describe('paiseToRupeeDisplay', () => {
    it('formats basic amounts', () => {
      expect(paiseToRupeeDisplay(0)).toBe('0.00');
      expect(paiseToRupeeDisplay(100)).toBe('1.00');
      expect(paiseToRupeeDisplay(150)).toBe('1.50');
      expect(paiseToRupeeDisplay(1)).toBe('0.01');
      expect(paiseToRupeeDisplay(99)).toBe('0.99');
    });

    it('formats with Indian numbering', () => {
      expect(paiseToRupeeDisplay(150075)).toBe('1,500.75');
      expect(paiseToRupeeDisplay(10000000)).toBe('1,00,000.00');
      expect(paiseToRupeeDisplay(100000000)).toBe('10,00,000.00');
    });

    it('formats negative amounts', () => {
      expect(paiseToRupeeDisplay(-150)).toBe('-1.50');
      expect(paiseToRupeeDisplay(-10000000)).toBe('-1,00,000.00');
    });

    it('rejects invalid inputs', () => {
      expect(() => paiseToRupeeDisplay(NaN)).toThrow();
      expect(() => paiseToRupeeDisplay(1.5)).toThrow();
    });
  });

  describe('rupeesToPaise', () => {
    it('parses valid rupee strings', () => {
      expect(rupeesToPaise('100')).toBe(10000);
      expect(rupeesToPaise('100.50')).toBe(10050);
      expect(rupeesToPaise('0.01')).toBe(1);
      expect(rupeesToPaise('0')).toBe(0);
      expect(rupeesToPaise('1,500.75')).toBe(150075);
    });

    it('handles whitespace', () => {
      expect(rupeesToPaise('  100.50  ')).toBe(10050);
    });

    it('handles negative values', () => {
      expect(rupeesToPaise('-100.50')).toBe(-10050);
    });

    it('rejects invalid strings', () => {
      expect(() => rupeesToPaise('abc')).toThrow();
      expect(() => rupeesToPaise('100.123')).toThrow(); // 3 decimal places
      expect(() => rupeesToPaise('')).toThrow();
      expect(() => rupeesToPaise('.')).toThrow();
    });
  });

  describe('absPaise', () => {
    it('returns absolute value', () => {
      expect(absPaise(-100)).toBe(100);
      expect(absPaise(100)).toBe(100);
      expect(absPaise(0)).toBe(0);
    });
  });

  describe('round-trip', () => {
    it('paiseToRupee -> rupeesToPaise round-trips', () => {
      const values = [0, 1, 99, 100, 150075, 10000000];
      for (const v of values) {
        const display = paiseToRupeeDisplay(v);
        expect(rupeesToPaise(display)).toBe(v);
      }
    });
  });
});

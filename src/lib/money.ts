/**
 * LedgerLens Money Module
 *
 * All monetary values are stored as integer paise (1 INR = 100 paise).
 * This module provides safe arithmetic and conversion functions.
 * Floating-point arithmetic is NEVER used for financial calculations.
 */

/** Validates that a value is a safe integer suitable for paise representation. */
export function validatePaise(value: number): void {
  if (typeof value !== 'number') {
    throw new Error(`Money: expected number, got ${typeof value}`);
  }
  if (Number.isNaN(value)) {
    throw new Error('Money: NaN is not a valid monetary value');
  }
  if (!Number.isFinite(value)) {
    throw new Error('Money: Infinity is not a valid monetary value');
  }
  if (!Number.isInteger(value)) {
    throw new Error(`Money: fractional paise not allowed (got ${value})`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Money: value ${value} exceeds safe integer range`);
  }
}

/** Returns true if the value is a valid paise amount. */
export function isValidPaise(value: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value)
  );
}

/** Adds two paise amounts. Both must be valid integers. */
export function addPaise(a: number, b: number): number {
  validatePaise(a);
  validatePaise(b);
  const result = a + b;
  validatePaise(result);
  return result;
}

/** Subtracts b from a. Both must be valid integers. */
export function subtractPaise(a: number, b: number): number {
  validatePaise(a);
  validatePaise(b);
  const result = a - b;
  validatePaise(result);
  return result;
}

/** Sums an array of paise amounts. */
export function sumPaise(amounts: number[]): number {
  let total = 0;
  for (const amt of amounts) {
    total = addPaise(total, amt);
  }
  return total;
}

/**
 * Converts paise to a display string in rupees.
 * This is for DISPLAY ONLY — never parse this back for calculations.
 *
 * Example: 150075 → "1,500.75"
 */
export function paiseToRupeeDisplay(paise: number): string {
  validatePaise(paise);
  const negative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;
  const paisePart = remainingPaise.toString().padStart(2, '0');

  // Indian numbering: last 3 digits, then groups of 2
  const rupeeStr = rupees.toString();
  let formatted: string;
  if (rupeeStr.length <= 3) {
    formatted = rupeeStr;
  } else {
    const last3 = rupeeStr.slice(-3);
    const rest = rupeeStr.slice(0, -3);
    const groups: string[] = [];
    for (let i = rest.length; i > 0; i -= 2) {
      groups.unshift(rest.slice(Math.max(0, i - 2), i));
    }
    formatted = groups.join(',') + ',' + last3;
  }

  return `${negative ? '-' : ''}${formatted}.${paisePart}`;
}

/**
 * Converts a rupee string (e.g. "1500.75") to paise integer.
 * Accepts at most 2 decimal places. Rejects ambiguous input.
 */
export function rupeesToPaise(rupees: string): number {
  const trimmed = rupees.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Money: cannot parse "${rupees}" as rupees`);
  }
  const parts = trimmed.split('.');
  const wholePart = parseInt(parts[0], 10);
  let paisePart = 0;
  if (parts[1]) {
    paisePart = parseInt(parts[1].padEnd(2, '0'), 10);
  }
  const sign = wholePart < 0 || trimmed.startsWith('-') ? -1 : 1;
  const result = sign * (Math.abs(wholePart) * 100 + paisePart);
  validatePaise(result);
  return result;
}

/** Returns absolute value of a paise amount. */
export function absPaise(paise: number): number {
  validatePaise(paise);
  return Math.abs(paise);
}

/**
 * LedgerLens Reconciliation — Prioritize
 *
 * Assigns a deterministic priority score to each exception for human attention ordering.
 *
 * IMPORTANT: This score is an ATTENTION-RANKING HEURISTIC ONLY.
 * It does NOT determine financial correctness, risk probability, or match confidence.
 * It is used solely to order the exception queue for human review.
 *
 * Score formula (documented):
 *   priority_score = floor(amountPaise / 10000) × type_multiplier + age_days × 10
 *
 * Type multipliers:
 *   MISSING_SETTLEMENT → 4  (unrecorded funds — highest attention)
 *   AMOUNT_MISMATCH    → 3  (unexplained financial gap)
 *   MISSING_BANK_ENTRY → 2  (settlement not yet credited)
 *   All others         → 1
 *
 * Age:
 *   Computed from the exception's createdAt field (ISO 8601 from source data).
 *   referenceDate is a deterministic anchor date for the dataset period.
 *   NOT computed from runtime Date.now() — scores must be stable across runs.
 *
 * Same input → same score, always.
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type { EngineException, ExceptionType } from '../domain/types';

// ============================================================
// Type multipliers (documented)
// ============================================================

const TYPE_MULTIPLIER: Record<ExceptionType, number> = {
  MISSING_SETTLEMENT: 4,
  AMOUNT_MISMATCH: 3,
  MISSING_BANK_ENTRY: 2,
  TIMING_MISMATCH: 1,
  POSSIBLE_DUPLICATE: 1,
  AMBIGUOUS_MATCH: 1,
  UNSUPPORTED_CASE: 1,
};

// ============================================================
// Priority score computation
// ============================================================

/**
 * Computes the deterministic priority score for one exception.
 *
 * @param exception - The exception to score.
 * @param referenceDate - A deterministic anchor date (ISO 8601).
 *   Must be consistent across all calls in a run.
 *   For the synthetic dataset, use the dataset end date (2025-03-31).
 *   NOT runtime Date.now().
 */
export function computePriorityScore(
  exception: EngineException,
  referenceDate: string
): number {
  const multiplier = TYPE_MULTIPLIER[exception.type] ?? 1;
  const financialWeight = Math.floor(exception.amountPaise / 10000);

  const refMs = new Date(referenceDate).getTime();
  const createdMs = new Date(exception.createdAt).getTime();
  const ageDays = Math.max(0, Math.floor((refMs - createdMs) / (24 * 60 * 60 * 1000)));

  return financialWeight * multiplier + ageDays * 10;
}

/**
 * Assigns priority scores to all exceptions.
 * Returns a new array (does not mutate input) sorted by priorityScore descending.
 *
 * @param exceptions - Exceptions to prioritize.
 * @param referenceDate - Deterministic anchor date. Must be consistent per run.
 */
export function prioritizeExceptions(
  exceptions: EngineException[],
  referenceDate: string
): EngineException[] {
  return exceptions
    .map((exc) => ({
      ...exc,
      priorityScore: computePriorityScore(exc, referenceDate),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

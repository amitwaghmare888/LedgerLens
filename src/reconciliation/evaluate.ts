/**
}
  // ── Metric Definitions (Case-level) ──────────────────────────────────────────
  //
  // PRECISION  = fullyCorrectResolved / (fullyCorrectResolved + incorrectResolved)
  //   Denominator: only cases where the engine produced ≥1 decision.
  //   Meaning: "Of the cases the engine committed to resolving, how many were right?"
  //
  // RECALL     = fullyCorrectResolved / totalMatchableCases
  //   Denominator: cases with ≥1 expected-match sub-group (exception-only cases excluded).
  //   Meaning: "Of the cases that SHOULD have been matched, how many were?"
  //
  // MATCH RATE = casesWithAnyDecision / totalCases
  //   Meaning: "What fraction of cases received any reconciliation decision?"
  //
  // FALSE POSITIVES (unsafe matches): engine decisions on records that should be exceptions.
  //
  // FALSE NEGATIVES: matchable cases left fully unresolved (no decision at all).
  //
  // UNRESOLVED: no decision produced, no false match (safe decline).
  //
  // Note: exception-only cases that are safely unresolved are NOT false negatives.
  // ────────────────────────────────────────────────────────────────────────────
  function computeMetrics(result: EngineResult): EvaluationResult {
    const byScenario: Record<string, ScenarioMetrics> = {};
    // Counters
    let fullyCorrectResolved = 0;  // correct AND engine produced a decision
    let incorrectResolved = 0;     // incorrect AND engine produced a decision
    let correctUnresolved = 0;     // correct AND no decision (safe unresolved exception)
    let incorrectUnresolved = 0;   // incorrect AND no decision (missed expected match)
    let falseMatches = 0;
    let trapFalseMatches = 0;

    for (const { syntheticCase, records } of caseRecordSets) {
      const eval_ = evaluateCase(syntheticCase, records, result);
      const scenario = eval_.scenario;
      if (!byScenario[scenario]) {
        byScenario[scenario] = { scenario, totalCases: 0, correctMatches: 0, incorrectMatches: 0, unresolvedCases: 0, falseMatches: 0, trapFalseMatches: 0 };
      }
      byScenario[scenario].totalCases++;

      // Determine if engine produced any decision for this case
      const caseIds = new Set(records.map(r => r.id));
      const engineDecidedOnCase = result.decisions.some(d => d.sourceRecordIds.some(id => caseIds.has(id)));

      if (eval_.correct && !eval_.unresolved && engineDecidedOnCase) {
        fullyCorrectResolved++;
        byScenario[scenario].correctMatches++;
      } else if (eval_.correct && eval_.unresolved) {
        // Correctly unresolved (safe exception or safe decline)
        correctUnresolved++;
        byScenario[scenario].correctMatches++;
        byScenario[scenario].unresolvedCases++;
      } else if (eval_.unresolved && !eval_.correct) {
        // Expected match but left unresolved (false negative)
        incorrectUnresolved++;
        byScenario[scenario].unresolvedCases++;
        byScenario[scenario].incorrectMatches++;
      } else {
        // Incorrect resolution (wrong decision produced)
        incorrectResolved++;
        byScenario[scenario].incorrectMatches++;
      }

      if (eval_.falseMatch) {
        falseMatches++;
        byScenario[scenario].falseMatches++;
        if (eval_.isTrap) {
          trapFalseMatches++;
          byScenario[scenario].trapFalseMatches++;
        }
      }
    }

    // Precision: among cases engine attempted to resolve, how many correct?
    const resolvedTotal = fullyCorrectResolved + incorrectResolved;
    const precision = resolvedTotal > 0 ? fullyCorrectResolved / resolvedTotal : 0;

    // Recall: among matchable cases (have expected match groups), how many correct?
    // Exception-only cases do NOT count in recall denominator
    const matchableCases = caseRecordSets.filter(({ syntheticCase: sc }) => {
      if (sc.groundTruth.expectedSubgroups) {
        return sc.groundTruth.expectedSubgroups.some(sg => sg.outcome === 'match');
      }
      const exp = expectedEngineStatus(sc.groundTruth.expectedStatus);
      return exp !== 'exception' && exp !== 'UNRESOLVED';
    }).length;
    const recall = matchableCases > 0 ? fullyCorrectResolved / matchableCases : 0;

    // Match rate: fraction of cases with any decision
    const total = cases.length;
    const casesWithDecision = caseRecordSets.filter(({ records }) => {
      const ids = new Set(records.map(r => r.id));
      return result.decisions.some(d => d.sourceRecordIds.some(id => ids.has(id)));
    }).length;
    const matchRate = total > 0 ? casesWithDecision / total : 0;

    // For EvaluationResult compat: correct = fullyCorrectResolved + correctUnresolved
    // incorrect = incorrectResolved + incorrectUnresolved
    // unresolved = correctUnresolved + incorrectUnresolved
    const correct = fullyCorrectResolved + correctUnresolved;
    const incorrect = incorrectResolved + incorrectUnresolved;
    const unresolved = correctUnresolved + incorrectUnresolved;

    return {
      totalCases: total,
      correctMatches: correct,
      incorrectMatches: incorrect,
      unresolvedCases: unresolved,
      precision,
      recall,
      matchRate,
      falseMatches,
      trapFalseMatches,
      byScenario,
    };
  }

}
function evaluateCase(
  syntheticCase: SyntheticCase,
  caseRecords: NormalizedRecord[],
  engineResult: EngineResult
): CaseEvaluation {
  const { groundTruth } = syntheticCase;
  const { isTrap, expectedStatus } = groundTruth;

  // Build externalRef -> normalizedId map (used to translate groundTruth refs to engine IDs)
  const externalRefToId = new Map<string, string>();
  for (const r of caseRecords) externalRefToId.set(r.externalRef, r.id);

  const caseRecordIds = new Set(caseRecords.map(r => r.id));

  // Find engine decisions/exceptions touching any record from this case
  const relevantDecisions = engineResult.decisions.filter(d =>
    d.sourceRecordIds.some(id => caseRecordIds.has(id))
  );
  const relevantExceptions = engineResult.exceptions.filter(e =>
    e.sourceRecordIds.some(id => caseRecordIds.has(id))
  );

  // ── Subgroup evaluation (general mixed-case support) ─────────────────────────
  // When groundTruth.expectedSubgroups is present, evaluate each sub-group
  // independently. A case is fully correct only when ALL sub-groups are correct.
  // This supports mixed cases (e.g. adjustment: part match + part exception).
  if (groundTruth.expectedSubgroups && groundTruth.expectedSubgroups.length > 0) {
    let allSubgroupsCorrect = true;
    let anyFalseMatch = false;
    const subgroupNotes: string[] = [];

    for (const sg of groundTruth.expectedSubgroups) {
      // Map sub-group external refs to normalized IDs
      const sgNormIds = new Set(
        sg.externalRefs.map(ref => externalRefToId.get(ref)).filter(Boolean) as string[]
      );

      const sgDecisions = relevantDecisions.filter(d =>
        d.sourceRecordIds.some(id => sgNormIds.has(id))
      );
      const sgExceptions = relevantExceptions.filter(e =>
        e.sourceRecordIds.some(id => sgNormIds.has(id))
      );

      if (sg.outcome === 'match') {
        // Sub-group should be matched/explained by the engine
        if (sgDecisions.length === 0) {
          allSubgroupsCorrect = false;
          subgroupNotes.push(`Sub-group [${sg.externalRefs.join(',')}] expected match, got no decision.`);
        } else {
          // Check coverage: best decision covers ≥50% of expected records
          const bestDecision = sgDecisions.reduce((best, d) =>
            d.sourceRecordIds.filter(id => sgNormIds.has(id)).length >
            best.sourceRecordIds.filter(id => sgNormIds.has(id)).length ? d : best
          );
          const covered = bestDecision.sourceRecordIds.filter(id => sgNormIds.has(id)).length;
          const coverage = sgNormIds.size > 0 ? covered / sgNormIds.size : 0;
          if (coverage < 0.5) {
            allSubgroupsCorrect = false;
            subgroupNotes.push(`Sub-group match coverage too low: ${(coverage*100).toFixed(0)}%.`);
          } else {
            subgroupNotes.push(`Sub-group match OK (coverage ${(coverage*100).toFixed(0)}%).`);
          }
        }
      } else {
        // Sub-group should be an exception (no decision covering it)
        const decisionsOnExceptionGroup = sgDecisions.filter(d =>
          d.sourceRecordIds.some(id => sgNormIds.has(id))
        );
        if (decisionsOnExceptionGroup.length > 0) {
          anyFalseMatch = true;
          allSubgroupsCorrect = false;
          subgroupNotes.push(`Sub-group [${sg.externalRefs.join(',')}] expected exception, but engine produced a decision — UNSAFE MATCH.`);
        } else {
          // Correctly left as exception or unresolved
          subgroupNotes.push(`Sub-group exception OK (no unsafe decision).`);
        }
      }
    }

    const isUnresolved = !allSubgroupsCorrect && !anyFalseMatch;
    return {
      scenario: syntheticCase.scenario,
      isTrap,
      correct: allSubgroupsCorrect,
      falseMatch: anyFalseMatch,
      unresolved: isUnresolved,
      notes: subgroupNotes.join(' | '),
    };
  }

  // ── Single-group evaluation (standard cases) ──────────────────────────────────
  const exp = expectedEngineStatus(expectedStatus);
  const isExpectedException = exp === 'exception' || exp === 'UNRESOLVED';

  if (isExpectedException) {
    if (relevantDecisions.length > 0) {
      // Engine matched records that should be exceptions → UNSAFE MATCH
      return { scenario: syntheticCase.scenario, isTrap, correct: false, falseMatch: isTrap, unresolved: false,
        notes: `Expected exception but engine produced ${relevantDecisions.length} decision(s) — unsafe match.` };
    }
    // No decision (with or without exception raised) → correct
    const hasException = relevantExceptions.length > 0;
    return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: !hasException,
      notes: hasException ? 'Correctly classified as exception.' : 'Correctly left unresolved (safe).' };
  }

  // Expected a match/explanation
  if (relevantDecisions.length === 0) {
    return { scenario: syntheticCase.scenario, isTrap, correct: false, falseMatch: false, unresolved: true,
      notes: 'Expected match but engine produced no decision.' };
  }

  // Check coverage of best decision against expected group
  const expectedNormIds = new Set(
    (groundTruth.expectedMatchGroup ?? [])
      .map(ref => externalRefToId.get(ref))
      .filter(Boolean) as string[]
  );
  const bestDecision: EngineMatchDecision = relevantDecisions.reduce((best, d) =>
    d.sourceRecordIds.filter(id => expectedNormIds.has(id)).length >
    best.sourceRecordIds.filter(id => expectedNormIds.has(id)).length ? d : best
  );
  const coveredExpected = bestDecision.sourceRecordIds.filter(id => expectedNormIds.has(id)).length;
  const totalExpected = expectedNormIds.size;
  const coverage = totalExpected > 0 ? coveredExpected / totalExpected : 0;

  // Status check: EXPLAINED satisfies 'MATCHED' (discrepancy is accounted for by rules)
  const statusOk =
    bestDecision.status === exp ||
    (exp === 'MATCHED' && bestDecision.status === 'EXPLAINED') ||
    (exp === 'EXPLAINED' && bestDecision.status === 'MATCHED');

  if (coverage >= 0.5 && statusOk) {
    return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: false,
      notes: `Matched with coverage ${(coverage * 100).toFixed(0)}%.` };
  }
  return { scenario: syntheticCase.scenario, isTrap, correct: false, falseMatch: false, unresolved: false,
    notes: `Insufficient coverage (${(coverage * 100).toFixed(0)}%) or status mismatch (got ${bestDecision.status}, expected ${exp}).` };
}
 * LedgerLens Reconciliation Ã¢â‚¬â€ Evaluate
 *
 * Evaluation harness: compares engine output against independent ground truth
 * at the CASE level.
 *
 * CRITICAL BOUNDARY:
 *   isTrap and groundTruth are accessed ONLY in this file.
 *   They are NEVER imported or used in engine.ts or any matching module.
 *
 * Case-level evaluation (Correction #5):
 * For each SyntheticCase, evaluate:
 * 1. Whether the correct relationship was discovered (right records grouped).
 * 2. Whether the financial outcome was correctly classified.
 * 3. Whether an unsafe match occurred (records from different true groups merged).
 *
 * Metrics are computed from actual engine output Ã¢â‚¬â€ never hard-coded.
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 */
import type {
  SyntheticCase,
  NormalizedRecord,
  EngineResult,
  EvaluationResult,
  ScenarioMetrics,
  ReconStatus,
  EngineMatchDecision,
} from '../domain/types';
import { runReconciliationEngine } from './engine';
import { normalizeFromDataset } from './normalize';
import { runExactMatch } from './exact-match';
import { deterministicId } from '../lib/deterministic';
import { classifyUnsupportedCase } from './classify-exception';

// ============================================================
// Expected status mapping
// Maps ground truth expectedStatus to engine ReconStatus
// ============================================================

function expectedEngineStatus(groundTruthStatus: string): ReconStatus | 'exception' {
  switch (groundTruthStatus) {
    case 'matched':
      return 'MATCHED';
    case 'partial_match':
      return 'EXPLAINED'; // fee-tax cases Ã¢â€ â€™ EXPLAINED in our model
    case 'exception':
    case 'unmatched':
      return 'exception';
    default:
      return 'UNRESOLVED';
  }
}

// ============================================================
// Case evaluation
// ============================================================

interface CaseEvaluation {
  scenario: string;
  isTrap: boolean;
  correct: boolean;
  falseMatch: boolean;
  unresolved: boolean;
  notes: string;
}

function evaluateCase(
  syntheticCase: SyntheticCase,
  caseRecords: NormalizedRecord[],
  engineResult: EngineResult
): CaseEvaluation {
  const { groundTruth } = syntheticCase;
  // isTrap is only used here in evaluate.ts
  const { isTrap, expectedMatchGroup, expectedStatus } = groundTruth;

  const expectedIds = new Set(expectedMatchGroup);

  // Build normalized ID Ã¢â€ â€™ ground truth external ref mapping
  // (groundTruth uses external refs like paymentId, merchantTxnId, bankRef)
  const externalRefToId = new Map<string, string>();
  for (const r of caseRecords) {
    externalRefToId.set(r.externalRef, r.id);
  }

  // Map groundTruth external refs to normalized IDs
  const expectedNormIds = new Set<string>();
  for (const extRef of expectedIds) {
    const normId = externalRefToId.get(extRef);
    if (normId) expectedNormIds.add(normId);
  }

  const caseRecordIds = new Set(caseRecords.map((r) => r.id));

  // Find decisions that involve at least one record from this case
  const relevantDecisions = engineResult.decisions.filter((d) =>
    d.sourceRecordIds.some((id) => caseRecordIds.has(id))
  );
  const relevantExceptions = engineResult.exceptions.filter((e) =>
    e.sourceRecordIds.some((id) => caseRecordIds.has(id))
  );

  // ── Subgroup evaluation (mixed-case support) ─────────────────────────────────
  // When groundTruth.expectedSubgroups is present, evaluate each sub-group
  // independently. Supports mixed cases (e.g. adjustment: part match + part exception).
  // BOUNDARY: uses groundTruth only here in evaluate.ts.
  if (groundTruth.expectedSubgroups && groundTruth.expectedSubgroups.length > 0) {
    let allSubgroupsCorrect = true;
    let anyFalseMatch = false;
    const subgroupNotes: string[] = [];

    for (const sg of groundTruth.expectedSubgroups) {
      const sgNormIds = new Set(
        sg.externalRefs.map((ref) => externalRefToId.get(ref)).filter(Boolean) as string[]
      );
      const sgDecisions = relevantDecisions.filter((d) =>
        d.sourceRecordIds.some((id) => sgNormIds.has(id))
      );

      if (sg.outcome === 'match') {
        if (sgDecisions.length === 0) {
          allSubgroupsCorrect = false;
          subgroupNotes.push(`Sub-group [${sg.externalRefs.join(',')}] expected match, got no decision.`);
        } else {
          const bestDecision = sgDecisions.reduce((best, d) =>
            d.sourceRecordIds.filter((id) => sgNormIds.has(id)).length >
            best.sourceRecordIds.filter((id) => sgNormIds.has(id)).length ? d : best
          );
          const covered = bestDecision.sourceRecordIds.filter((id) => sgNormIds.has(id)).length;
          const coverage = sgNormIds.size > 0 ? covered / sgNormIds.size : 0;
          if (coverage < 0.5) {
            allSubgroupsCorrect = false;
            subgroupNotes.push(`Sub-group match coverage too low: ${(coverage * 100).toFixed(0)}%.`);
          } else {
            subgroupNotes.push(`Sub-group match OK (coverage ${(coverage * 100).toFixed(0)}%).`);
          }
        }
      } else {
        // outcome === 'exception': engine must NOT produce a decision for this sub-group
        if (sgDecisions.length > 0) {
          anyFalseMatch = true;
          allSubgroupsCorrect = false;
          subgroupNotes.push(
            `Sub-group [${sg.externalRefs.join(',')}] expected exception, engine produced a decision — UNSAFE MATCH.`
          );
        } else {
          subgroupNotes.push(`Sub-group exception OK (no unsafe decision).`);
        }
      }
    }

    const isUnresolved = !allSubgroupsCorrect && !anyFalseMatch;
    return {
      scenario: syntheticCase.scenario,
      isTrap,
      correct: allSubgroupsCorrect,
      falseMatch: anyFalseMatch,
      unresolved: isUnresolved,
      notes: subgroupNotes.join(' | '),
    };
  }

  const exp = expectedEngineStatus(expectedStatus);

  // Is it an exception/unresolved case?
  const isExpectedException = exp === 'exception' || exp === 'UNRESOLVED';

  if (isExpectedException) {
    if (relevantExceptions.length > 0 && relevantDecisions.length === 0) {
      // Engine correctly raised exception(s) for this case
      return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: true, notes: 'Correctly classified as exception.' };
    }
    if (relevantDecisions.length > 0) {
      // Engine incorrectly matched records that should be exceptions
      return { scenario: syntheticCase.scenario, isTrap, correct: false, falseMatch: isTrap, unresolved: false, notes: `Expected exception but engine produced ${relevantDecisions.length} decision(s).` };
    }
    // No decision, no exception Ã¢â‚¬â€ also unresolved (acceptable)
    return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: true, notes: 'Unresolved (no decision, no exception) Ã¢â‚¬â€ acceptable for exception cases.' };
  }

  // Expected a match (MATCHED or EXPLAINED)
  if (relevantDecisions.length === 0) {
    // Engine left this as unresolved
    return { scenario: syntheticCase.scenario, isTrap, correct: false, falseMatch: false, unresolved: true, notes: 'Expected match but engine produced no decision.' };
  }

  // Check if the correct records are grouped together
  // For trap cases: check that records from group A are NOT merged with group B
  if (isTrap) {
    // Trap case: the engine must produce separate decisions for each sub-group
    // A trap has two independent transactions (A and B) that must NOT be cross-matched
    // expectedMatchGroup contains BOTH groups Ã¢â‚¬â€ we need to verify no decision spans both
    // A false match occurs if any single decision contains records from BOTH sub-groups
    // Sub-group A = first half of records (by index in caseRecords, by source ordering)
    // We detect cross-group merging by checking if a decision spans the paymentRef boundary
    for (const decision of relevantDecisions) {
      const decisionPaymentRefs = new Set(
        decision.sourceRecordIds
          .map(id => caseRecords.find(r => r.id === id))
          .filter(Boolean)
          .map(r => r!.paymentRef)
          .filter(Boolean)
      );
      if (decisionPaymentRefs.size > 1) {
        // Decision spans multiple paymentRefs Ã¢â‚¬â€ this is a false cross-group match
        return {
          scenario: syntheticCase.scenario, isTrap,
          correct: false, falseMatch: true, unresolved: false,
          notes: `TRAP VIOLATION: decision merged records from different transaction groups (paymentRefs: ${[...decisionPaymentRefs].join(', ')}).`
        };
      }
    }
    // No cross-group merging detected
    return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: false, notes: 'Trap case: each group matched separately. No cross-group merging.' };
  }

  // Non-trap: verify that the correct records are grouped
  // Find the decision that covers the most expected records
  let bestDecision = relevantDecisions[0];
  let bestOverlap = 0;
  for (const d of relevantDecisions) {
    const overlap = d.sourceRecordIds.filter(id => expectedNormIds.has(id)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestDecision = d;
    }
  }

  const coveredExpected = bestDecision.sourceRecordIds.filter(id => expectedNormIds.has(id)).length;
  const totalExpected = expectedNormIds.size;
  // Consider correct if Ã¢â€°Â¥ 50% of expected records are covered (accounts for
  // cases where some records were in exceptions vs decisions)
  const coverage = totalExpected > 0 ? coveredExpected / totalExpected : 0;

  // Check status matches
  // EXPLAINED is a correct outcome when ground truth is 'matched' Ã¢â‚¬â€
  // a discrepancy fully accounted for by rules IS a financially reconciled match.
  // This is required for clean-match cases that have fee deductions.
  const statusOk =
    bestDecision.status === exp ||
    (exp === 'MATCHED' && bestDecision.status === 'EXPLAINED') ||
    (exp === 'EXPLAINED' && bestDecision.status === 'MATCHED');

  if (coverage >= 0.5 && statusOk) {
    return { scenario: syntheticCase.scenario, isTrap, correct: true, falseMatch: false, unresolved: false, notes: `Matched with coverage ${(coverage * 100).toFixed(0)}%.` };
  }

  return {
    scenario: syntheticCase.scenario, isTrap,
    correct: false, falseMatch: false, unresolved: false,
    notes: `Insufficient coverage (${(coverage * 100).toFixed(0)}%) or status mismatch (got ${bestDecision.status}, expected ${exp}).`
  };
}

// ============================================================
// Full evaluation
// ============================================================

export interface EvaluationReport {
  engine: EvaluationResult;
  baseline: EvaluationResult;
  engineVsBaseline: {
    correctMatchesDelta: number;
    falseMatchesDelta: number;
    unresolvedDelta: number;
  };
}

/**
 * Evaluates the full engine against all synthetic cases.
 *
 * @param cases - All synthetic cases (includes groundTruth Ã¢â‚¬â€ used ONLY in this file)
 * @param runId - Run identifier
 */
export function evaluateEngine(cases: SyntheticCase[], runId: string): EvaluationReport {
  // Normalize all records (same process as production Ã¢â‚¬â€ no ground truth access)
  const allRecords = normalizeFromDataset(cases, runId);

  // Run full engine
  const engineResult = runReconciliationEngine(runId, allRecords);

  // Run baseline (exact-match only Ã¢â‚¬â€ no rule/batch stages)
  const baselineResult = runBaselineEngine(runId, allRecords);

  // Build case Ã¢â€ â€™ records mapping
  const caseRecordSets: Array<{ syntheticCase: SyntheticCase; records: NormalizedRecord[] }> = [];
  for (const c of cases) {
    const caseExternalRefs = new Set([
      ...c.merchantRecords.map(m => m.merchantTxnId),
      ...c.razorpayRecords.map(r => r.paymentId),
      ...c.bankRecords.map(b => b.bankRef),
    ]);
    const caseRecords = allRecords.filter(r => caseExternalRefs.has(r.externalRef));
    caseRecordSets.push({ syntheticCase: c, records: caseRecords });
  }

  function computeMetrics(result: EngineResult): EvaluationResult {
    const byScenario: Record<string, ScenarioMetrics> = {};
    let fullyCorrectResolved = 0, incorrectResolved = 0, correctUnresolved = 0, incorrectUnresolved = 0;
    let falseMatches = 0, trapFalseMatches = 0;
    for (const { syntheticCase, records } of caseRecordSets) {
      const eval_ = evaluateCase(syntheticCase, records, result);
      const scenario = eval_.scenario;
      if (!byScenario[scenario]) byScenario[scenario] = { scenario, totalCases: 0, correctMatches: 0, incorrectMatches: 0, unresolvedCases: 0, falseMatches: 0, trapFalseMatches: 0 };
      byScenario[scenario].totalCases++;
      const caseIds = new Set(records.map(r => r.id));
      const engineDecided = result.decisions.some(d => d.sourceRecordIds.some(id => caseIds.has(id)));
      if (eval_.correct && !eval_.unresolved && engineDecided) { fullyCorrectResolved++; byScenario[scenario].correctMatches++; }
      else if (eval_.correct && eval_.unresolved) { correctUnresolved++; byScenario[scenario].correctMatches++; byScenario[scenario].unresolvedCases++; }
      else if (eval_.unresolved && !eval_.correct) { incorrectUnresolved++; byScenario[scenario].unresolvedCases++; byScenario[scenario].incorrectMatches++; }
      else { incorrectResolved++; byScenario[scenario].incorrectMatches++; }
      if (eval_.falseMatch) {
        falseMatches++; byScenario[scenario].falseMatches++;
        if (eval_.isTrap) { trapFalseMatches++; byScenario[scenario].trapFalseMatches++; }
      }
    }
    const resolvedTotal = fullyCorrectResolved + incorrectResolved;
    const precision = resolvedTotal > 0 ? fullyCorrectResolved / resolvedTotal : 0;
    const matchableCases = caseRecordSets.filter(({ syntheticCase: sc }) => {
      if (sc.groundTruth.expectedSubgroups) return sc.groundTruth.expectedSubgroups.some(sg => sg.outcome === 'match');
      const exp = expectedEngineStatus(sc.groundTruth.expectedStatus);
      return exp !== 'exception' && exp !== 'UNRESOLVED';
    }).length;
    const recall = matchableCases > 0 ? fullyCorrectResolved / matchableCases : 0;
    const total = cases.length;
    const casesWithDecision = caseRecordSets.filter(({ records }) => {
      const ids = new Set(records.map(r => r.id));
      return result.decisions.some(d => d.sourceRecordIds.some(id => ids.has(id)));
    }).length;
    const matchRate = total > 0 ? casesWithDecision / total : 0;
    const correct = fullyCorrectResolved + correctUnresolved;
    const incorrect = incorrectResolved + incorrectUnresolved;
    const unresolved = correctUnresolved + incorrectUnresolved;
    return { totalCases: total, correctMatches: correct, incorrectMatches: incorrect, unresolvedCases: unresolved, precision, recall, matchRate, falseMatches, trapFalseMatches, byScenario };
  }

  const engineMetrics = computeMetrics(engineResult);
  const baselineMetrics = computeMetrics(baselineResult);

  return {
    engine: engineMetrics,
    baseline: baselineMetrics,
    engineVsBaseline: {
      correctMatchesDelta: engineMetrics.correctMatches - baselineMetrics.correctMatches,
      falseMatchesDelta: engineMetrics.falseMatches - baselineMetrics.falseMatches,
      unresolvedDelta: engineMetrics.unresolvedCases - baselineMetrics.unresolvedCases,
    },
  };
}

// ============================================================
// Baseline engine: Stage 1 (exact-match) only
// Used to quantify how much rule/batch stages improve over exact matching.
// ============================================================

function runBaselineEngine(runId: string, records: NormalizedRecord[]): EngineResult {
  const exactResult = runExactMatch(records);
  const decisions: EngineMatchDecision[] = [];
  const consumedIds = new Set<string>();

  for (const candidate of exactResult.paymentRefCandidates) {
    const merchant = candidate.records.find(r => r.source === 'merchant');
    const razorpay = candidate.records.find(r => r.source === 'razorpay');
    if (!merchant || !razorpay) continue;
    if (consumedIds.has(merchant.id) || consumedIds.has(razorpay.id)) continue;

    const id = deterministicId('base', runId, merchant.id, razorpay.id);
    const times = [merchant, razorpay]
      .map(r => (r.occurredAt instanceof Date ? r.occurredAt.getTime() : new Date(r.occurredAt as string).getTime()));
    const createdAt = new Date(Math.min(...times)).toISOString();

    decisions.push({
      id, runId,
      sourceRecordIds: [merchant.id, razorpay.id],
      status: 'MATCHED',
      matchType: 'exact-payment-ref',
      differencePaise: 0,
      evidence: `Baseline: matched by identical paymentRef ${candidate.linkingIdentifier}.`,
      createdAt,
    });
    consumedIds.add(merchant.id);
    consumedIds.add(razorpay.id);
  }

  // Remaining unmatched Ã¢â€ â€™ classified as UNSUPPORTED_CASE
  const exceptions = records
    .filter(r => !consumedIds.has(r.id))
    .map(r => classifyUnsupportedCase(`${runId}-baseline`, [r]));

  return { runId: `${runId}-baseline`, decisions, exceptions, auditEvents: [] };
}
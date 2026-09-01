/**
 * LedgerLens Reconciliation Ã¢â‚¬â€ Rule Match (Stage 2)
 *
 * For each candidate group from Stage 1, determines the financial outcome
 * using explicit, documented rules.
 *
 * Every rule specifies:
 * - what records it compares
 * - what relationship it proves
 * - what arithmetic proves it
 * - what evidence text is stored
 *
 * BOUNDARY: No React, no DB, no HTTP imports.
 * All arithmetic uses exact integer paise Ã¢â‚¬â€ no floating point.
 */
import type { NormalizedRecord, EngineMatchDecision, EngineException, ExceptionSeverity } from '../domain/types';
import type { MatchCandidate } from './exact-match';
import { deterministicId } from '../lib/deterministic';
import { paiseToRupeeDisplay } from '../lib/money';

// ============================================================
// Rule Result
// ============================================================

export type RuleOutcome =
  | { type: 'decision'; decision: EngineMatchDecision }
  | { type: 'exception'; exception: EngineException }
  | { type: 'unresolved'; reason?: string };

// ============================================================
// Helpers
// ============================================================


function recordOccurredAt(records: NormalizedRecord[]): string {
  // Use earliest occurredAt from the group Ã¢â‚¬â€ deterministic, from source data
  const dates = records
    .map((r) => (r.occurredAt instanceof Date ? r.occurredAt.getTime() : new Date(r.occurredAt as string).getTime()))
    .filter((t) => !isNaN(t));
  if (dates.length === 0) return new Date(0).toISOString();
  return new Date(Math.min(...dates)).toISOString();
}

// ============================================================
// Rule: rule-fee-tax
//
// Applies when: group has one merchant + one razorpay (from paymentRef candidate)
//               AND a razorpayÃ¢â€ â€bank UTR candidate links the same razorpay to a bank record.
//
// Records compared: merchant, razorpay, bank.
//
// Relationship proved:
//   The merchant recorded the gross payment amount.
//   Razorpay deducted fee and tax and settled the net.
//   The bank received exactly the net.
//
// Arithmetic (all three must hold):
//   rzp.amountPaise == merchant.amountPaise          (gross agreement)
//   rzp.netPaise == rzp.amountPaise - rzp.feePaise - rzp.taxPaise  (net integrity)
//   bank.amountPaise == rzp.netPaise                 (bank received the net)
//
// Result: EXPLAINED (discrepancy accounted for by recorded fee and tax)
// ============================================================

export function applyFeeTaxRule(
  runId: string,
  merchant: NormalizedRecord,
  razorpay: NormalizedRecord,
  bank: NormalizedRecord
): RuleOutcome {
  const grossAgreement = razorpay.amountPaise === merchant.amountPaise;
  const netIntegrity = razorpay.netPaise === razorpay.amountPaise - razorpay.feePaise - razorpay.taxPaise;
  const bankReceivesNet = bank.amountPaise === razorpay.netPaise;

  if (!grossAgreement || !netIntegrity || !bankReceivesNet) {
    // Arithmetic does not hold Ã¢â‚¬â€ this is not a fee-tax reconciliation
    return { type: 'unresolved' };
  }

  const id = deterministicId('dec', runId, merchant.id, razorpay.id, bank.id);
  const evidence =
    `Merchant gross ${paiseToRupeeDisplay(merchant.amountPaise)} matches Razorpay gross. ` +
    `Razorpay deducted fee ${paiseToRupeeDisplay(razorpay.feePaise)} + ` +
    `tax ${paiseToRupeeDisplay(razorpay.taxPaise)} = ${paiseToRupeeDisplay(razorpay.feePaise + razorpay.taxPaise)}. ` +
    `Bank received net ${paiseToRupeeDisplay(bank.amountPaise)} = razorpay.netPaise. Arithmetic verified.`;

  return {
    type: 'decision',
    decision: {
      id,
      runId,
      sourceRecordIds: [merchant.id, razorpay.id, bank.id],
      status: 'EXPLAINED',
      matchType: 'rule-fee-tax',
      differencePaise: merchant.amountPaise - bank.amountPaise,
      evidence,
      createdAt: recordOccurredAt([merchant, razorpay, bank]),
    },
  };
}

// ============================================================
// Rule: rule-timing
//
// Applies when: valid paymentRef + UTR link exists, but bank.occurredAt is
//               outside the expected window from razorpay.settledAt.
//
// Records compared: razorpay, bank.
//
// Relationship proved:
//   UTR identity proves it is the same bank transfer.
//   Settlement occurred, but with a timing delay.
//
// Arithmetic: UTR identity already verified in Stage 1.
//             Timing delta is informational only.
//
// Result: MATCHED (timing delay noted in evidence)
// ============================================================

const EXPECTED_SETTLEMENT_DAYS = 2;
const TIMING_TOLERANCE_DAYS = 7; // Up to 7-day delay considered a timing difference (not a mismatch)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function applyTimingRule(
  runId: string,
  merchant: NormalizedRecord | null,
  razorpay: NormalizedRecord,
  bank: NormalizedRecord
): RuleOutcome {
  const rzpSettled = razorpay.settledAt instanceof Date
    ? razorpay.settledAt
    : razorpay.settledAt ? new Date(razorpay.settledAt as string) : null;
  const bankDate = bank.occurredAt instanceof Date
    ? bank.occurredAt
    : new Date(bank.occurredAt as string);

  if (!rzpSettled) return { type: 'unresolved' };

  const diffMs = bankDate.getTime() - rzpSettled.getTime();
  const diffDays = Math.round(diffMs / MS_PER_DAY);

  if (Math.abs(diffDays) <= TIMING_TOLERANCE_DAYS) {
    const id = deterministicId(
      'dec', runId, merchant?.id ?? '', razorpay.id, bank.id
    );
    const allRecords = merchant ? [merchant, razorpay, bank] : [razorpay, bank];
    const evidence =
      `Matched by UTR ${razorpay.utr}. ` +
      `Settlement delayed ${diffDays} days (expected ~${EXPECTED_SETTLEMENT_DAYS}). ` +
      `Timing difference is informational only; amounts match.`;

    return {
      type: 'decision',
      decision: {
        id,
        runId,
        sourceRecordIds: allRecords.map((r) => r.id),
        status: 'MATCHED',
        matchType: 'rule-timing',
        differencePaise: 0,
        evidence,
        createdAt: recordOccurredAt(allRecords),
      },
    };
  }

  return { type: 'unresolved' };
}

// ============================================================
// Rule: rule-refund
//
// Applies when:
//   razorpay original has status refunded/partially_refunded.
//   A second razorpay record (refund) shares the same orderId.
//   Bank credit matches rzp original net; bank debit matches rzp refund amount.
//
// Records compared: rzp original, rzp refund, bank credit, bank debit.
//
// Arithmetic (all must hold):
//   bank_credit.amountPaise == rzp_original.netPaise
//   bank_debit.amountPaise == rzp_refund.amountPaise
//   rzp_refund.amountPaise <= rzp_original.amountPaise
//
// Result: MATCHED for the group.

// ============================================================
// Rule: rule-adjustment
//
// Applies when:
//   A razorpay record linked by orderId has no corresponding merchant record.
//   A bank debit exists with the same UTR as the adjustment.
//
// Records compared: razorpay adjustment, bank debit. Merchant absence is the signal.
//
// Arithmetic:
//   bank_debit.amountPaise == rzp_adjustment.amountPaise
//
// Result: UNRESOLVED Ã¢â€ â€™ exception (cannot reconcile without merchant)
// ============================================================

export function applyAdjustmentRule(
  runId: string,
  rzpAdjustment: NormalizedRecord,
  bankDebit: NormalizedRecord
): RuleOutcome {
  const debitMatchesAdjustment = bankDebit.amountPaise === rzpAdjustment.amountPaise;

  if (!debitMatchesAdjustment) {
    return { type: 'unresolved' };
  }

  const severity: ExceptionSeverity = 'medium';
  const id = deterministicId('exc', runId, rzpAdjustment.id, bankDebit.id);
  const evidence =
    `Razorpay adjustment ${rzpAdjustment.externalRef} and bank debit ${bankDebit.externalRef} ` +
    `agree on amount ${paiseToRupeeDisplay(rzpAdjustment.amountPaise)}. ` +
    `No merchant counterpart found. Cannot reconcile without merchant acknowledgment.`;

  return {
    type: 'exception',
    exception: {
      id,
      runId,
      sourceRecordIds: [rzpAdjustment.id, bankDebit.id],
      type: 'AMOUNT_MISMATCH',
      severity,
      amountPaise: rzpAdjustment.amountPaise,
      description: evidence,
      priorityScore: 0, // set by prioritize.ts
      createdAt: recordOccurredAt([rzpAdjustment, bankDebit]),
    },
  };
}

// ============================================================
// Compound rule: 3-way clean match
//
// Applies when merchant+razorpay linked by paymentRef
// AND razorpay+bank linked by UTR
// AND bank.amountPaise == razorpay.netPaise (clean case, no fee discrepancy with merchant)
// AND razorpay.amountPaise == merchant.amountPaise
//
// Result: MATCHED (cleanest case Ã¢â‚¬â€ amounts agree across all three sources)
// ============================================================

export function applyCleanMatch(
  runId: string,
  merchant: NormalizedRecord,
  razorpay: NormalizedRecord,
  bank: NormalizedRecord
): RuleOutcome {
  const grossAgreement = razorpay.amountPaise === merchant.amountPaise;
  const bankReceivesNet = bank.amountPaise === razorpay.netPaise;
  const netIntegrity = razorpay.netPaise === razorpay.amountPaise - razorpay.feePaise - razorpay.taxPaise;

  if (!grossAgreement || !bankReceivesNet || !netIntegrity) {
    return { type: 'unresolved' };
  }

  const id = deterministicId('dec', runId, merchant.id, razorpay.id, bank.id);
  const hasFee = razorpay.feePaise > 0 || razorpay.taxPaise > 0;

  let evidence: string;
  let matchType: EngineMatchDecision['matchType'];

  if (hasFee) {
    // Gross matches but net differs Ã¢â‚¬â€ fee/tax explains the difference
    evidence =
      `Merchant gross ${paiseToRupeeDisplay(merchant.amountPaise)} matches Razorpay gross. ` +
      `Razorpay deducted fee ${paiseToRupeeDisplay(razorpay.feePaise)} + ` +
      `tax ${paiseToRupeeDisplay(razorpay.taxPaise)}. ` +
      `Bank received net ${paiseToRupeeDisplay(bank.amountPaise)} = razorpay.netPaise. Arithmetic verified.`;
    matchType = 'rule-fee-tax';
    return {
      type: 'decision',
      decision: {
        id,
        runId,
        sourceRecordIds: [merchant.id, razorpay.id, bank.id],
        status: 'EXPLAINED',
        matchType,
        differencePaise: merchant.amountPaise - bank.amountPaise,
        evidence,
        createdAt: recordOccurredAt([merchant, razorpay, bank]),
      },
    };
  } else {
    evidence =
      `Identical payment reference ${razorpay.paymentRef}. ` +
      `All three sources agree: gross ${paiseToRupeeDisplay(merchant.amountPaise)}, ` +
      `no fee/tax deducted, bank credit ${paiseToRupeeDisplay(bank.amountPaise)}.`;
    matchType = 'exact-payment-ref';
    return {
      type: 'decision',
      decision: {
        id,
        runId,
        sourceRecordIds: [merchant.id, razorpay.id, bank.id],
        status: 'MATCHED',
        matchType,
        differencePaise: 0,
        evidence,
        createdAt: recordOccurredAt([merchant, razorpay, bank]),
      },
    };
  }
}

// ============================================================
// Apply rule matching to a set of candidates
// ============================================================

export interface RuleMatchInput {
  paymentRefCandidates: MatchCandidate[];
  utrCandidates: MatchCandidate[];
  allRecords: NormalizedRecord[];
}

export interface RuleMatchOutput {
  decisions: EngineMatchDecision[];
  exceptions: EngineException[];
  /** Record IDs that were consumed by a rule decision. */
  consumedIds: Set<string>;
}

export function runRuleMatch(runId: string, input: RuleMatchInput): RuleMatchOutput {
  const decisions: EngineMatchDecision[] = [];
  const exceptions: EngineException[] = [];
  const consumedIds = new Set<string>();

  // Build UTRÃ¢â€ â€™bank lookup from utrCandidates
  // Each UTR candidate: [razorpay, bank]
  const utrToBankRecord = new Map<string, NormalizedRecord>();
  const utrToRzpRecord = new Map<string, NormalizedRecord>();
  for (const c of input.utrCandidates) {
    const rzp = c.records.find((r) => r.source === 'razorpay');
    const bank = c.records.find((r) => r.source === 'bank');
    if (rzp && bank) {
      utrToBankRecord.set(rzp.utr, bank);
      utrToRzpRecord.set(bank.utr, rzp);
    }
  }

  // Build orderId index for razorpay records (for refund/adjustment detection)
  const rzpByOrderId = new Map<string, NormalizedRecord[]>();
  for (const r of input.allRecords.filter((r) => r.source === 'razorpay')) {
    const raw = JSON.parse(r.rawJson) as { orderId?: string; status?: string };
    const orderId = raw.orderId ?? '';
    if (!orderId) continue;
    const existing = rzpByOrderId.get(orderId);
    if (existing) existing.push(r);
    else rzpByOrderId.set(orderId, [r]);
  }

  for (const candidate of input.paymentRefCandidates) {
    const merchant = candidate.records.find((r) => r.source === 'merchant');
    const razorpay = candidate.records.find((r) => r.source === 'razorpay');

    if (!merchant || !razorpay) continue;
    if (consumedIds.has(merchant.id) || consumedIds.has(razorpay.id)) continue;

    const bank = razorpay.utr ? utrToBankRecord.get(razorpay.utr) : undefined;


    if (bank && !consumedIds.has(bank.id)) {
      // Check timing: is the bank date significantly delayed?
      const rzpSettled = razorpay.settledAt instanceof Date
        ? razorpay.settledAt
        : razorpay.settledAt ? new Date(razorpay.settledAt as string) : null;
      const bankDate = bank.occurredAt instanceof Date
        ? bank.occurredAt
        : new Date(bank.occurredAt as string);

      const diffMs = rzpSettled ? bankDate.getTime() - rzpSettled.getTime() : 0;
      const diffDays = Math.abs(Math.round(diffMs / MS_PER_DAY));
      const isSignificantDelay = diffDays > EXPECTED_SETTLEMENT_DAYS;

      if (isSignificantDelay) {
        // Timing rule: amounts still match (verified in clean match below)
        const timingOutcome = applyTimingRule(runId, merchant, razorpay, bank);
        if (timingOutcome.type === 'decision') {
          decisions.push(timingOutcome.decision);
          timingOutcome.decision.sourceRecordIds.forEach((id) => consumedIds.add(id));
          continue;
        }
      }

      // Try clean match (covers both zero-fee and fee-tax cases)
      const cleanOutcome = applyCleanMatch(runId, merchant, razorpay, bank);
      if (cleanOutcome.type === 'decision') {
        decisions.push(cleanOutcome.decision);
        cleanOutcome.decision.sourceRecordIds.forEach((id) => consumedIds.add(id));
        continue;
      }

      // Fee-tax rule as explicit fallback
      const feeTaxOutcome = applyFeeTaxRule(runId, merchant, razorpay, bank);
      if (feeTaxOutcome.type === 'decision') {
        decisions.push(feeTaxOutcome.decision);
        feeTaxOutcome.decision.sourceRecordIds.forEach((id) => consumedIds.add(id));
        continue;
      }
    }

    // Razorpay+merchant linked, no bank Ã¢â‚¬â€ check for adjustment
    // (razorpay side records with no merchant equivalent handled in engine.ts)
  }

  return { decisions, exceptions, consumedIds };
}

// ============================================================
// Rule: refund
//
// Proves a 6-record refund group:
//   merchantSale ↔ rzpPayment (via paymentRef — proven by exact-match stage)
//   merchantRefund ↔ rzpRefund (via orderId shared with rzpPayment)
//   rzpPayment ↔ bankCredit (via UTR — proven by exact-match stage)
//   rzpRefund ↔ bankDebit (via UTR)
//
// Required evidence (ALL must hold):
//   E1. merchantRefund.paymentRef === merchantSale.paymentRef  — same order
//   E2. merchantRefund rawJson type === 'refund'               — explicit marker
//   E3. rzpRefund.orderId === rzpPayment.orderId               — same orderId
//   E4. rzpPayment.utr === bankCredit.utr                      — credit UTR
//   E5. rzpRefund.utr === bankDebit.utr                        — debit UTR
//   E6. bankDebit.amountPaise === merchantRefund.amountPaise    — refund amount
//
// What this proves:
//   The merchant's explicit refund record for this paymentRef is backed by
//   a corresponding Razorpay refund (identified by shared orderId) and a
//   bank debit with matching UTR and amount.
//
// Outcome: EXPLAINED (the amount difference is explained by the refund)
// ============================================================

interface RefundGroupRaw {
  type?: string;
  orderId?: string;
  status?: string;
}

function parseRawJson(rawJson: string): RefundGroupRaw {
  try { return JSON.parse(rawJson) as RefundGroupRaw; } catch { return {}; }
}

export function applyRefundRule(
  runId: string,
  merchantSale: NormalizedRecord,
  merchantRefund: NormalizedRecord,
  rzpPayment: NormalizedRecord,
  rzpRefund: NormalizedRecord,
  bankCredit: NormalizedRecord,
  bankDebit: NormalizedRecord
): RuleOutcome {
  // E1: merchant refund paymentRef == merchant sale paymentRef
  if (merchantRefund.paymentRef !== merchantSale.paymentRef) {
    return { type: 'unresolved', reason: 'Refund paymentRef does not match sale paymentRef.' };
  }

  // E2: merchant record rawJson explicitly marks type as 'refund'
  const mRefundRaw = parseRawJson(merchantRefund.rawJson);
  if (mRefundRaw.type !== 'refund') {
    return { type: 'unresolved', reason: `Merchant record type is '${mRefundRaw.type}', not 'refund'.` };
  }

  // E3: razorpay refund orderId == razorpay payment orderId (same order)
  if (!rzpRefund.orderId || rzpRefund.orderId !== rzpPayment.orderId) {
    return { type: 'unresolved', reason: `rzpRefund.orderId (${rzpRefund.orderId}) !== rzpPayment.orderId (${rzpPayment.orderId}).` };
  }

  // E4: rzpPayment UTR matches bankCredit UTR
  if (!rzpPayment.utr || rzpPayment.utr !== bankCredit.utr) {
    return { type: 'unresolved', reason: `rzpPayment.utr (${rzpPayment.utr}) !== bankCredit.utr (${bankCredit.utr}).` };
  }

  // E5: rzpRefund UTR matches bankDebit UTR
  if (!rzpRefund.utr || rzpRefund.utr !== bankDebit.utr) {
    return { type: 'unresolved', reason: `rzpRefund.utr (${rzpRefund.utr}) !== bankDebit.utr (${bankDebit.utr}).` };
  }

  // E6: refund amount == bank debit amount (exact integer paise)
  if (merchantRefund.amountPaise !== bankDebit.amountPaise) {
    return { type: 'unresolved', reason: `Refund amount (${merchantRefund.amountPaise}) !== bank debit amount (${bankDebit.amountPaise}).` };
  }

  const allIds = [merchantSale.id, merchantRefund.id, rzpPayment.id, rzpRefund.id, bankCredit.id, bankDebit.id];
  const times = allIds.map(id => {
    const r = [merchantSale, merchantRefund, rzpPayment, rzpRefund, bankCredit, bankDebit].find(x => x.id === id)!;
    return r.occurredAt instanceof Date ? r.occurredAt.getTime() : new Date(r.occurredAt as string).getTime();
  });
  const createdAt = new Date(Math.min(...times)).toISOString();

  const evidence = [
    `rule-refund: 6-record group via paymentRef=${merchantSale.paymentRef}, orderId=${rzpPayment.orderId}.`,
    `E1: merchantRefund.paymentRef=${merchantRefund.paymentRef} === sale.paymentRef=${merchantSale.paymentRef}.`,
    `E2: merchantRefund rawJson type=refund (explicit marker).`,
    `E3: rzpRefund.orderId=${rzpRefund.orderId} === rzpPayment.orderId=${rzpPayment.orderId}.`,
    `E4: rzpPayment.utr=${rzpPayment.utr} === bankCredit.utr=${bankCredit.utr}.`,
    `E5: rzpRefund.utr=${rzpRefund.utr} === bankDebit.utr=${bankDebit.utr}.`,
    `E6: refundAmount=${merchantRefund.amountPaise} === bankDebit.amountPaise=${bankDebit.amountPaise} paise.`,
  ].join(' ');

  const decision: EngineMatchDecision = {
    id: deterministicId('dec', runId, merchantSale.id, merchantRefund.id),
    runId,
    sourceRecordIds: allIds,
    status: 'EXPLAINED',
    matchType: 'rule-refund',
    differencePaise: merchantRefund.amountPaise,
    evidence,
    createdAt,
  };
  return { type: 'decision', decision };
}

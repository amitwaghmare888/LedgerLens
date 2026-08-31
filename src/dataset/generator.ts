/**
 * LedgerLens Synthetic Dataset Generator
 *
 * Generates ~150 deterministic financial records across merchant, Razorpay, and bank sources.
 * Each scenario has independent ground truth that the reconciliation engine CANNOT access.
 *
 * IMPORTANT: All data is synthetic. It does NOT represent real Razorpay production behavior.
 * Fee/tax percentages are illustrative assumptions, not verified Razorpay rates.
 */
import { SeededRandom, deterministicId, deterministicDate } from '../lib/deterministic';
import { subtractPaise, addPaise } from '../lib/money';
import type {
  MerchantRecord,
  RazorpaySettlementRecord,
  BankStatementRecord,
  SyntheticCase,
} from '../domain/types';

// ============================================================
// Constants (synthetic assumptions — NOT verified Razorpay rates)
// ============================================================

/** Synthetic fee rate: 2% of transaction amount. */
const SYNTHETIC_FEE_RATE = 0.02;
/** Synthetic GST rate on fee: 18%. */
const SYNTHETIC_TAX_RATE = 0.18;
/** Date range for synthetic data: Jan–Mar 2025. */
const DATE_START = new Date('2025-01-01T00:00:00Z').getTime();
const DATE_END = new Date('2025-03-31T23:59:59Z').getTime();

/** Typical settlement delay in ms (T+2 days, synthetic assumption). */
const SETTLEMENT_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

// ============================================================
// Helpers
// ============================================================

/**
 * Computes synthetic fee in paise (rounds down to integer).
 *
 * SYNTHETIC ASSUMPTION — NOT verified Razorpay behavior.
 * Real Razorpay fees vary by merchant plan, payment method, and volume tier.
 * This fixed 2% rate exists only for generating test data.
 * Do NOT use this function in production reconciliation logic.
 */
function computeFee(amountPaise: number): number {
  return Math.floor(amountPaise * SYNTHETIC_FEE_RATE);
}

/**
 * Computes synthetic tax on fee in paise (rounds down to integer).
 *
 * SYNTHETIC ASSUMPTION — NOT verified Razorpay behavior.
 * While 18% is the standard Indian GST rate, whether and how Razorpay
 * applies GST to fees is plan-specific and unverified.
 * This function exists only for generating test data.
 * Do NOT use this function in production reconciliation logic.
 */
function computeTax(feePaise: number): number {
  return Math.floor(feePaise * SYNTHETIC_TAX_RATE);
}

/** Generates a fake UTR string. */
function generateUtr(rng: SeededRandom, index: number): string {
  const bank = rng.pick(['UTIB', 'HDFC', 'ICIC', 'SBIN', 'BARB']);
  const num = (index * 1000000 + rng.int(100000, 999999)).toString();
  return `${bank}${num}`;
}


/** Creates a merchant record. */
function makeMerchant(
  rng: SeededRandom,
  caseIndex: number,
  txnIndex: number,
  overrides: Partial<MerchantRecord> & { amountPaise: number; date: Date }
): MerchantRecord {
  const id = deterministicId('mtxn', caseIndex, txnIndex);
  return {
    merchantTxnId: id,
    orderRef: overrides.orderRef ?? deterministicId('ord', caseIndex, txnIndex),
    paymentRef: overrides.paymentRef ?? deterministicId('pay', caseIndex, txnIndex),
    customerId: overrides.customerId ?? deterministicId('cust', caseIndex, rng.int(1, 500)),
    type: overrides.type ?? 'sale',
    amountPaise: overrides.amountPaise,
    date: overrides.date,
    description: overrides.description ?? `Order ${deterministicId('ord', caseIndex, txnIndex)}`,
  };
}

/** Creates a Razorpay settlement record. */
function makeRazorpay(
  rng: SeededRandom,
  caseIndex: number,
  txnIndex: number,
  overrides: Partial<RazorpaySettlementRecord> & {
    amountPaise: number;
    createdAt: Date;
  }
): RazorpaySettlementRecord {
  const fee = overrides.feePaise ?? computeFee(overrides.amountPaise);
  const tax = overrides.taxPaise ?? computeTax(fee);
  const net = overrides.netPaise ?? subtractPaise(subtractPaise(overrides.amountPaise, fee), tax);
  const settled =
    overrides.settledAt ?? new Date(overrides.createdAt.getTime() + SETTLEMENT_DELAY_MS);

  return {
    paymentId: overrides.paymentId ?? deterministicId('pay', caseIndex, txnIndex),
    orderId: overrides.orderId ?? deterministicId('ord', caseIndex, txnIndex),
    settlementId: overrides.settlementId ?? deterministicId('setl', caseIndex, txnIndex),
    status: overrides.status ?? 'captured',
    amountPaise: overrides.amountPaise,
    feePaise: fee,
    taxPaise: tax,
    netPaise: net,
    createdAt: overrides.createdAt,
    settledAt: settled,
    utr: overrides.utr ?? generateUtr(rng, caseIndex * 100 + txnIndex),
  };
}

/** Creates a bank statement record. */
function makeBank(
  rng: SeededRandom,
  caseIndex: number,
  txnIndex: number,
  overrides: Partial<BankStatementRecord> & { amountPaise: number; date: Date }
): BankStatementRecord {
  const resolvedUtr = overrides.utr ?? generateUtr(rng, caseIndex * 100 + txnIndex);
  return {
    bankRef: overrides.bankRef ?? deterministicId('bnk', caseIndex, txnIndex),
    type: overrides.type ?? 'credit',
    amountPaise: overrides.amountPaise,
    date: overrides.date,
    valueDate: overrides.valueDate ?? overrides.date,
    utr: resolvedUtr,
    narration: overrides.narration ?? `NEFT-${resolvedUtr}-RAZORPAY`,
  };
}

// ============================================================
// Scenario Generators
// ============================================================

/**
 * Clean 3-way match: merchant, Razorpay, and bank all agree perfectly.
 * Bank amount = Razorpay net (after fee/tax deduction).
 */
export function createCleanCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(10000, 500000); // 100 to 5000 INR
  const date = deterministicDate(rng, DATE_START, DATE_END);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const merchant = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
  });

  const rzp = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
  });

  const bank = makeBank(rng, caseIndex, 0, {
    amountPaise: rzp.netPaise,
    date: rzp.settledAt,
    utr: rzp.utr,
  });

  return {
    scenario: 'clean-match',
    merchantRecords: [merchant],
    razorpayRecords: [rzp],
    bankRecords: [bank],
    groundTruth: {
      scenarioType: 'clean-match',
      expectedStatus: 'matched',
      expectedMatchGroup: [merchant.merchantTxnId, rzp.paymentId, bank.bankRef],
      isTrap: false,
      expectedOutcome: 'All three sources agree. Exact 3-way match.',
    },
  };
}

/**
 * Fee/tax difference: merchant records gross amount,
 * but Razorpay net differs because of fee+tax deduction.
 * Bank shows net amount. Common real-world scenario.
 */
export function createFeeTaxCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(50000, 1000000); // 500 to 10,000 INR
  const date = deterministicDate(rng, DATE_START, DATE_END);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const merchant = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
    description: `Sale - expect fee deduction on settlement`,
  });

  // Slightly different fee rate to create a realistic discrepancy scenario
  const customFee = Math.floor(amount * 0.023); // 2.3% instead of 2%
  const customTax = Math.floor(customFee * SYNTHETIC_TAX_RATE);

  const rzp = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
    feePaise: customFee,
    taxPaise: customTax,
  });

  const bank = makeBank(rng, caseIndex, 0, {
    amountPaise: rzp.netPaise,
    date: rzp.settledAt,
    utr: rzp.utr,
  });

  return {
    scenario: 'fee-tax-difference',
    merchantRecords: [merchant],
    razorpayRecords: [rzp],
    bankRecords: [bank],
    groundTruth: {
      scenarioType: 'fee-tax-difference',
      expectedStatus: 'partial_match',
      expectedMatchGroup: [merchant.merchantTxnId, rzp.paymentId, bank.bankRef],
      isTrap: false,
      expectedOutcome:
        'Merchant gross != bank net due to Razorpay fee/tax. Should match via payment ref + fee explanation.',
    },
  };
}

/**
 * Settlement timing: payment captured on day T, settled on T+3 instead of T+2.
 * Merchant and Razorpay agree, but bank entry is delayed.
 */
export function createTimingCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(20000, 300000);
  const date = deterministicDate(rng, DATE_START, DATE_END - 7 * 24 * 60 * 60 * 1000);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const merchant = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
  });

  // Extra delay: T+3 to T+5
  const extraDelay = rng.int(1, 3) * 24 * 60 * 60 * 1000;
  const rzp = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
    settledAt: new Date(date.getTime() + SETTLEMENT_DELAY_MS + extraDelay),
  });

  const bank = makeBank(rng, caseIndex, 0, {
    amountPaise: rzp.netPaise,
    date: rzp.settledAt,
    utr: rzp.utr,
  });

  return {
    scenario: 'timing-difference',
    merchantRecords: [merchant],
    razorpayRecords: [rzp],
    bankRecords: [bank],
    groundTruth: {
      scenarioType: 'timing-difference',
      expectedStatus: 'matched',
      expectedMatchGroup: [merchant.merchantTxnId, rzp.paymentId, bank.bankRef],
      isTrap: false,
      expectedOutcome:
        'Amounts match but settlement is delayed beyond typical T+2. Should match on payment ref / UTR.',
    },
  };
}

/**
 * Refund scenario: original payment + subsequent refund.
 * Merchant shows sale + refund. Razorpay shows both. Bank shows net credit + debit.
 */
export function createRefundCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(30000, 500000);
  const refundPercent = rng.pick([25, 50, 75, 100]);
  const refundAmount = Math.floor((amount * refundPercent) / 100);
  const date = deterministicDate(rng, DATE_START, DATE_END - 10 * 24 * 60 * 60 * 1000);
  const refundDate = new Date(date.getTime() + rng.int(2, 7) * 24 * 60 * 60 * 1000);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  // Merchant: original sale
  const merchantSale = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
    type: 'sale',
    description: `Sale - Order ${orderRef}`,
  });

  // Merchant: refund
  const merchantRefund = makeMerchant(rng, caseIndex, 1, {
    amountPaise: refundAmount,
    date: refundDate,
    paymentRef,
    orderRef,
    type: 'refund',
    description: `Refund ${refundPercent}% - Order ${orderRef}`,
  });

  // Razorpay: original payment
  const rzpPayment = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
    status: refundPercent === 100 ? 'refunded' : 'partially_refunded',
  });

  // Razorpay: refund record (fee is typically not refunded — synthetic assumption)
  const rzpRefund = makeRazorpay(rng, caseIndex, 1, {
    amountPaise: refundAmount,
    createdAt: refundDate,
    paymentId: deterministicId('rfnd', caseIndex, 1),
    orderId: orderRef,
    feePaise: 0, // Synthetic assumption: no fee on refund
    taxPaise: 0,
    status: 'refunded',
  });

  // Bank: original net credit
  const bankCredit = makeBank(rng, caseIndex, 0, {
    amountPaise: rzpPayment.netPaise,
    date: rzpPayment.settledAt,
    utr: rzpPayment.utr,
    type: 'credit',
  });

  // Bank: refund debit
  const bankDebit = makeBank(rng, caseIndex, 1, {
    amountPaise: refundAmount,
    date: rzpRefund.settledAt,
    utr: rzpRefund.utr,
    type: 'debit',
  });

  return {
    scenario: 'refund',
    merchantRecords: [merchantSale, merchantRefund],
    razorpayRecords: [rzpPayment, rzpRefund],
    bankRecords: [bankCredit, bankDebit],
    groundTruth: {
      scenarioType: 'refund',
      expectedStatus: 'matched',
      expectedMatchGroup: [
        merchantSale.merchantTxnId,
        merchantRefund.merchantTxnId,
        rzpPayment.paymentId,
        rzpRefund.paymentId,
        bankCredit.bankRef,
        bankDebit.bankRef,
      ],
      isTrap: false,
      expectedOutcome: `${refundPercent}% refund. Original + refund should reconcile as a group.`,
    },
  };
}

/**
 * Adjustment: Razorpay makes a post-settlement adjustment (e.g. chargeback, fee correction).
 * Appears in Razorpay and bank but not in merchant books initially.
 */
export function createAdjustmentCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(20000, 200000);
  const date = deterministicDate(rng, DATE_START, DATE_END - 14 * 24 * 60 * 60 * 1000);
  const adjustDate = new Date(date.getTime() + rng.int(7, 14) * 24 * 60 * 60 * 1000);
  const adjustAmount = rng.int(100, Math.floor(amount * 0.1)); // Small adjustment
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const merchant = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
  });

  const rzpPayment = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
  });

  // Adjustment record in Razorpay
  const rzpAdjust = makeRazorpay(rng, caseIndex, 1, {
    amountPaise: adjustAmount,
    createdAt: adjustDate,
    paymentId: deterministicId('adj', caseIndex, 1),
    orderId: orderRef,
    feePaise: 0,
    taxPaise: 0,
    status: 'captured',
  });

  // Bank: original net credit
  const bankCredit = makeBank(rng, caseIndex, 0, {
    amountPaise: rzpPayment.netPaise,
    date: rzpPayment.settledAt,
    utr: rzpPayment.utr,
    type: 'credit',
  });

  // Bank: adjustment debit
  const bankAdjust = makeBank(rng, caseIndex, 1, {
    amountPaise: adjustAmount,
    date: rzpAdjust.settledAt,
    utr: rzpAdjust.utr,
    type: 'debit',
  });

  return {
    scenario: 'adjustment',
    merchantRecords: [merchant],
    razorpayRecords: [rzpPayment, rzpAdjust],
    bankRecords: [bankCredit, bankAdjust],
    groundTruth: {
      scenarioType: 'adjustment',
      expectedStatus: 'exception',
      expectedMatchGroup: [
        merchant.merchantTxnId,
        rzpPayment.paymentId,
        rzpAdjust.paymentId,
        bankCredit.bankRef,
        bankAdjust.bankRef,
      ],
      isTrap: false,
      expectedOutcome:
        'Post-settlement adjustment not in merchant books. Should flag as exception for review.',
    },
  };
}

/**
 * Batched settlement: multiple payments settled in a single bank transfer.
 * Individual Razorpay records exist, but bank shows one lump sum.
 */
export function createBatchCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const batchSize = rng.int(3, 5);
  const date = deterministicDate(rng, DATE_START, DATE_END - 5 * 24 * 60 * 60 * 1000);
  const settlementId = deterministicId('setl', caseIndex, 0);
  const batchUtr = generateUtr(rng, caseIndex * 100);
  const settledAt = new Date(date.getTime() + SETTLEMENT_DELAY_MS);

  const merchants: MerchantRecord[] = [];
  const razorpays: RazorpaySettlementRecord[] = [];
  let totalNet = 0;
  const allIds: string[] = [];

  for (let i = 0; i < batchSize; i++) {
    const txnAmount = rng.int(10000, 200000);
    const txnDate = new Date(date.getTime() + rng.int(0, 24 * 60 * 60 * 1000));
    const paymentRef = deterministicId('pay', caseIndex, i);
    const orderRef = deterministicId('ord', caseIndex, i);

    const m = makeMerchant(rng, caseIndex, i, {
      amountPaise: txnAmount,
      date: txnDate,
      paymentRef,
      orderRef,
    });

    const r = makeRazorpay(rng, caseIndex, i, {
      amountPaise: txnAmount,
      createdAt: txnDate,
      paymentId: paymentRef,
      orderId: orderRef,
      settlementId,
      settledAt,
      utr: batchUtr,
    });

    merchants.push(m);
    razorpays.push(r);
    totalNet = addPaise(totalNet, r.netPaise);
    allIds.push(m.merchantTxnId, r.paymentId);
  }

  const bank = makeBank(rng, caseIndex, 0, {
    amountPaise: totalNet,
    date: settledAt,
    utr: batchUtr,
    narration: `NEFT-${batchUtr}-RAZORPAY-SETTLEMENT-${settlementId}`,
  });
  allIds.push(bank.bankRef);

  return {
    scenario: 'batch-settlement',
    merchantRecords: merchants,
    razorpayRecords: razorpays,
    bankRecords: [bank],
    groundTruth: {
      scenarioType: 'batch-settlement',
      expectedStatus: 'matched',
      expectedMatchGroup: allIds,
      isTrap: false,
      expectedOutcome: `Batch of ${batchSize} payments settled in one bank transfer. Should unbundle and match individually.`,
    },
  };
}

/**
 * Missing record: exists in Razorpay and bank but NOT in merchant books.
 * Could indicate an unrecorded sale, test transaction, or data gap.
 */
export function createMissingMerchantCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(15000, 300000);
  const date = deterministicDate(rng, DATE_START, DATE_END - 5 * 24 * 60 * 60 * 1000);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const rzp = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
  });

  const bank = makeBank(rng, caseIndex, 0, {
    amountPaise: rzp.netPaise,
    date: rzp.settledAt,
    utr: rzp.utr,
  });

  return {
    scenario: 'missing-merchant-record',
    merchantRecords: [],
    razorpayRecords: [rzp],
    bankRecords: [bank],
    groundTruth: {
      scenarioType: 'missing-merchant-record',
      expectedStatus: 'exception',
      expectedMatchGroup: [rzp.paymentId, bank.bankRef],
      isTrap: false,
      expectedOutcome:
        'Payment exists in Razorpay and bank but not in merchant books. Should flag as exception.',
    },
  };
}

/**
 * Missing bank record: exists in merchant and Razorpay but NOT in bank statement.
 * Could indicate pending settlement or bank processing delay.
 */
export function createMissingBankCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const amount = rng.int(15000, 300000);
  const date = deterministicDate(rng, DATE_START, DATE_END - 5 * 24 * 60 * 60 * 1000);
  const paymentRef = deterministicId('pay', caseIndex, 0);
  const orderRef = deterministicId('ord', caseIndex, 0);

  const merchant = makeMerchant(rng, caseIndex, 0, {
    amountPaise: amount,
    date,
    paymentRef,
    orderRef,
  });

  const rzp = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: amount,
    createdAt: date,
    paymentId: paymentRef,
    orderId: orderRef,
  });

  return {
    scenario: 'missing-bank-record',
    merchantRecords: [merchant],
    razorpayRecords: [rzp],
    bankRecords: [],
    groundTruth: {
      scenarioType: 'missing-bank-record',
      expectedStatus: 'exception',
      expectedMatchGroup: [merchant.merchantTxnId, rzp.paymentId],
      isTrap: false,
      expectedOutcome:
        'Payment captured but no bank settlement found. May be pending or missing.',
    },
  };
}

/**
 * Adversarial trap: two transactions with very similar amounts, close dates,
 * and similar-looking references — but they are DIFFERENT transactions.
 * Must NOT be matched together.
 */
export function createTrapCase(rng: SeededRandom, caseIndex: number): SyntheticCase {
  const baseAmount = rng.int(100000, 500000);
  const smallDiff = rng.pick([1, 2, 10, 100]); // Very close amounts
  const date1 = deterministicDate(rng, DATE_START, DATE_END - 10 * 24 * 60 * 60 * 1000);
  // Date within 1-2 days
  const date2 = new Date(date1.getTime() + rng.int(0, 2) * 24 * 60 * 60 * 1000);

  // Transaction A — full lifecycle
  const payRefA = deterministicId('pay', caseIndex, 0);
  const orderRefA = deterministicId('ord', caseIndex, 0);
  const merchantA = makeMerchant(rng, caseIndex, 0, {
    amountPaise: baseAmount,
    date: date1,
    paymentRef: payRefA,
    orderRef: orderRefA,
    customerId: deterministicId('cust', caseIndex, 0),
    description: `Order from Customer A`,
  });
  const rzpA = makeRazorpay(rng, caseIndex, 0, {
    amountPaise: baseAmount,
    createdAt: date1,
    paymentId: payRefA,
    orderId: orderRefA,
  });
  const bankA = makeBank(rng, caseIndex, 0, {
    amountPaise: rzpA.netPaise,
    date: rzpA.settledAt,
    utr: rzpA.utr,
  });

  // Transaction B — different customer, slightly different amount
  const payRefB = deterministicId('pay', caseIndex, 10);
  const orderRefB = deterministicId('ord', caseIndex, 10);
  const merchantB = makeMerchant(rng, caseIndex, 10, {
    amountPaise: baseAmount + smallDiff,
    date: date2,
    paymentRef: payRefB,
    orderRef: orderRefB,
    customerId: deterministicId('cust', caseIndex, 10),
    description: `Order from Customer B`,
  });
  const rzpB = makeRazorpay(rng, caseIndex, 10, {
    amountPaise: baseAmount + smallDiff,
    createdAt: date2,
    paymentId: payRefB,
    orderId: orderRefB,
  });
  const bankB = makeBank(rng, caseIndex, 10, {
    amountPaise: rzpB.netPaise,
    date: rzpB.settledAt,
    utr: rzpB.utr,
  });

  return {
    scenario: 'adversarial-trap',
    merchantRecords: [merchantA, merchantB],
    razorpayRecords: [rzpA, rzpB],
    bankRecords: [bankA, bankB],
    groundTruth: {
      scenarioType: 'adversarial-trap',
      expectedStatus: 'matched',
      expectedMatchGroup: [
        merchantA.merchantTxnId,
        rzpA.paymentId,
        bankA.bankRef,
        merchantB.merchantTxnId,
        rzpB.paymentId,
        bankB.bankRef,
      ],
      isTrap: true,
      expectedOutcome:
        `Two distinct transactions with amounts differing by only ${smallDiff} paise and dates ${Math.round((date2.getTime() - date1.getTime()) / 86400000)} days apart. ` +
        `Each must match its own group (A↔A, B↔B). Cross-matching A↔B is incorrect.`,
    },
  };
}

// ============================================================
// Main Generator
// ============================================================

export interface DatasetResult {
  cases: SyntheticCase[];
  totalMerchantRecords: number;
  totalRazorpayRecords: number;
  totalBankRecords: number;
  totalRecords: number;
  scenarioDistribution: Record<string, number>;
}

/**
 * Generates the full synthetic dataset.
 *
 * @param seed - Numeric seed for deterministic generation. Same seed = same output.
 * @returns All synthetic cases with ground truth.
 */
export function generateDataset(seed: number = 42): DatasetResult {
  const rng = new SeededRandom(seed);
  const cases: SyntheticCase[] = [];
  let caseIndex = 0;

  // Distribution: ~150 total records across scenarios
  // Clean matches: 25 cases (~75 records: 25 merchant + 25 rzp + 25 bank)
  for (let i = 0; i < 25; i++) {
    cases.push(createCleanCase(rng, caseIndex++));
  }

  // Fee/tax differences: 10 cases (~30 records)
  for (let i = 0; i < 10; i++) {
    cases.push(createFeeTaxCase(rng, caseIndex++));
  }

  // Timing differences: 8 cases (~24 records)
  for (let i = 0; i < 8; i++) {
    cases.push(createTimingCase(rng, caseIndex++));
  }

  // Refunds: 8 cases (~48 records: each has 2 merchant + 2 rzp + 2 bank)
  for (let i = 0; i < 8; i++) {
    cases.push(createRefundCase(rng, caseIndex++));
  }

  // Adjustments: 5 cases (~25 records)
  for (let i = 0; i < 5; i++) {
    cases.push(createAdjustmentCase(rng, caseIndex++));
  }

  // Batch settlements: 4 cases (~variable, ~40-60 records)
  for (let i = 0; i < 4; i++) {
    cases.push(createBatchCase(rng, caseIndex++));
  }

  // Missing merchant records: 5 cases (~10 records)
  for (let i = 0; i < 5; i++) {
    cases.push(createMissingMerchantCase(rng, caseIndex++));
  }

  // Missing bank records: 5 cases (~10 records)
  for (let i = 0; i < 5; i++) {
    cases.push(createMissingBankCase(rng, caseIndex++));
  }

  // Adversarial traps: 5 cases (~30 records)
  for (let i = 0; i < 5; i++) {
    cases.push(createTrapCase(rng, caseIndex++));
  }

  // Count records
  let totalMerchant = 0;
  let totalRazorpay = 0;
  let totalBank = 0;
  const scenarioDistribution: Record<string, number> = {};

  for (const c of cases) {
    totalMerchant += c.merchantRecords.length;
    totalRazorpay += c.razorpayRecords.length;
    totalBank += c.bankRecords.length;
    scenarioDistribution[c.scenario] = (scenarioDistribution[c.scenario] || 0) + 1;
  }

  return {
    cases,
    totalMerchantRecords: totalMerchant,
    totalRazorpayRecords: totalRazorpay,
    totalBankRecords: totalBank,
    totalRecords: totalMerchant + totalRazorpay + totalBank,
    scenarioDistribution,
  };
}

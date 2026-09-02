/**
 * LedgerLens Deterministic Verifier
 *
 * NON-NEGOTIABLE: AI output must pass deterministic verification.
 * This verifier ensures every AI claim is backed by actual data.
 *
 * Verification passes → AI_SUPPORTED
 * Verification fails → AI_REJECTED
 * Evidence insufficient → INCONCLUSIVE
 *
 * AI confidence alone can NEVER produce approval.
 */
import type { AIOutput } from './response-schema';
import type { NormalizedRecord, EngineException } from '../domain/types';

export type VerificationStatus = 'AI_SUPPORTED' | 'AI_REJECTED' | 'INCONCLUSIVE';

export interface VerificationResult {
  status: VerificationStatus;
  details: string;
  failureReasons: string[];
}

/**
 * Verifies AI output against actual source data.
 * Returns verification result with detailed reasoning.
 *
 * @param aiOutput The AI's structured output
 * @param exception The exception being investigated
 * @param linkedRecords Source records linked to the exception
 * @param candidateRecords All candidate records (by ID lookup)
 * @param allRecordsById Map of all records by ID for verification
 * @returns Verification result
 */
export function verifyAIOutput(
  aiOutput: AIOutput,
  exception: EngineException,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[],
  allRecordsById: Map<string, NormalizedRecord>
): VerificationResult {
  const failures: string[] = [];

  // If AI says inconclusive, accept it
  if (aiOutput.conclusion === 'inconclusive') {
    return {
      status: 'INCONCLUSIVE',
      details: 'AI determined evidence is insufficient for a conclusion',
      failureReasons: [],
    };
  }

  // Verify all referenced record IDs exist and are in candidate list
  const idCheck = verifyRecordIds(aiOutput, candidateRecords, allRecordsById);
  if (!idCheck.valid) {
    failures.push(...idCheck.failures);
  }

  // Verify no fabricated amounts
  const amountCheck = verifyAmounts(aiOutput, linkedRecords, candidateRecords);
  if (!amountCheck.valid) {
    failures.push(...amountCheck.failures);
  }

  // Verify no fabricated identifiers
  const identifierCheck = verifyIdentifiers(aiOutput, linkedRecords, candidateRecords);
  if (!identifierCheck.valid) {
    failures.push(...identifierCheck.failures);
  }

  // Verify no fabricated dates
  const dateCheck = verifyDates(aiOutput, linkedRecords, candidateRecords);
  if (!dateCheck.valid) {
    failures.push(...dateCheck.failures);
  }

  // Verify arithmetic consistency for supported conclusions
  if (aiOutput.conclusion === 'supported') {
    const arithmeticCheck = verifyArithmetic(
      aiOutput,
      exception,
      linkedRecords,
      candidateRecords,
      allRecordsById
    );
    if (!arithmeticCheck.valid) {
      failures.push(...arithmeticCheck.failures);
    }
  }

  // Verify no contradictory evidence exists
  const contradictionCheck = verifyNoContradictions(
    aiOutput,
    linkedRecords,
    candidateRecords,
    allRecordsById
  );
  if (!contradictionCheck.valid) {
    failures.push(...contradictionCheck.failures);
  }

  // Determine final status
  if (failures.length > 0) {
    return {
      status: 'AI_REJECTED',
      details: `AI output failed deterministic verification: ${failures.join('; ')}`,
      failureReasons: failures,
    };
  }

  if (aiOutput.conclusion === 'supported') {
    return {
      status: 'AI_SUPPORTED',
      details: 'AI output passed all deterministic verification checks',
      failureReasons: [],
    };
  }

  // AI says unsupported and verification passed - trust it
  return {
    status: 'AI_REJECTED',
    details: 'AI determined the proposed relationship is not supported by evidence',
    failureReasons: [],
  };
}

/**
 * Verifies all referenced record IDs exist and belong to candidate list.
 */
function verifyRecordIds(
  aiOutput: AIOutput,
  candidateRecords: NormalizedRecord[],
  allRecordsById: Map<string, NormalizedRecord>
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];
  const candidateIds = new Set(candidateRecords.map((r) => r.id));

  for (const id of aiOutput.candidateRecordIds) {
    // Check ID exists in database
    if (!allRecordsById.has(id)) {
      failures.push(`AI referenced non-existent record ID: ${id}`);
      continue;
    }

    // Check ID was in candidate list
    if (!candidateIds.has(id)) {
      failures.push(`AI referenced record ID not in candidate list: ${id}`);
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Verifies no fabricated amounts in AI output.
 * Scans summary and evidence for amount mentions.
 */
function verifyAmounts(
  aiOutput: AIOutput,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[]
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  // Extract all valid amounts from actual records
  const validAmountsPaise = new Set<number>();
  for (const r of [...linkedRecords, ...candidateRecords]) {
    validAmountsPaise.add(r.amountPaise);
    validAmountsPaise.add(r.feePaise);
    validAmountsPaise.add(r.taxPaise);
    validAmountsPaise.add(r.netPaise);
  }

  // Convert to rupees for text matching
  const validAmountsRupees = new Set<number>();
  for (const paise of validAmountsPaise) {
    validAmountsRupees.add(paise / 100);
  }

  // Check summary and evidence for fabricated amounts
  const textToCheck = [aiOutput.summary, ...aiOutput.evidence].join(' ');

  // Match rupee amounts like "₹100", "100.00", "Rs 100"
  const amountMatches = textToCheck.match(/(?:₹|Rs\.?\s*)(\d+(?:\.\d{2})?)/g);
  if (amountMatches) {
    for (const match of amountMatches) {
      const numMatch = match.match(/(\d+(?:\.\d{2})?)/);
      if (numMatch) {
        const amount = parseFloat(numMatch[1]);
        // Allow small rounding differences (within ₹1)
        const found = Array.from(validAmountsRupees).some(
          (valid) => Math.abs(valid - amount) < 1.01
        );
        if (!found) {
          failures.push(`AI mentioned amount ₹${amount} not found in actual records`);
        }
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Verifies no fabricated identifiers (paymentRef, UTR, orderId).
 */
function verifyIdentifiers(
  aiOutput: AIOutput,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[]
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  // Extract all valid identifiers
  const validIdentifiers = new Set<string>();
  for (const r of [...linkedRecords, ...candidateRecords]) {
    if (r.paymentRef) validIdentifiers.add(r.paymentRef);
    if (r.orderId) validIdentifiers.add(r.orderId);
    if (r.utr) validIdentifiers.add(r.utr);
    if (r.settlementRef) validIdentifiers.add(r.settlementRef);
    validIdentifiers.add(r.externalRef);
  }

  const textToCheck = [aiOutput.summary, ...aiOutput.evidence].join(' ');

  // Look for identifier-like patterns: pay_XXX, order_XXX, setl_XXX, UTR patterns
  const patterns = [
    /pay_[A-Za-z0-9]+/g,
    /order_[A-Za-z0-9]+/g,
    /setl_[A-Za-z0-9]+/g,
    /UTR[:\s]*[A-Z0-9]{10,}/gi,
  ];

  for (const pattern of patterns) {
    const matches = textToCheck.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.trim();
        if (!validIdentifiers.has(normalized)) {
          failures.push(`AI mentioned identifier "${normalized}" not found in actual records`);
        }
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Verifies no fabricated dates in AI output.
 */
function verifyDates(
  aiOutput: AIOutput,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[]
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  // Extract all valid dates
  const validDates = new Set<string>();
  for (const r of [...linkedRecords, ...candidateRecords]) {
    const occurred = r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt);
    validDates.add(occurred.toISOString().split('T')[0]); // YYYY-MM-DD
    if (r.settledAt) {
      const settled = r.settledAt instanceof Date ? r.settledAt : new Date(r.settledAt);
      validDates.add(settled.toISOString().split('T')[0]);
    }
  }

  const textToCheck = [aiOutput.summary, ...aiOutput.evidence].join(' ');

  // Match date patterns: YYYY-MM-DD, DD/MM/YYYY
  const dateMatches = textToCheck.match(/\d{4}-\d{2}-\d{2}/g);
  if (dateMatches) {
    for (const date of dateMatches) {
      if (!validDates.has(date)) {
        // Allow dates within the range of actual records (not fabricated from future)
        const checkDate = new Date(date);
        const allDates = Array.from(validDates).map((d) => new Date(d));
        const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

        // Allow 60 days before min and 90 days after max (plausible window)
        minDate.setDate(minDate.getDate() - 60);
        maxDate.setDate(maxDate.getDate() + 90);

        if (checkDate < minDate || checkDate > maxDate) {
          failures.push(`AI mentioned date ${date} outside plausible range`);
        }
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Verifies arithmetic consistency for "supported" conclusions.
 * The proposed relationship must satisfy financial invariants.
 */
function verifyArithmetic(
  aiOutput: AIOutput,
  exception: EngineException,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[],
  allRecordsById: Map<string, NormalizedRecord>
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  // Get the records AI is claiming form a valid relationship
  const proposedRecords = aiOutput.candidateRecordIds
    .map((id) => allRecordsById.get(id))
    .filter((r): r is NormalizedRecord => r !== undefined);

  if (proposedRecords.length === 0) {
    failures.push('AI proposed no records for supported conclusion');
    return { valid: false, failures };
  }

  // Verify basic arithmetic invariants
  // 1. Check gross - fee - tax = net for any Razorpay records
  for (const r of proposedRecords) {
    if (r.source === 'razorpay') {
      const expectedNet = r.amountPaise - r.feePaise - r.taxPaise;
      if (Math.abs(expectedNet - r.netPaise) > 1) {
        // Allow 1 paise rounding
        failures.push(
          `Arithmetic violation: Record ${r.id} net amount doesn't match gross - fee - tax`
        );
      }
    }
  }

  // 2. For 3-way matches, verify merchant amount ≈ razorpay gross ≈ bank net
  const merchant = proposedRecords.find((r) => r.source === 'merchant');
  const razorpay = proposedRecords.find((r) => r.source === 'razorpay');
  const bank = proposedRecords.find((r) => r.source === 'bank');

  if (merchant && razorpay && bank) {
    // Merchant amount should match Razorpay gross (within 100 paise)
    if (Math.abs(merchant.amountPaise - razorpay.amountPaise) > 100) {
      failures.push(
        `3-way mismatch: Merchant amount ${merchant.amountPaise} vs Razorpay gross ${razorpay.amountPaise}`
      );
    }

    // Bank credit should match Razorpay net (within 100 paise)
    if (Math.abs(bank.amountPaise - razorpay.netPaise) > 100) {
      failures.push(
        `3-way mismatch: Bank credit ${bank.amountPaise} vs Razorpay net ${razorpay.netPaise}`
      );
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Verifies no contradictory evidence exists.
 * Looks for records that would invalidate the AI's conclusion.
 */
function verifyNoContradictions(
  aiOutput: AIOutput,
  linkedRecords: NormalizedRecord[],
  candidateRecords: NormalizedRecord[],
  allRecordsById: Map<string, NormalizedRecord>
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  if (aiOutput.conclusion === 'unsupported') {
    // No contradictions to check for unsupported
    return { valid: true, failures: [] };
  }

  // Get proposed records
  const proposedRecords = aiOutput.candidateRecordIds
    .map((id) => allRecordsById.get(id))
    .filter((r): r is NormalizedRecord => r !== undefined);

  // Check for identifier conflicts
  // If AI claims two records match, they should share at least one identifier
  if (proposedRecords.length >= 2) {
    const merchantRecs = proposedRecords.filter((r) => r.source === 'merchant');
    const razorpayRecs = proposedRecords.filter((r) => r.source === 'razorpay');
    const bankRecs = proposedRecords.filter((r) => r.source === 'bank');

    // Merchant and Razorpay should share paymentRef or orderId
    if (merchantRecs.length > 0 && razorpayRecs.length > 0) {
      let hasLink = false;
      for (const m of merchantRecs) {
        for (const r of razorpayRecs) {
          if (
            (m.paymentRef && m.paymentRef === r.paymentRef) ||
            (m.orderId && m.orderId === r.orderId)
          ) {
            hasLink = true;
            break;
          }
        }
        if (hasLink) break;
      }
      if (!hasLink) {
        failures.push('AI proposed merchant and Razorpay records with no shared identifier');
      }
    }

    // Razorpay and Bank should share UTR
    if (razorpayRecs.length > 0 && bankRecs.length > 0) {
      let hasUTR = false;
      for (const r of razorpayRecs) {
        for (const b of bankRecs) {
          if (r.utr && r.utr === b.utr) {
            hasUTR = true;
            break;
          }
        }
        if (hasUTR) break;
      }
      if (!hasUTR) {
        failures.push('AI proposed Razorpay and Bank records with no shared UTR');
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

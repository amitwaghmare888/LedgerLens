/**
 * LedgerLens AI Investigation Orchestrator
 *
 * Orchestrates the complete investigation flow:
 * exception → evidence → candidates → AI provider → validation → verification → result
 */
import type { EngineException, NormalizedRecord } from '../domain/types';
import type { InvestigationResult } from './response-schema';
import { getAIProvider } from './provider-factory';
import { buildEvidencePacket, extractDeterministicFindings } from './evidence-builder';
import { selectCandidates, validateCandidateSelection } from './candidate-selector';
import { verifyAIOutput } from './deterministic-verifier';
import { sanitizeAIOutput } from './response-parser';
import { AIProviderException } from './provider-interface';

export interface InvestigationInput {
  exception: EngineException;
  linkedRecords: NormalizedRecord[];
  allRecords: NormalizedRecord[];
  auditEvents: Array<{ reason: string; evidence: string }>;
}

export interface InvestigationOutput {
  result: InvestigationResult;
  evidence: {
    candidateSelectionReason: string;
    totalCandidatesConsidered: number;
  };
}

/**
 * Orchestrates a complete AI investigation of an exception.
 * Returns investigation result with verification status.
 *
 * @param input Investigation input
 * @returns Investigation output with result and metadata
 */
export async function investigateException(
  input: InvestigationInput
): Promise<InvestigationOutput> {
  const { exception, linkedRecords, allRecords, auditEvents } = input;

  // Check if AI provider is configured
  const provider = getAIProvider();
  if (!provider) {
    const evidenceList = linkedRecords.map(
      (r) => `${r.source.toUpperCase()} [${r.id}]: Amount ₹${(r.amountPaise / 100).toFixed(2)}${r.feePaise ? `, Fee ₹${(r.feePaise / 100).toFixed(2)}` : ''}${r.utr ? `, UTR ${r.utr}` : ''}`
    );
    const discrepanciesList: Array<{ field: string; observation: string }> = [];
    if (exception.amountPaise > 0) {
      discrepanciesList.push({
        field: 'exposure',
        observation: `Variance/exposure amount is ₹${(exception.amountPaise / 100).toFixed(2)} with priority score ${exception.priorityScore}.`,
      });
    }

    return {
      result: {
        exceptionId: exception.id,
        provider: 'deterministic-engine',
        model: 'invariant-rules',
        aiOutput: {
          conclusion: 'inconclusive',
          summary: `Deterministic rule analysis: ${exception.description}. External AI provider not configured.`,
          candidateRecordIds: linkedRecords.map((r) => r.id),
          evidence: evidenceList,
          discrepancies: discrepanciesList,
          recommendedAction: 'Verify source ledger entries or configure AI provider in environment settings.',
        },
        verificationStatus: 'INCONCLUSIVE',
        verificationDetails: 'Deterministic observation (AI provider not configured)',
        timestamp: new Date().toISOString(),
      },
      evidence: {
        candidateSelectionReason: 'Linked source records analyzed via deterministic heuristic',
        totalCandidatesConsidered: linkedRecords.length,
      },
    };
  }

  try {
    // Step 1: Extract deterministic findings
    const deterministicFindings = extractDeterministicFindings(auditEvents);

    // Step 2: Select candidates deterministically
    const candidateSelection = selectCandidates(exception, linkedRecords, allRecords);

    // Validate candidate selection
    if (!validateCandidateSelection(candidateSelection, exception)) {
      throw new Error('Candidate selection validation failed');
    }

    // Get candidate records by ID
    const allRecordsById = new Map(allRecords.map((r) => [r.id, r]));
    const candidateRecords = candidateSelection.candidateRecordIds
      .map((id) => allRecordsById.get(id))
      .filter((r): r is NormalizedRecord => r !== undefined);

    // Step 3: Build evidence packet
    const evidencePacket = buildEvidencePacket(
      exception,
      linkedRecords,
      deterministicFindings,
      candidateSelection.candidateRecordIds
    );

    // Step 4: Call AI provider
    const aiResponse = await provider.investigate(evidencePacket);

    // Step 5: Sanitize output
    const sanitizedOutput = sanitizeAIOutput(aiResponse.output);

    // Step 6: Deterministic verification
    const verification = verifyAIOutput(
      sanitizedOutput,
      exception,
      linkedRecords,
      candidateRecords,
      allRecordsById
    );

    // Step 7: Build final result
    const result: InvestigationResult = {
      exceptionId: exception.id,
      provider: aiResponse.provider,
      model: aiResponse.model,
      aiOutput: sanitizedOutput,
      verificationStatus: verification.status,
      verificationDetails: verification.details,
      timestamp: new Date().toISOString(),
      tokensUsed: aiResponse.tokensUsed,
    };

    return {
      result,
      evidence: {
        candidateSelectionReason: candidateSelection.selectionReason,
        totalCandidatesConsidered: candidateSelection.totalCandidatesConsidered,
      },
    };
  } catch (err) {
    // Handle provider errors safely
    if (err instanceof AIProviderException) {
      const evidenceList = linkedRecords.map(
        (r) => `${r.source.toUpperCase()} [${r.id}]: ₹${(r.amountPaise / 100).toFixed(2)}`
      );
      return {
        result: {
          exceptionId: exception.id,
          provider: 'deterministic-fallback',
          model: 'heuristic-engine',
          aiOutput: {
            conclusion: 'inconclusive',
            summary: `Automated fallback analysis: ${exception.description} (AI provider unreachable: ${err.message}).`,
            candidateRecordIds: linkedRecords.map((r) => r.id),
            evidence: evidenceList,
            discrepancies: [
              {
                field: 'exceptionType',
                observation: `Type ${exception.type} with priority score ${exception.priorityScore}.`,
              },
            ],
            recommendedAction: 'Manual investigation required or check local AI proxy.',
          },
          verificationStatus: 'INCONCLUSIVE',
          verificationDetails: `Fallback engaged: ${err.code} - ${err.message}`,
          timestamp: new Date().toISOString(),
        },
        evidence: {
          candidateSelectionReason: 'Fallback to linked source records',
          totalCandidatesConsidered: linkedRecords.length,
        },
      };
    }

    // Unexpected error
    console.error('[Investigation] Unexpected error:', err);
    return {
      result: {
        exceptionId: exception.id,
        provider: 'error',
        model: 'error',
        aiOutput: {
          conclusion: 'inconclusive',
          summary: 'Investigation failed due to internal error',
          candidateRecordIds: [],
          evidence: [],
          discrepancies: [],
          recommendedAction: 'Manual investigation required',
        },
        verificationStatus: 'AI_UNAVAILABLE',
        verificationDetails: `Internal error: ${String(err)}`,
        timestamp: new Date().toISOString(),
      },
      evidence: {
        candidateSelectionReason: 'Error occurred',
        totalCandidatesConsidered: 0,
      },
    };
  }
}

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
    return {
      result: {
        exceptionId: exception.id,
        provider: 'none',
        model: 'none',
        aiOutput: {
          conclusion: 'inconclusive',
          summary: 'AI provider not configured',
          candidateRecordIds: [],
          evidence: [],
          discrepancies: [],
          recommendedAction: 'Configure AI provider or investigate manually',
        },
        verificationStatus: 'AI_UNAVAILABLE',
        verificationDetails: 'No AI provider configured',
        timestamp: new Date().toISOString(),
      },
      evidence: {
        candidateSelectionReason: 'No provider available',
        totalCandidatesConsidered: 0,
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
      return {
        result: {
          exceptionId: exception.id,
          provider: 'error',
          model: 'error',
          aiOutput: {
            conclusion: 'inconclusive',
            summary: `AI provider error: ${err.message}`,
            candidateRecordIds: [],
            evidence: [],
            discrepancies: [],
            recommendedAction: 'Manual investigation required',
          },
          verificationStatus: 'AI_UNAVAILABLE',
          verificationDetails: `Provider error: ${err.code} - ${err.message}`,
          timestamp: new Date().toISOString(),
        },
        evidence: {
          candidateSelectionReason: 'Provider error occurred',
          totalCandidatesConsidered: 0,
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

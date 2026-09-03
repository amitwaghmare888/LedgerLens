# LedgerLens

Financial reconciliation and exception investigation system.

Connects three data sources:
- **Merchant books** — the merchant's accounting records
- **Razorpay settlement data** — payment gateway transactions and settlements
- **Bank statements** — actual bank credits and debits

> **"When the numbers don't agree, LedgerLens finds out why."**

Built for the Razorpay AI Buildathon — Track 04: AI Finance Controller.

## Status

**Phase 5 Complete** — AI Investigation Layer with Deterministic Verification

✅ **Phase 1**: Foundation (Database, domain types, synthetic dataset, ground truth)  
✅ **Phase 2**: CSV ingestion pipeline with validation  
✅ **Phase 3**: Multi-source normalization engine  
✅ **Phase 4**: Deterministic reconciliation engine (100% precision, 100% recall, 0 false matches)  
✅ **Phase 5**: AI investigation layer with deterministic verification

**Current Metrics (75 test cases)**:
- **Precision**: 100.0%
- **Recall**: 100.0%  
- **False Matches**: 0
- **Trap False Matches**: 0
- **Match Rate**: 86.7% (deterministic only)

The AI investigation layer augments deterministic reconciliation with evidence-based hypothesis generation for ambiguous cases. All AI output undergoes deterministic verification before acceptance.

## Local Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Environment Variables

Create a `.env.local` file (optional, only needed for AI investigation):

```bash
# AI Provider Configuration (optional)
AI_PROVIDER=omniroute    # or 'gemini' or 'groq'
AI_MODEL=your-model-name
AI_API_KEY=your-api-key
AI_BASE_URL=https://your-endpoint/v1  # optional, for custom endpoints
```

**Note**: AI investigation features degrade safely when not configured. The deterministic engine works independently.

### Setup Commands

```bash
# Install dependencies
npm install

# Generate the synthetic development dataset
npm run seed

# Run tests
npm test

# Lint
npm run lint

# Start development server
npm run dev

# Production build
npm run build
```

### Accessing the Application

- **Web UI**: http://localhost:3000
- **Reconciliation**: Import CSVs, run reconciliation, view results
- **Exceptions**: View unresolved cases, investigate with AI
- **Audit**: Full audit trail of all decisions

## Synthetic Dataset

The seed command generates a deterministic dataset with these scenarios:

| Scenario | Description |
|---|---|
| clean-match | All three sources agree perfectly |
| fee-tax-difference | Merchant gross ≠ bank net due to fees/tax |
| timing-difference | Settlement delayed beyond typical T+2 |
| refund | Original payment + partial/full refund |
| adjustment | Post-settlement adjustments (chargebacks, corrections) |
| batch-settlement | Multiple payments in a single bank transfer |
| missing-merchant-record | Exists in Razorpay+bank, not in merchant books |
| missing-bank-record | Exists in merchant+Razorpay, not in bank |
| adversarial-trap | Similar amounts/dates but different transactions |

**This is synthetic data for development. It does not represent real Razorpay production data.**

Fee rates, settlement timings, and other parameters are illustrative assumptions, not verified Razorpay behavior.

## Architecture

LedgerLens follows a three-layer architecture with AI as an **advisory investigator**, never a decision-maker:

```
CSV Sources
    ↓
Ingestion & Validation
    ↓
Multi-Source Normalization
    ↓
Deterministic Reconciliation Engine ← FINAL AUTHORITY
    ↓
┌───────────────────────────────────────┐
│  Matched Records → Audit Trail       │
│  Unresolved Cases → Exception Queue  │
└───────────────────────────────────────┘
    ↓
AI Investigation (Advisory Only)
    ↓
Candidate Selection (Deterministic)
    ↓
Evidence Builder (Observable Facts Only)
    ↓
AI Hypothesis Generation (OpenAI-compatible API)
    ↓
Zod Schema Validation
    ↓
Deterministic Verification ← FINAL AUTHORITY
    ↓
┌──────────────────────────────────────────────┐
│  SUPPORTED   → Mark as resolved             │
│  UNSUPPORTED → Remains unresolved           │
│  INCONCLUSIVE → Remains unresolved          │
│  AI_UNAVAILABLE → Remains unresolved        │
└──────────────────────────────────────────────┘
```

### Core Principles

1. **Deterministic First**: The reconciliation engine matches records using immutable financial facts (UTR, payment refs, amounts, dates, settlement refs)
2. **AI is Advisory**: AI investigates ambiguous cases but **never finalizes matches**
3. **Verification Gate**: All AI output undergoes deterministic verification against source data
4. **Evidence Boundary**: AI sees only observable transaction data, never ground truth or evaluation metadata
5. **Safe Degradation**: System works fully without AI; AI failures never corrupt financial state

### Investigation Flow

For each unresolved exception:

1. **Candidate Selection** (deterministic): Find records that could plausibly match
2. **Evidence Building** (deterministic): Package observable facts (amounts, dates, IDs, refs)
3. **AI Hypothesis** (advisory): AI proposes supported/unsupported/inconclusive with reasoning
4. **Verification** (deterministic): Verify AI's claimed evidence exists in source data
5. **Final Disposition** (deterministic): Accept only if verification passes

### Security Model

- API keys server-side only (never exposed to browser)
- AI output treated as untrusted input
- Zod validation enforces schema constraints
- No code execution from model output
- No SQL from model output
- Candidate IDs validated against actual records
- Evidence items validated against actual data

### Engineering Rules

- **Money is always integer paise** (1 INR = 100 paise). Never floating point.
- **Deterministic logic has final authority** over AI.
- **AI proposes; deterministic verification decides.**
- Never trust unvalidated LLM output.
- Original source records are preserved.
- Every financial decision is auditable.
- **0 unsafe matches is non-negotiable.**

## Evaluation Methodology

LedgerLens is evaluated against a hidden ground truth that is **never** used during reconciliation or AI investigation:

### Deterministic Engine (Baseline)
- **Correct Matches**: 75/75 (100.0%)
- **Incorrect Matches**: 0/75 (0.0%)
- **False Matches**: 0 ← **Non-negotiable constraint**
- **Trap False Matches**: 0 ← **Non-negotiable constraint**
- **Precision**: 100.0%
- **Recall**: 100.0%
- **Match Rate**: 86.7% (65/75 resolved deterministically)

### AI Investigation Layer
- **Investigations Completed**: 1 live test (OmniRoute)
- **Provider**: OmniRoute (combo routing)
- **Model**: `ledgerlens-ai`
- **Result**: INCONCLUSIVE (correctly identified insufficient evidence)
- **Tokens Used**: ~3,945 tokens per investigation
- **Verification Status**: Passed deterministic verification

**AI Limitations Disclosed**:
- AI tested live with OmniRoute only
- Gemini and Groq providers implemented but not live-tested
- AI can only investigate; cannot finalize matches
- INCONCLUSIVE results remain unresolved (safe behavior)
- Provider failures degrade gracefully to AI_UNAVAILABLE

### Scenario-Level Results

| Scenario | Correct | Incorrect | Unresolved | False Matches |
|---|---|---|---|---|
| clean-match | 25/25 | 0 | 0 | 0 |
| fee-tax-difference | 10/10 | 0 | 0 | 0 |
| timing-difference | 8/8 | 0 | 0 | 0 |
| refund | 8/8 | 0 | 0 | 0 |
| adjustment | 5/5 | 0 | 0 | 0 |
| batch-settlement | 4/4 | 0 | 0 | 0 |
| missing-merchant-record | 5/5 | 0 | 0 | 0 |
| missing-bank-record | 5/5 | 0 | 0 | 0 |
| **adversarial-trap** | **5/5** | **0** | **0** | **0** |

**Adversarial Trap Cases**: LedgerLens correctly avoids matching records with similar amounts and dates that belong to different underlying transactions.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- SQLite + Drizzle ORM
- Tailwind CSS v4
- Vitest (testing)
- Zod (validation)


## Limitations & Known Constraints

### Data Scope
- Synthetic dataset only (not real Razorpay production data)
- Fee rates and settlement timings are illustrative assumptions
- Dataset size: 75 test cases, 292 records

### AI Investigation
- OmniRoute live-tested; Gemini/Groq implemented but not live-tested
- AI cannot directly finalize matches (by design)
- Requires external AI API (system works without it)
- Token costs: ~4,000 tokens per investigation

### Reconciliation Rules
- Amount-only matching is insufficient (by design)
- Date-only matching is insufficient (by design)
- Ambiguous cases remain unresolved (conservative approach)
- Missing records cannot be fabricated (by design)

### Production Readiness
- Not production-ready (buildathon submission)
- No authentication/authorization
- Single-user local deployment
- No backup/recovery mechanisms
- No audit log immutability enforcement

## Testing

```bash
# Run all tests (220 tests)
npm test

# Run specific test suite
npm test -- engine.test.ts
npm test -- evidence-builder.test.ts

# Run with coverage
npm test -- --coverage
```

**Test Coverage**:
- Deterministic reconciliation: 8 tests
- AI evidence builder: 8 tests
- AI deterministic verifier: 9 tests
- AI candidate selector: 9 tests
- AI response parser: 10 tests
- Money arithmetic: 23 tests
- Dataset generator: 22 tests
- Total: 220 tests passing

## License

This is a buildathon submission project. See LICENSE file for details.

## Acknowledgments

Built for the **Razorpay AI Buildathon** — Track 04: AI Finance Controller.

**Team**: LedgerLens  
**Track**: AI Finance Controller  
**Date**: September 2026

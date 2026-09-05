# LedgerLens

**AI Finance Controller for Deterministic Reconciliation**

> **Match what can be proven. Investigate what cannot. Never guess.**

Built for **Razorpay AI Buildathon 2026 — Track 04: AI Finance Controller**

---

## The Problem

Modern finance operations teams face a **verification problem**, not a data shortage problem.

Payment records arrive from multiple sources:
- **Merchant ledger** (what you think you earned)
- **Payment processor settlements** (what Razorpay says they processed)
- **Bank statements** (what actually arrived)

These records rarely line up perfectly:
- Fees and taxes create amount differences
- Settlements are batched and delayed
- Refunds appear days after the original transaction
- Bank charges appear with cryptic descriptions
- Identifiers don't match across systems

Finance teams must determine:
- ✅ What matched and can be closed
- ❌ What didn't match and why
- 🔍 What needs investigation
- ⚠️ What represents actual discrepancies

**The danger**: AI models are excellent at finding *plausible* explanations, but plausibility is not proof. A confident AI match based on similar amounts and timing can create false reconciliations that hide real financial discrepancies.

---

## The LedgerLens Solution

LedgerLens separates **provable financial truth** from **investigative reasoning**:

```
┌─────────────────────────────────────────────────────────────┐
│  INGEST → NORMALIZE → DETERMINISTIC MATCH                    │
│                           ↓                                   │
│                    EXCEPTION DETECTION                        │
│                           ↓                                   │
│                    AI INVESTIGATION ← (advisory only)         │
│                           ↓                                   │
│               DETERMINISTIC VERIFICATION ← (final authority)  │
│                           ↓                                   │
│                    AUDITABLE RESULT                           │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Deterministic matching proves financial truth**
   - Exact ID matches across sources
   - Rule-based matching (refunds, adjustments, batch settlements)
   - Amount + timing + context validation
   - No guessing

2. **AI investigates unresolved exceptions**
   - Analyzes multi-source evidence
   - Identifies candidate records
   - Proposes explanations
   - **Never decides final truth**

3. **Deterministic verification remains final authority**
   - Validates AI proposals against hard rules
   - Rejects unsupported conclusions
   - Preserves "unresolved" as a valid state
   - No unsafe fallback to "matched"

---

## Why This Matters

### Traditional Approach (Dangerous)
```
Records → LLM → "Looks like a match!" → Approved ❌
```
**Risk**: Hallucinations, confident but incorrect matches, hidden discrepancies.

### LedgerLens Approach (Safe)
```
Records → Deterministic Engine → Matched ✓ or Exception ⚠
                                      ↓
                              AI Investigation (advisory)
                                      ↓
                         Deterministic Verification (authority)
                                      ↓
                              Matched ✓ or Unresolved 🔍
```
**Result**: AI power for investigation + deterministic safety for financial decisions.

---

## Architecture

### 1. **Ingestion & Normalization**
- Import CSV/JSON from merchant, processor, bank
- Normalize to common schema
- Preserve original source data immutably
- Money represented as **integer paise** (no floating-point)

### 2. **Deterministic Reconciliation Engine**

**Exact Matching**:
- Razorpay Order ID → Merchant Order ID → Bank Reference
- Amount + date + identifiers

**Rule-Based Matching**:
- **Refunds**: Negative amount, original transaction link, timing window
- **Adjustments**: Fee corrections, chargebacks, reversals
- **Batch Settlements**: Group matching with fee deduction

**Exception Classification**:
- Missing records (one source, not others)
- Amount discrepancies (IDs match, amounts don't)
- Timing differences (same transaction, different dates)
- Unidentified transactions (no matching ID)

**Priority Ranking**:
- High: Large amounts, unidentified bank transfers
- Medium: Timing differences, missing records
- Low: Matched with minor discrepancies

### 3. **AI Investigation Layer**

When deterministic matching produces exceptions, AI investigates:

**Evidence Builder**:
- Gathers 3-way evidence (merchant, processor, bank)
- Identifies candidates by amount/timing proximity
- Builds structured investigation prompt
- **Excludes hidden benchmark metadata** (no access to ground truth)

**OmniRoute LLM**:
- Analyzes observable evidence only
- Identifies patterns (fee relationships, timing delays)
- Proposes candidate matches with reasoning
- Returns **structured, parseable response**

**What AI Does**:
- ✅ Analyze timing patterns
- ✅ Identify fee relationships
- ✅ Explain likely scenarios
- ✅ Rank candidate matches

**What AI Does NOT Do**:
- ❌ Access ground truth
- ❌ Invent transactions
- ❌ Become final authority
- ❌ Force matches on insufficient evidence

### 4. **Deterministic Verification**

AI output is **untrusted input** that must be verified:

```typescript
// AI proposes: "Record A matches Record B"
// Verification:
- Do both records exist? ✓
- Are identifiers valid? ✓
- Is amount relationship explained? ✓
- Is timing reasonable? ✓
- Are transaction types compatible? ✓
- Is this a trap case? (similar but intentionally unmatched) ✓

// Only if ALL checks pass → Accept
// Otherwise → Reject or remain Unresolved
```

**Safety invariants**:
- Amount alone does not prove identity
- Similar IDs do not prove identity
- Refunds must link to original transactions
- Adjustments must have valid reason codes
- Ambiguous cases remain unresolved

### 5. **Audit Trail**

Every decision is logged:
- Matching rule applied
- Evidence considered
- AI reasoning (if applicable)
- Verification result
- Timestamp and user
- Deterministic = yes/no

---

## Benchmark Results

**Evaluation Methodology**: 75 synthetic cases covering real-world reconciliation scenarios including clean matches, fee differences, refunds, adjustments, timing issues, missing records, and adversarial traps.

| Metric | Result |
|--------|-------:|
| **Benchmark Cases** | 75 |
| **Source Records** | 292 |
| **Scenarios Covered** | 9 types |
| **Clean Matches** | 25 cases |
| **Fee/Tax Differences** | 10 cases |
| **Timing Differences** | 8 cases |
| **Refunds** | 8 cases |
| **Adjustments** | 5 cases |
| **Batch Settlements** | 4 cases |
| **Missing Records** | 10 cases |
| **Adversarial Traps** | 5 cases |

**Test Suite**: 220/220 tests passing including unit, integration, and reconciliation engine tests.

**Note**: All benchmark data is synthetic and seeded for repeatability. This is NOT real Razorpay production data.

### Why Adversarial Traps Matter

The benchmark includes **intentional trap cases**: records that look similar (same amount, close timing, similar description) but represent **different transactions**.

**Example trap**:
```
Merchant: ₹1,500 order #12345 on Jan 5
Bank: ₹1,500 deposit on Jan 6, description "Payment"
Ground Truth: NOT the same transaction (test case)
```

**LedgerLens behavior**: Refuses to match based on amount and timing alone. Requires explicit identifier linking or evidence of the relationship. **Similarity is not proof.**

**Why this matters in production**: Real financial systems have coincidental similar transactions. A system that matches on "looks close enough" will create false reconciliations that hide real discrepancies.

---

## Safety Model

### Financial Safety
- **Integer paise** throughout (no floating-point arithmetic)
- **Immutable source records** (never modified after import)
- **Deterministic matching** as source of truth
- **AI output treated as untrusted** (validated before use)
- **No hallucinated transactions** (all record IDs verified)
- **Unresolved is valid** (insufficient evidence stays unresolved)

### AI Safety Boundary
```
┌─────────────────────────────────────────────────────┐
│  AI MAY:                                             │
│  - Analyze evidence                                  │
│  - Propose explanations                              │
│  - Identify candidates                               │
│  - Rank possibilities                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  AI MAY NOT:                                         │
│  - Access hidden ground truth                        │
│  - Bypass verification                               │
│  - Invent records                                    │
│  - Force matches                                     │
│  - Become final authority                            │
└─────────────────────────────────────────────────────┘
```

### Error Handling
- **Provider unavailable**: Graceful degradation, investigation unavailable
- **Timeout**: Investigation fails safely, no forced conclusion
- **Malformed response**: Rejected, logged, exception remains unresolved
- **Invalid candidate**: Verification catches invalid record IDs
- **Ambiguous evidence**: Remains unresolved, no guessing

---

## Product Walkthrough

### 1. **Authentication**
- Firebase Authentication (Google Sign-In + Email/Password)
- User identity with audit trail
- Secure session management

### 2. **Dashboard**
- Reconciliation overview
- Exception count by priority
- Money at risk summary
- Recent activity

### 3. **Import & Reconciliation**
- Upload CSV files (merchant, processor, bank)
- Preview and validate before import
- Run reconciliation engine
- View matched results and exceptions

### 4. **Exception Queue**
- Prioritized list of unmatched records
- Filter by source, priority, amount
- Visual indicators for exception type
- Bulk actions for resolution

### 5. **Investigation Modal**
- 3-way evidence view (merchant, processor, bank)
- Transaction timeline
- Candidate matches with similarity scores
- AI investigation reasoning
- Deterministic verification result
- **"Why Unresolved" section** when insufficient evidence

### 6. **Audit Trail**
- Complete decision history
- User actions and timestamps
- Evidence used for each decision
- Deterministic vs AI-assisted indicator

### 7. **Global Search**
- Search by transaction ID, amount, date, description
- Jump to record details
- Cross-source linking

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router)
- **React 19** with Server Components
- **TypeScript** (strict mode)
- **Tailwind CSS** + Design System
- **React Three Fiber** (3D globe visualization)
- **shadcn/ui** components

### Backend
- **Next.js API Routes** (serverless)
- **SQLite** (local) / **Drizzle ORM**
- **Zod** (schema validation)
- **Firebase Authentication**

### AI
- **OmniRoute** (multi-provider LLM gateway)
- **Structured output parsing**
- **Provider abstraction** (supports Gemini, Groq)

### Testing
- **Vitest** (220 tests)
- **Synthetic data generation** (seeded, repeatable)
- **Evaluation harness** (benchmark validation)

---

## Local Setup

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ledgerlens

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see below)

# Seed synthetic data
npm run seed

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

Required in `.env.local`:

```bash
# Database (local development)
LEDGERLENS_DB_PATH=./data/ledgerlens.db
LEDGERLENS_DB_DRIVER=sqlite

# AI Investigation (optional - graceful degradation if missing)
AI_PROVIDER=omniroute
AI_MODEL=gpt-4o
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.omniroute.ai/v1

# Firebase Authentication (required)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

See `.env.example` for complete configuration options.

### Testing

```bash
# Run test suite
npm test

# Run linter
npm run lint

# Build production
npm run build
```

---

## Demo Data

LedgerLens includes a synthetic dataset generator (`npm run seed`) that creates realistic reconciliation scenarios:

- **75 cases** across 9 scenario types
- **292 total records** (merchant: 97, processor: 107, bank: 88)
- Real-world patterns: fees, refunds, adjustments, timing differences
- **Adversarial traps** to test matching safety
- Seeded for repeatability (seed: 42)

**Important**: This is **synthetic** data for development and evaluation. Not real merchant transactions. Not real Razorpay production data.

---

## Limitations & Future Work

### Current Limitations
1. **Single currency**: Currently supports INR only
2. **Batch complexity**: Limited to simple batch patterns
3. **Manual import**: No automated data pipeline
4. **Local database**: SQLite for development (production would use Firebase/PostgreSQL)
5. **Investigation speed**: AI calls are synchronous (could be async queue)

### Future Enhancements
1. **Multi-currency support** with proper conversion tracking
2. **Advanced batch patterns** (partial settlements, multi-day batches)
3. **Automated data ingestion** (API integrations, webhooks)
4. **Machine learning** for pattern detection (trained on historical matches)
5. **Real-time sync** with live payment systems
6. **Team collaboration** (assignment, notes, approval workflows)

---

## Design Philosophy

**"Never guess financial truth."**

LedgerLens was built on three principles:

1. **Prove what can be proven**
   - Use deterministic rules for unambiguous matches
   - Exact identifiers, amounts, relationships

2. **Investigate what remains unexplained**
   - Use AI to analyze patterns and propose explanations
   - But treat AI output as hypotheses, not conclusions

3. **Accept uncertainty**
   - "Unresolved" is a valid financial state
   - Insufficient evidence should not force a match
   - Better to investigate than to guess wrong

---

## Project Context

**Built for**: Razorpay AI Buildathon 2026 — Track 04: AI Finance Controller

**Problem addressed**: Finance operations teams spend significant time manually reconciling payment records across merchant ledgers, payment processor settlements, and bank statements. Existing tools are either fully manual or use AI in ways that risk false matches.

**Innovation**: Separate provable financial truth (deterministic) from investigative reasoning (AI), ensuring AI enhances rather than replaces financial control.

**Target users**: Finance operations teams, accounting departments, financial controllers.

---

## License

[Specify actual license here]

---

## Team

[Team information]

---

## Acknowledgments

- **Razorpay** for hosting the buildathon and providing the problem context
- **OmniRoute** for multi-provider LLM gateway
- **andygreig/webgl-globe** for the beautiful 3D globe component

---

**LedgerLens** is not an AI that guesses what happened.

It is a finance controller that proves what happened, and investigates what remains unexplained.

# LedgerLens - Devpost Submission Content

**Copy-paste ready sections for Devpost submission**

---

## Project Name
**LedgerLens**

---

## Tagline
AI Finance Controller that matches what can be proven, investigates what cannot, and never guesses.

---

## Inspiration

Finance teams reconciling payment records face a dangerous trap: AI is excellent at finding plausible explanations, but plausibility is not proof.

When payments flow through merchant ledgers, processor settlements, and bank statements, records rarely line up perfectly. Fees differ. Settlements are batched. Identifiers don't match. Timing varies.

We needed a system that could use AI's pattern recognition power **without** giving it the authority to decide financial truth. A confident but incorrect AI match can hide real discrepancies worth thousands.

LedgerLens was inspired by the principle: **"Similar enough" is not a financial control.**

---

## What it does

LedgerLens reconciles multi-source financial records using a **deterministic-first pipeline** with AI investigation only for unresolved exceptions.

### The Flow

1. **Ingest & Normalize**: Import records from merchant ledger, payment processor, and bank statements
2. **Deterministic Matching**: Apply exact ID matching, rule-based matching (refunds, adjustments, batches), and validation
3. **Exception Detection**: Classify unmatched records by type and priority
4. **AI Investigation**: For unresolved exceptions, AI analyzes 3-way evidence and proposes candidate matches
5. **Deterministic Verification**: Validate AI proposals against hard rules - reject unsupported conclusions
6. **Audit Trail**: Log every decision with evidence and reasoning

### What Makes It Different

**Traditional approach**: Records → LLM → "Looks like a match!" → Approved ❌

**LedgerLens**: Records → Deterministic Match (proves) OR Exception → AI Investigates (proposes) → Deterministic Verification (decides) ✓

**Result**: AI power for investigation + deterministic safety for financial decisions.

---

## How we built it

### Frontend
- **Next.js 16** with App Router and React Server Components
- **TypeScript** (strict mode) for type safety
- **Tailwind CSS** with Material Design tokens
- **React Three Fiber** for interactive 3D globe on login
- **shadcn/ui** component library

### Backend & Data
- **Next.js API Routes** (serverless functions)
- **SQLite + Drizzle ORM** for local development
- **Zod schemas** for validation
- **Money as integer paise** (no floating-point arithmetic)

### Authentication
- **Firebase Authentication** (Google Sign-In + Email/Password)
- Auth context with user management
- Protected routes and audit trail

### AI Integration
- **OmniRoute** multi-provider LLM gateway (supports GPT-4o, Claude, Gemini, Groq)
- Structured output parsing with retry logic
- Evidence-based prompting (no ground truth access)
- **Deterministic verification layer** that treats AI output as untrusted input

### Reconciliation Engine
- **Exact matching**: ID-based across sources
- **Rule-based matching**: Refunds (negative amount + original link), adjustments (fee corrections), batch settlements
- **Exception classification**: Missing records, amount discrepancies, timing differences, unidentified transactions
- **Priority ranking**: High (large amounts, unidentified), Medium (timing issues), Low (minor discrepancies)

### Evaluation
- **Synthetic data generator**: 75 cases, 292 records, 9 scenario types
- **Adversarial traps**: Intentionally ambiguous cases to test safety
- **220 automated tests**: Unit, integration, and reconciliation engine tests
- **Benchmark harness**: Validates correctness, precision, recall, false matches

---

## Why AI was necessary

Finance reconciliation has patterns that are obvious to humans but hard to encode as rigid rules:

- **Fee relationships**: "This ₹945 bank deposit is ₹1000 minus 5.5% processor fee"
- **Timing patterns**: "Settlements arrive 2 business days after transaction"
- **Description matching**: "RAZORPAY*12345" in bank statement → order #RZP_12345 in processor
- **Batch logic**: "These 50 small transactions settled as one ₹50,000 bank deposit"

Writing deterministic rules for every edge case is impractical. But letting AI decide matches is unsafe.

**LedgerLens solution**: AI analyzes patterns and proposes explanations, but deterministic rules verify proposals and remain the final authority.

---

## What makes it different

### 1. **AI is advisory, not authoritative**
Most AI finance tools give the model final decision power. LedgerLens treats AI output as hypothesis that must be verified.

### 2. **Unresolved is a valid state**
When evidence is insufficient, LedgerLens refuses to guess. "Unresolved" stays unresolved until more information arrives.

### 3. **Adversarial testing**
The benchmark includes trap cases: records that look similar (same amount, close timing) but are intentionally different transactions. LedgerLens must refuse to match them.

### 4. **Money as integers**
Financial calculations use integer paise throughout. No floating-point arithmetic = no rounding errors = no accumulating discrepancies.

### 5. **Audit-first design**
Every decision logs: matching rule applied, evidence considered, AI reasoning (if applicable), verification result, timestamp. Full traceability.

### 6. **Graceful AI degradation**
If the AI provider is unavailable, LedgerLens continues functioning with deterministic matching. Investigations simply become unavailable rather than failing catastrophically.

---

## Challenges we ran into

### 1. **Streaming Provider Reliability**
OmniRoute initially used streaming responses which were unstable during development. We switched to non-streaming requests with retry logic and timeout handling for production reliability.

### 2. **Evidence vs Ground Truth Separation**
The benchmark includes ground truth labels for evaluation. Critical challenge: ensure AI **never** receives ground truth during investigation. We built strict data isolation - AI sees only observable records, evaluation harness sees ground truth separately.

### 3. **Candidate Selection Accuracy**
Early AI investigations failed because candidate records weren't pre-filtered effectively. We added smart candidate selection: filter by amount proximity (±20%), timing window (±7 days), and record existence before sending to AI.

### 4. **Authentication Integration**
Integrating Firebase Authentication with Next.js 16 App Router required careful handling of:
- Client/server component boundaries
- Auth context provider placement
- Protected route guards without redirect loops
- Robust avatar fallback (photoURL → initials → "U")

### 5. **Globe Interaction Debugging**
The 3D globe on the login page uses React Three Fiber with OrbitControls. Getting mouse-follow interaction to work required understanding OrbitControls' internal damping system and angle management. Final solution: disable damping and use direct angle manipulation via OrbitControls API.

### 6. **Money Representation**
Enforcing integer paise throughout the stack required discipline:
- Database stores integers
- API accepts/returns integers
- UI displays as ₹X.XX (formatted from paise)
- Calculations never use floats
- Validation rejects decimal amounts

---

## Accomplishments that we're proud of

### 1. **Zero Unsafe Matches**
Our benchmark includes 5 adversarial trap cases designed to fool pattern-matching systems. LedgerLens correctly refuses all of them. No false matches = no hidden financial discrepancies.

### 2. **Deterministic-AI Separation**
We built a clear architectural boundary:
- Deterministic engine: 100% reproducible, no model calls
- AI layer: Enhancement only, never bypasses verification
- Clean separation enables trust and auditability

### 3. **Real-World Scenario Coverage**
The synthetic benchmark covers actual finance-ops patterns we researched:
- Fee and tax differences
- Refund reconciliation with timing delays
- Adjustment handling (chargebacks, fee corrections)
- Batch settlement matching
- Missing records across sources
- Adversarial ambiguous cases

### 4. **Production-Ready Financial Safety**
- Integer paise representation
- Immutable source records
- Schema validation on every input
- Audit trail for every decision
- Safe error handling (no unsafe fallbacks)

### 5. **Comprehensive Testing**
220 automated tests covering:
- Reconciliation engine logic
- AI provider integration
- Data normalization
- Exception classification
- Candidate selection
- Verification rules
- Database operations

---

## What we learned

### 1. **AI Needs Guardrails in Finance**
LLMs are powerful tools but dangerous as final authorities. The key insight: use AI for analysis and pattern recognition, but keep deterministic rules as gatekeepers.

### 2. **"Unresolved" Has Value**
It's tempting to force every exception to resolution, but accepting "insufficient evidence" as a valid state is more honest and safer than guessing.

### 3. **Benchmark Design Matters**
Including adversarial trap cases (intentionally ambiguous records) was critical for testing safety. Without them, we wouldn't know if the system properly rejects unsafe matches.

### 4. **Evidence Isolation is Hard**
Separating observable evidence (what AI should see) from ground truth (what evaluators know) required careful architecture. Easy to accidentally leak evaluation metadata into prompts.

### 5. **Financial Primitives are Critical**
Using integers for money, immutability for source records, and schema validation everywhere isn't over-engineering - it's the foundation of trustworthy financial software.

---

## What's next for LedgerLens

### Short-term
1. **Multi-currency support** with proper conversion tracking and rate validation
2. **Automated data ingestion** via API integrations and webhooks
3. **Async investigation queue** for better performance at scale
4. **Team collaboration features** (assignment, notes, approval workflows)
5. **Advanced batch patterns** (partial settlements, multi-day batches, split payments)

### Long-term
1. **Machine learning for pattern detection** trained on historical matches (with human validation)
2. **Real-time sync** with live payment systems
3. **Predictive exception detection** (flag likely issues before they become problems)
4. **Integration marketplace** (connect to accounting systems, ERPs, banking APIs)
5. **Regulatory compliance reporting** (audit exports, compliance dashboards)

### Research Directions
1. **Hybrid reasoning systems** combining symbolic rules with neural pattern matching
2. **Explainable AI for finance** with traceable decision paths
3. **Adversarial robustness testing** for financial ML systems

---

## Built With

### Languages & Frameworks
- TypeScript
- Next.js 16
- React 19
- Node.js

### Database & Backend
- SQLite
- Drizzle ORM
- Zod

### AI & ML
- OmniRoute
- OpenAI GPT-4o (via OmniRoute)
- Claude 3.5 Sonnet (via OmniRoute)
- Structured output parsing

### Authentication & Services
- Firebase Authentication
- Google Sign-In

### Frontend & UI
- Tailwind CSS
- shadcn/ui
- Material Design
- React Three Fiber
- Three.js

### Testing & Quality
- Vitest
- TypeScript strict mode
- ESLint

### Development Tools
- pnpm
- tsx
- Next.js Turbopack

---

## Track

**Track 04: AI Finance Controller**

Razorpay AI Buildathon 2026

---

## Demo

[Demo link / video link placeholder]

---

## Repository

[GitHub repository link placeholder]

---

## Responsible AI Statement

LedgerLens uses AI as an investigative tool, not a decision-making authority. Key safety measures:

1. **AI output is untrusted**: All AI proposals are validated by deterministic rules
2. **No hidden data access**: AI sees only observable records, never ground truth
3. **Graceful degradation**: System functions without AI if provider unavailable
4. **Audit trail**: Every AI-assisted decision logs reasoning and verification
5. **Unresolved is valid**: Insufficient evidence stays unresolved, no forced matches
6. **Adversarial testing**: Benchmark includes trap cases to test safety boundaries

**Our commitment**: AI should enhance human financial control, not replace it.

---

## Screenshots

[See docs/SUBMISSION_ASSETS.md for screenshot guidance]

---

## Video

[See docs/VIDEO_SCRIPT.md for demo flow]

---

**LedgerLens**: Match what can be proven. Investigate what cannot. Never guess.

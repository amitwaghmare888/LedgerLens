# LedgerLens Execution Steps

## CURRENT STATUS

### PHASE 2 — HARDENING — ACTIVE

We are currently in Phase 2 Hardening.

Do not move to Phase 3 until Phase 2 Hardening is verified complete.

---

## Project Goal

LedgerLens is a fintech reconciliation and exception investigation product for the Razorpay AI Buildathon Track 04: AI Finance Controller.

Core principle:

MATCH WHAT CAN BE PROVEN.
INVESTIGATE WHAT CANNOT.
NEVER GUESS.

---

## Completed

### Phase 1 — Financial Foundation
- Exact money handling
- Deterministic PRNG and IDs
- Domain types
- Financial invariants
- SQLite + Drizzle foundation
- Synthetic dataset
- Independent ground truth
- Adversarial trap cases
- Repeatable seed
- Tests

Current dataset:
- 75 cases
- 292 records

### Frontend Foundation
- Application shell
- Sidebar
- Sidebar collapse
- Top bar
- Theme support
- Overview dashboard
- Reconciliation UI
- Stitch-based visual system
- Local UI verified

### Phase 2 — Deterministic Reconciliation Engine
- Normalization
- Exact matching
- Rule matching
- Batch matching
- Exception classification
- Priority ranking
- Engine orchestration
- Repository/persistence layer
- Reconciliation APIs
- Evaluation harness
- Reconciliation UI wiring

Verified before hardening:
- 121/121 tests passing
- lint clean
- build passing
- seed passing
- zero trap false matches

---

## CURRENT PHASE

# Phase 2 — Hardening

### 1. Refund reconciliation
Current result:
- 0/8 resolved

Goal:
Resolve legitimate refund cases only when observable evidence proves the relationship.

Requirements:
- Do not match by amount alone.
- Do not match by date alone.
- Do not use groundTruth, scenarioType, or isTrap.
- Keep status and transaction type as separate concepts.
- Never map Razorpay status to transaction type.
- Add only the minimum required domain fields.

### 2. Mixed adjustment evaluation

Adjustment cases may contain:
- a correctly reconciled original payment
- a legitimate unresolved adjustment exception

The evaluator must support mixed expected outcomes.

Do not force an entire case into one status.

### 3. Evaluation metrics

Precisely define and test:
- precision
- recall
- match rate
- false positives
- false negatives
- unresolved
- unsafe matches
- trap false matches

Never change formulas simply to improve the reported numbers.

### 4. Regression and safety

Must preserve:
- same amount does not imply same transaction
- same date does not imply same transaction
- similar identifiers do not prove a match
- ambiguous candidates remain unresolved
- incomplete batches remain unresolved
- invalid arithmetic cannot produce a valid match
- zero unsafe matches
- zero trap false matches

### 5. Deterministic quality

After hardening:
- identical input must produce identical output
- evaluation metadata must remain isolated
- no hidden ground truth may reach production reconciliation logic

---

## Phase 2 Hardening Definition of Done

Phase 2 is complete only when:

- refund cases are resolved where observable evidence is sufficient
- mixed adjustment cases are evaluated correctly
- metric definitions are mathematically consistent
- regression tests pass
- zero unsafe matches
- zero trap false matches
- no unsupported Razorpay assumptions are introduced
- lint passes
- tests pass
- build passes
- seed passes

If evidence is insufficient, leave the case unresolved rather than forcing a match.

---

## Phase 3 — Real Data Ingestion & Persistence

Only after Phase 2 Hardening is complete.

Planned:
- CSV ingestion
- XLSX ingestion where required
- source validation
- column mapping
- provenance preservation
- production persistence architecture
- real data flowing into the deterministic engine

---

## Phase 4 — Finance Operations UI

Implement the remaining canonical Stitch screens:

1. Exception Queue
2. Exception Investigation
3. Transaction Detail
4. Audit Trail
5. Settings

Use real backend data.

---

## Phase 5 — AI Investigation

Only after deterministic reconciliation is stable.

Architecture:

deterministic engine
? unresolved cases
? constrained evidence/candidate selection
? LLM investigation
? structured output
? deterministic verification
? final decision

Planned infrastructure:
- OmniRoute
- Gemini
- Groq

AI must never become the financial source of truth.

The system must be able to say:

Insufficient evidence. LedgerLens will not guess.

---

## Phase 6 — Final Evaluation & Submission

Measure actual results:

- precision
- recall
- match rate
- unresolved
- false positives
- false negatives
- unsafe matches
- trap false matches
- scenario-level performance
- runtime
- model usage/cost where applicable

Compare:
1. exact-match baseline
2. deterministic LedgerLens
3. deterministic + AI

Document:
- what broke
- why it broke
- how it was fixed
- remaining limitations

Submission:
- public GitHub repository
- architecture breakdown
- working product
- five-minute pitch video

---

## Agent Working Rules

Antigravity FREE tier is being used.

Optimize for:

HIGH QUALITY + LOWEST REASONABLE TOKEN/USAGE

Prefer:
- direct targeted edits
- small patches
- focused inspection
- existing utilities/components
- targeted tests

Avoid:
- large terminal editing scripts
- regex-based bulk rewrites
- rewriting whole files for small changes
- repeated inspection of unchanged files
- unnecessary planning documents
- unnecessary dependencies
- speculative features

Do not perform browser tasks.
The project owner handles browser testing, Stitch visual checks, and Vercel UI.

Do not use Stitch MCP unless explicitly requested.

Never trade correctness, security, accessibility, financial integrity, or tests for token savings.

---

## Global Engineering Rules

- Money must be exact integer paise.
- No floating-point financial calculations in production reconciliation logic.
- Deterministic logic has final authority.
- LLM output must be schema validated.
- Preserve original source data.
- Never fabricate financial facts or metrics.
- Never expose secrets client-side.
- Never use hidden evaluation metadata in production logic.
- Never assume Razorpay behavior without official verification.
- Prefer simple, testable architecture.
- Do not add functionality without a clear product reason.

---

## CURRENT NEXT ACTION

Finish:

### PHASE 2 — HARDENING

Specifically:
1. Refund resolution
2. Mixed adjustment evaluation
3. Metric audit
4. Regression and negative tests
5. Preserve zero unsafe matches
6. Final validation

Do not begin Phase 3 or AI until this phase is verified complete.

# LedgerLens

Financial reconciliation and exception investigation system.

Connects three data sources:
- **Merchant books** — the merchant's accounting records
- **Razorpay settlement data** — payment gateway transactions and settlements
- **Bank statements** — actual bank credits and debits

> **"When the numbers don't agree, LedgerLens finds out why."**

Built for the Razorpay AI Buildathon — Track 04: AI Finance Controller.

## Status

Phase 1 (Foundation) is complete:
- SQLite database with Drizzle ORM
- Domain types and financial invariants
- Integer paise money module (no floating point)
- Deterministic synthetic dataset (~150+ records, 9 scenario types)
- Ground truth for evaluation (never used in reconciliation)
- Full test suite

The reconciliation engine, AI investigation layer, and production UI are planned for later phases.

## Local Setup

```bash
# Install dependencies
npm install

# Generate the synthetic development dataset
npm run seed

# Run tests
npm test

# Start development server
npm run dev

# Production build
npm run build
```

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

```
Input sources → Normalization → Deterministic Reconciliation
→ Unresolved cases → Constrained AI Investigation
→ Deterministic Verification → Resolved / Human Review → Audit Trail
```

### Engineering Rules

- Money is always integer paise (1 INR = 100 paise). Never floating point.
- Deterministic logic has final authority over AI.
- AI proposes; deterministic verification decides.
- Never trust unvalidated LLM output.
- Original source records are preserved.
- Every financial decision is auditable.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- SQLite + Drizzle ORM
- Tailwind CSS v4
- Vitest (testing)
- Zod (validation)

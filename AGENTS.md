<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# LedgerLens Engineering Rules

## Money
- Money MUST be represented as integer paise. Never use floating-point arithmetic for monetary values.
- All monetary calculations (add, subtract, compare) operate on integers only.

## Determinism
- Deterministic financial logic has final authority over all reconciliation decisions.
- AI may only propose or investigate; it never directly finalizes financial decisions.

## Data Integrity
- Preserve original source data exactly as ingested.
- Never fabricate financial facts, metrics, or evaluation results.
- Never trust unvalidated model output — always verify against deterministic rules.

## Security
- Never expose secrets (API keys, tokens, credentials) to the client/browser.
- Environment variables containing secrets must only be accessed server-side.

## Architecture
- Keep domain logic separate from UI components.
- Prefer small, testable modules with clear interfaces.
- Do not add dependencies without a concrete, immediate need.

## Razorpay
- Razorpay-specific assumptions must be verified against official Razorpay documentation.
- Synthetic/test data must be clearly labeled as non-production.

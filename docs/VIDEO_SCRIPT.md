# LedgerLens - 5-Minute Demo Video Script

**Target Duration**: 5:00 minutes
**Tone**: Professional, problem-focused, demo-driven
**Goal**: Show judges the problem → solution → safety → impact

---

## 0:00-0:20 — HOOK & PROBLEM INTRO (20 seconds)

**[Visual: Split screen showing merchant ledger, payment processor, bank statement with mismatched numbers]**

> "Finance teams reconcile thousands of payment records every day. Records from merchant systems, payment processors, and bank statements rarely line up perfectly."

**[Visual: Highlight discrepancies - different amounts, timing, missing records]**

> "Fees differ. Settlements are delayed. Identifiers don't match. But here's the real problem..."

---

## 0:20-0:50 — THE AI TRAP (30 seconds)

**[Visual: Traditional AI system showing confident "MATCH APPROVED" on ambiguous records]**

> "AI can find patterns and make matches. But AI excels at plausibility, not proof. A confident AI match based on similar amounts and timing can hide real financial discrepancies."

**[Visual: Show animation - two similar transactions (same amount, close timing) that are actually different]**

> "These look similar: same amount, close timing. An AI might confidently match them. But they're different transactions. That's a false reconciliation hiding a real discrepancy."

**[Visual: Text overlay: "Similar ≠ Same"]**

> "This is LedgerLens."

---

## 0:50-1:20 — CORE PRINCIPLE (30 seconds)

**[Visual: LedgerLens logo → animated flow diagram]**

> "LedgerLens separates provable financial truth from investigative reasoning."

**[Visual: Three-stage pipeline animation]**

> "First: Deterministic matching. Exact IDs, rule-based logic, amount validation. Match what can be proven."

> "Second: Exception detection. Classify unmatched records - missing records, amount discrepancies, timing differences."

> "Third: AI investigation. For unresolved exceptions, AI analyzes evidence and proposes explanations. But here's the key..."

**[Visual: Shield icon blocking AI output, with "VERIFICATION" overlay]**

> "AI output is untrusted input. Deterministic verification remains the final authority. Investigate what cannot be proven. Never guess."

---

## 1:20-2:00 — RECONCILIATION DEMO (40 seconds)

**[Screen recording: LedgerLens application]**

> "Let me show you. I'm logged into LedgerLens. This is our dashboard."

**[Visual: Dashboard showing reconciliation summary]**

> "We have 292 records imported from three sources: merchant ledger, Razorpay processor, and bank statements."

**[Click: Run Reconciliation]**

> "Running reconciliation..."

**[Visual: Progress indicator → Results summary appears]**

> "Done. 200 records matched through deterministic rules. Exact ID matches, validated refunds, batch settlements. No AI needed."

**[Visual: Highlight exceptions count]**

> "92 exceptions require investigation. Let's look at the exception queue."

---

## 2:00-2:50 — INVESTIGATION + UNRESOLVED CASE (50 seconds)

**[Visual: Exception queue, sorted by priority]**

> "Exceptions are prioritized. High priority: large amounts, unidentified transactions. Let's investigate this one."

**[Click: High priority exception - ₹14,750 bank deposit]**

**[Visual: Investigation modal opens - 3-way evidence view]**

> "Here's our three-way evidence view. Bank shows ₹14,750 deposit on January 15th. But we have no matching merchant or processor record with that exact amount."

**[Visual: Scroll to AI investigation section]**

> "LedgerLens AI investigates. It analyzes timing patterns, amount relationships, candidate records."

**[Visual: AI reasoning appears]**

> "AI proposes: this could be a batch settlement - 15 smaller transactions totaling ₹15,000, minus ₹250 in fees. It identifies the 15 candidate transactions."

**[Visual: Verification section]**

> "Deterministic verification validates: Do those 15 records exist? Yes. Do they total correctly after fees? Yes. Are they within the timing window? Yes. Are transaction types compatible? Yes."

**[Visual: Status changes to RESOLVED]**

> "Verified. Matched."

**[Click: Next exception - unresolved case]**

> "But not everything resolves. This ₹5,000 bank deposit has no clear evidence linking it to any merchant or processor record."

**[Visual: AI investigation shows "Insufficient evidence"]**

> "AI analyzed candidates. None meet verification criteria. This stays unresolved. Better to flag for manual review than guess wrong."

---

## 2:50-3:30 — SAFETY & TRAP CASES (40 seconds)

**[Visual: Return to exceptions, filter to "Adversarial Traps"]**

> "LedgerLens includes adversarial testing. These are trap cases: records that look similar but represent different transactions."

**[Click: Trap case - two ₹1,500 transactions on consecutive days]**

**[Visual: Show evidence - similar amounts, close timing, vague descriptions]**

> "₹1,500 on January 5th. ₹1,500 on January 6th. Similar descriptions. An AI might match these."

**[Visual: Show AI analysis → Verification rejection]**

> "LedgerLens AI considers them. But verification requires explicit identifier linking or clear evidence of relationship. Amount and timing similarity are not proof."

**[Visual: Status remains UNRESOLVED]**

> "Correctly refused. No false match. No hidden discrepancy."

**[Visual: Text overlay: "Zero Unsafe Matches"]**

---

## 3:30-4:00 — BENCHMARK & RESULTS (30 seconds)

**[Visual: Benchmark dashboard / test results]**

> "We tested LedgerLens on 75 synthetic cases covering real-world scenarios: clean matches, fee differences, refunds, adjustments, timing issues, missing records, and adversarial traps."

**[Visual: Results table]**

> "Results: 220 out of 220 tests passing. Precision and recall validated. Most importantly: zero false matches on trap cases."

**[Visual: Audit trail]**

> "Every decision is logged. Matching rule applied, evidence considered, AI reasoning if applicable, verification result, timestamp. Complete auditability."

---

## 4:00-4:30 — ARCHITECTURE & TECH (30 seconds)

**[Visual: Architecture diagram animation]**

> "LedgerLens is built with Next.js 16 and TypeScript. Money is represented as integer paise throughout - no floating-point arithmetic, no rounding errors."

> "AI integration through OmniRoute - multi-provider support for GPT-4o, Claude, Gemini. Structured output parsing with retry logic."

> "Firebase Authentication. SQLite with Drizzle ORM. 220 automated tests. Production-ready financial safety."

**[Visual: Code snippet showing deterministic verification]**

> "The key innovation: AI proposes, deterministic code decides. This verification layer is where safety lives."

---

## 4:30-5:00 — CLOSING & CALL TO ACTION (30 seconds)

**[Visual: Return to dashboard, zoom out to full application]**

> "LedgerLens is not an AI that guesses what happened. It's a finance controller that proves what happened and investigates what remains unexplained."

**[Visual: Three principles on screen]**

> "Match what can be proven. Investigate what cannot. Never guess."

**[Visual: LedgerLens logo with tagline]**

> "Built for Razorpay AI Buildathon 2026. LedgerLens: AI-powered investigation with deterministic financial control."

**[Visual: GitHub repo link + demo link]**

> "Try the demo. Review the code. Let's make financial AI safer together."

**[Fade to black]**

---

## VISUAL REQUIREMENTS

### Key Screenshots Needed
1. Dashboard with reconciliation summary
2. Exception queue (prioritized list)
3. Investigation modal - 3-way evidence view
4. AI reasoning section
5. Verification results (approved + rejected)
6. Unresolved case with "Why Unresolved" explanation
7. Trap case with verification rejection
8. Audit trail
9. Test results (220/220)
10. Architecture diagram

### Animations to Create
- Pipeline flow (ingest → match → exception → investigate → verify)
- Three-way evidence view (merchant/processor/bank alignment)
- Verification shield blocking unsafe AI matches
- Trap case comparison (similar but different)

### Screen Recording Tips
- Use clean test data (avoid sensitive information)
- Slow cursor movements for clarity
- Pause after each action (2-3 seconds)
- Highlight important UI elements (amounts, IDs, statuses)
- Use 1920x1080 resolution
- Record at 60fps, export at 30fps

### Audio
- Professional voiceover (clear, paced, confident)
- Optional background music (subtle, non-distracting)
- Sound effects for state changes (matched, unresolved, rejected)

---

## PACING GUIDE

| Section | Time | Focus |
|---------|------|-------|
| Hook | 0:00-0:20 | Grab attention, establish problem |
| AI Trap | 0:20-0:50 | Show risk of pure AI approach |
| Core Principle | 0:50-1:20 | Explain LedgerLens solution |
| Reconciliation | 1:20-2:00 | Show deterministic matching |
| Investigation | 2:00-2:50 | Show AI + verification (success + unresolved) |
| Safety | 2:50-3:30 | Prove trap case handling |
| Benchmark | 3:30-4:00 | Show results and audit |
| Architecture | 4:00-4:30 | Tech stack and innovation |
| Closing | 4:30-5:00 | Call to action |

---

## ALTERNATIVE 3-MINUTE VERSION

If shorter format required:

**0:00-0:30**: Problem + AI trap (combine sections 1-2)
**0:30-1:00**: Core principle (keep)
**1:00-1:45**: Reconciliation + investigation (combine, show one success)
**1:45-2:15**: Trap case safety (keep focused on zero false matches)
**2:15-2:45**: Benchmark + architecture (quick results overview)
**2:45-3:00**: Closing (streamlined)

---

## SUBMISSION NOTES

- Export as MP4, H.264 codec, 1920x1080, 30fps
- Maximum file size: check Devpost requirements
- Upload to YouTube (unlisted) for backup
- Include captions/subtitles for accessibility
- Add chapter markers if platform supports

---

**Demo Focus**: Show the safety boundary between AI investigation and deterministic verification. That's the innovation.

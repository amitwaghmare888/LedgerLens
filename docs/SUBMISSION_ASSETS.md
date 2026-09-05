# LedgerLens - Submission Assets Guide

**Screenshots, diagrams, and visual assets for Devpost submission**

---

## Required Assets Checklist

### Screenshots (9 required)
- [ ] 1. Hero/Dashboard overview
- [ ] 2. Reconciliation results summary
- [ ] 3. Exception queue (prioritized)
- [ ] 4. Investigation modal - 3-way evidence
- [ ] 5. AI investigation reasoning
- [ ] 6. Successful resolution with verification
- [ ] 7. Unresolved case with explanation
- [ ] 8. Trap case rejection
- [ ] 9. Audit trail

### Diagrams (3 required)
- [ ] 1. Architecture overview
- [ ] 2. Pipeline flow (ingest → match → verify)
- [ ] 3. Safety boundary (AI advisory vs deterministic authority)

### Demo Video
- [ ] 5-minute walkthrough (see VIDEO_SCRIPT.md)

### Optional Assets
- [ ] Logo (high-res PNG, transparent background)
- [ ] Banner image for repository
- [ ] Architecture diagram (detailed)
- [ ] Test results dashboard

---

## Screenshot Specifications

### Technical Requirements
- **Resolution**: 1920x1080 (minimum)
- **Format**: PNG (preferred) or JPG
- **Color space**: sRGB
- **File size**: < 5MB per image
- **Naming convention**: `{number}-{description}.png` (e.g., `01-dashboard-overview.png`)

### Visual Guidelines
- Use clean test data (no real financial information)
- Consistent browser zoom level (100%)
- Hide browser UI elements (F11 fullscreen mode)
- Consistent time/date in screenshots (use same test session)
- Professional lighting/contrast (avoid dark mode unless intentional)
- Highlight key UI elements with annotations if needed

---

## Screenshot Guide

### 1. Hero/Dashboard Overview
**Purpose**: First impression - show the complete application

**What to capture**:
- Full dashboard view after login
- Reconciliation summary cards (matched, unmatched, money at risk)
- Recent activity feed
- Global search bar
- Navigation sidebar
- User avatar/profile in TopBar

**Key elements to show**:
- Clean, professional UI
- Material Design consistency
- Clear information hierarchy
- Actionable metrics

**Caption**:
> "LedgerLens Dashboard: Reconciliation overview with matched records, exception count, and money at risk summary. Clean, actionable interface for finance operations teams."

**Setup**:
```bash
# Seed fresh data
npm run seed

# Login and navigate to dashboard
# URL: http://localhost:3000
```

---

### 2. Reconciliation Results Summary
**Purpose**: Show deterministic matching results

**What to capture**:
- Post-reconciliation summary screen
- Total records processed (merchant, processor, bank)
- Matched count with breakdown by matching rule
- Exception count with breakdown by type
- Processing time/performance metrics

**Key elements to show**:
- High match rate (proves deterministic engine works)
- Clear categorization of results
- Exception types (missing, amount discrepancy, timing difference)

**Caption**:
> "Reconciliation Results: 200 of 292 records matched through deterministic rules (exact ID matches, validated refunds, batch settlements). 92 exceptions flagged for investigation."

**Setup**:
- Complete reconciliation run
- Navigate to results summary page

---

### 3. Exception Queue (Prioritized)
**Purpose**: Show exception management and prioritization

**What to capture**:
- Full exception list view
- Priority indicators (High/Medium/Low with color coding)
- Exception type badges (missing, amount discrepancy, etc.)
- Amount values prominently displayed
- Filter/sort controls
- Bulk action buttons

**Key elements to show**:
- High-priority exceptions at top (large amounts, unidentified)
- Visual distinction between priority levels
- Scannable list for quick triage

**Caption**:
> "Exception Queue: 92 unresolved exceptions prioritized by risk. High priority (red): large amounts and unidentified transactions. Medium (yellow): timing differences. Low (gray): minor discrepancies."

**Setup**:
- Navigate to /exceptions
- Ensure queue has mixed priorities
- Sort by priority (high to low)

---

### 4. Investigation Modal - 3-Way Evidence
**Purpose**: Show the evidence-based investigation UI

**What to capture**:
- Investigation modal opened for specific exception
- Three-column layout: Merchant | Processor | Bank
- Record details for each source
- Candidate matches section
- Timeline visualization
- Amount relationship breakdown

**Key elements to show**:
- Clear visual separation of three data sources
- Missing records highlighted (if applicable)
- Candidate records with similarity indicators
- Professional data presentation

**Caption**:
> "3-Way Evidence View: Investigation modal showing merchant, processor, and bank records side-by-side. AI analyzes timing patterns, amount relationships, and candidate matches while deterministic rules verify proposals."

**Setup**:
- Click "Investigate" on high-priority exception
- Choose case with interesting 3-way evidence
- Ensure all three sources visible

---

### 5. AI Investigation Reasoning
**Purpose**: Show AI analysis and reasoning process

**What to capture**:
- AI investigation section within modal
- Structured reasoning text
- Identified patterns (fee calculations, timing delays)
- Candidate match proposals with confidence indicators
- Evidence references

**Key elements to show**:
- Clear, readable AI reasoning
- Structured output (not raw LLM text dump)
- Evidence-based conclusions
- Candidate records with linking explanation

**Caption**:
> "AI Investigation: LedgerLens AI analyzes observable evidence, identifies patterns (fee relationships, timing delays), and proposes candidate matches with reasoning. Note: AI output is advisory only and must pass deterministic verification."

**Setup**:
- Trigger AI investigation on complex exception
- Wait for AI response to complete
- Scroll to reasoning section

---

### 6. Successful Resolution with Verification
**Purpose**: Show the verification layer accepting valid match

**What to capture**:
- Investigation modal showing successful resolution
- AI proposal section
- Deterministic verification section with checkmarks
- Verification criteria (all passing)
- Resolution status change (Unresolved → Matched)
- Action timestamp and user

**Key elements to show**:
- Clear pass/fail indicators for verification checks
- Transparency in decision process
- Audit trail beginning

**Caption**:
> "Successful Resolution: AI proposed batch settlement match (15 transactions → ₹14,750 deposit minus fees). Deterministic verification validated: records exist ✓, amounts match ✓, timing valid ✓, types compatible ✓. Approved."

**Setup**:
- Investigate exception that should resolve
- Complete AI investigation
- Show verification passing
- Capture before status changes

---

### 7. Unresolved Case with Explanation
**Purpose**: Show system refusing to guess on insufficient evidence

**What to capture**:
- Investigation modal for unresolved case
- AI analysis showing candidates considered
- Verification rejection with specific reasons
- "Why Unresolved" explanation section
- Status remaining "Unresolved" (not forced to match)

**Key elements to show**:
- Professional handling of uncertainty
- Clear explanation of why match was rejected
- No unsafe fallback behavior

**Caption**:
> "Unresolved Case: ₹5,000 bank deposit with no clear linking evidence. AI analyzed candidates but none met verification criteria. Status remains Unresolved pending additional information. Better to flag for manual review than guess wrong."

**Setup**:
- Investigate exception with insufficient evidence
- Show AI attempting to find candidates
- Capture verification rejection
- Highlight "Why Unresolved" section

---

### 8. Trap Case Rejection
**Purpose**: Prove safety against adversarial/ambiguous cases

**What to capture**:
- Investigation modal for trap case
- Two similar records (same amount, close timing)
- AI analysis considering the match
- Verification rejection with reason: "Insufficient linking evidence"
- Status remaining "Unresolved"
- Annotation showing this is intentional trap

**Key elements to show**:
- Visual similarity of records
- System correctly refusing unsafe match
- Safety principle in action

**Caption**:
> "Adversarial Trap Case: Two ₹1,500 transactions on consecutive days with similar descriptions. AI considered matching them, but verification rejected: amount and timing similarity are not proof. Correctly refused. Zero false matches."

**Setup**:
- Filter exceptions to trap cases (if tagged)
- Or manually identify trap from benchmark
- Investigate and show rejection
- Add annotation: "Adversarial Test Case"

---

### 9. Audit Trail
**Purpose**: Show complete decision traceability

**What to capture**:
- Audit log view
- Multiple decision entries
- Columns: Timestamp, User, Record ID, Action, Rule Applied, AI Used (Y/N), Result
- Expandable detail view showing full evidence
- Export/filter controls

**Key elements to show**:
- Comprehensive logging of all decisions
- Clear distinction between deterministic and AI-assisted
- Professional audit interface

**Caption**:
> "Audit Trail: Complete decision history with timestamps, user actions, rules applied, AI reasoning (if used), and verification results. Every financial decision is traceable and auditable."

**Setup**:
- Navigate to /audit
- Show mix of matched/unresolved decisions
- Include both deterministic-only and AI-assisted entries

---

## Diagram Specifications

### 1. Architecture Overview
**Purpose**: Show system design and component relationships

**Components to include**:
- Frontend layer (Next.js, React, TypeScript)
- API layer (Next.js routes)
- Reconciliation Engine (deterministic core)
- AI Investigation Layer (OmniRoute + LLM)
- Deterministic Verification Layer
- Data layer (SQLite, Drizzle ORM)
- Authentication (Firebase)

**Visual style**:
- Clean, professional diagram
- Color-coded layers
- Clear data flow arrows
- Safety boundary highlighted (AI advisory vs deterministic authority)

**Tools**:
- Excalidraw (recommended for hand-drawn aesthetic)
- draw.io / diagrams.net
- Figma
- Mermaid (code-based)

**Caption**:
> "LedgerLens Architecture: Deterministic reconciliation engine at core, AI investigation layer as advisory enhancement, deterministic verification as final authority. Clear separation of concerns ensures financial safety."

---

### 2. Pipeline Flow Diagram
**Purpose**: Show reconciliation process from ingestion to resolution

**Stages to show**:
1. **Ingest**: CSV/JSON import from 3 sources
2. **Normalize**: Convert to common schema
3. **Deterministic Match**: Exact ID, rule-based (refunds, adjustments, batches)
4. **Exception Detection**: Classify unmatched records
5. **AI Investigation**: Analyze evidence, propose candidates (optional)
6. **Deterministic Verification**: Validate proposals against rules
7. **Result**: Matched ✓ or Unresolved 🔍
8. **Audit Trail**: Log decision

**Visual style**:
- Horizontal or vertical flow
- Decision points clearly marked
- AI path shown as branch/enhancement
- Safety checks as gates

**Caption**:
> "Reconciliation Pipeline: Deterministic matching proves financial truth. AI investigates unresolved exceptions. Deterministic verification remains final authority. Audit trail captures every decision."

---

### 3. Safety Boundary Diagram
**Purpose**: Illustrate AI advisory role vs deterministic authority

**Visual concept**:
- Two circles or zones
- **AI Zone (Advisory)**: "Analyze, Propose, Explain"
  - Pattern recognition
  - Candidate identification
  - Reasoning generation
- **Deterministic Zone (Authority)**: "Decide, Verify, Approve"
  - Rule validation
  - Evidence checking
  - Final decision
- **Boundary**: "Verification Layer" as filter/gate
- Show AI output flowing through verification before reaching decision

**Caption**:
> "Safety Boundary: AI investigates and proposes (advisory). Deterministic rules verify and decide (authority). AI output treated as untrusted input requiring validation."

---

## Asset Storage

### Directory Structure
```
ledgerlens/
├── docs/
│   ├── assets/
│   │   ├── screenshots/
│   │   │   ├── 01-dashboard-overview.png
│   │   │   ├── 02-reconciliation-results.png
│   │   │   ├── 03-exception-queue.png
│   │   │   ├── 04-investigation-modal.png
│   │   │   ├── 05-ai-reasoning.png
│   │   │   ├── 06-successful-resolution.png
│   │   │   ├── 07-unresolved-case.png
│   │   │   ├── 08-trap-case-rejection.png
│   │   │   └── 09-audit-trail.png
│   │   ├── diagrams/
│   │   │   ├── architecture-overview.png
│   │   │   ├── pipeline-flow.png
│   │   │   └── safety-boundary.png
│   │   └── video/
│   │       └── demo-video.mp4
│   ├── DEVPOST_SUBMISSION.md
│   ├── VIDEO_SCRIPT.md
│   └── SUBMISSION_ASSETS.md (this file)
```

### .gitignore Considerations
Large video files should potentially be stored externally (YouTube) and linked rather than committed to repository.

---

## Screenshot Capture Checklist

### Before Capturing
- [ ] Run `npm run seed` for fresh, consistent data
- [ ] Clear browser cache and cookies
- [ ] Use incognito/private window (clean state)
- [ ] Set browser zoom to 100%
- [ ] Hide browser toolbars (F11 fullscreen)
- [ ] Close unnecessary tabs/windows
- [ ] Ensure consistent screen resolution (1920x1080)

### During Capture
- [ ] Use professional test user (not "test@test.com")
- [ ] Verify no real financial data visible
- [ ] Check for typos in UI text
- [ ] Ensure consistent timestamp/date across screenshots
- [ ] Verify color contrast is clear
- [ ] Check that all text is readable

### After Capture
- [ ] Crop to relevant area (remove excess whitespace)
- [ ] Optimize file size (compress without quality loss)
- [ ] Add annotations if needed (arrows, highlights)
- [ ] Verify screenshot tells the story independently
- [ ] Name files according to convention
- [ ] Add to docs/assets/screenshots/

---

## Annotation Guidelines

### When to Annotate
- Highlight key UI elements that might be missed
- Emphasize important numbers or status indicators
- Draw attention to safety features (verification passing/failing)
- Show cause-and-effect relationships

### Annotation Style
- Use bright, contrasting colors (red, yellow, cyan)
- Keep annotations minimal (don't clutter)
- Use arrows for direction/flow
- Use circles/boxes for highlighting
- Add text sparingly (let caption do heavy lifting)

### Tools
- **macOS**: Preview (built-in annotation)
- **Windows**: Snip & Sketch, Paint 3D
- **Cross-platform**: GIMP, Photoshop, Figma
- **Online**: Photopea, Pixlr

---

## Video Recording Setup

See `VIDEO_SCRIPT.md` for detailed video guidance.

### Recording Tools
- **Screen recording**: OBS Studio (free, professional)
- **Webcam** (optional): For presenter intro/outro
- **Audio**: Professional USB microphone (Blue Yeti, Rode NT-USB)
- **Video editing**: DaVinci Resolve (free), Adobe Premiere, Final Cut Pro

### Recording Settings (OBS)
- **Resolution**: 1920x1080
- **Frame rate**: 60fps (export at 30fps)
- **Bitrate**: 10,000 Kbps (high quality)
- **Format**: mp4
- **Codec**: H.264

---

## Final Asset Review Checklist

### Before Submission
- [ ] All 9 screenshots captured and optimized
- [ ] All 3 diagrams created and exported
- [ ] Demo video recorded, edited, and exported
- [ ] All captions written and reviewed
- [ ] File sizes within limits
- [ ] Consistent visual style across assets
- [ ] No sensitive/real financial data visible
- [ ] No API keys, tokens, or credentials visible
- [ ] Professional, judge-ready quality
- [ ] All assets committed to repository (except large video)
- [ ] Video uploaded to YouTube (unlisted) with link in submission

---

## Quick Reference: Asset Purposes

| Asset | Primary Message |
|-------|----------------|
| Dashboard | Professional, actionable UI |
| Reconciliation Results | Deterministic matching works |
| Exception Queue | Intelligent prioritization |
| 3-Way Evidence | Evidence-based investigation |
| AI Reasoning | Transparent AI analysis |
| Successful Resolution | Verification accepts valid matches |
| Unresolved Case | System refuses to guess |
| Trap Case Rejection | Safety against false matches |
| Audit Trail | Complete traceability |
| Architecture Diagram | Clean separation of concerns |
| Pipeline Flow | Deterministic-first process |
| Safety Boundary | AI advisory vs authority |

---

**Remember**: Each asset should independently communicate part of the LedgerLens story. Judges may not read everything - visuals must carry the message.

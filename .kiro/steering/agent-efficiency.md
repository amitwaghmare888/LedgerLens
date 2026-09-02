# LedgerLens Agent Efficiency

- Prefer small targeted edits.
- Do not rewrite whole files for small changes.
- Avoid large PowerShell/bash editing scripts.
- Avoid regex bulk rewrites unless unavoidable.
- Reuse existing code/components/utilities.
- Inspect only files relevant to the current task.
- Do not repeatedly inspect unchanged files.
- Run targeted tests during development.
- Run the full validation suite only after changes stabilize.
- Do not add unnecessary dependencies or abstractions.
- Never trade correctness, security, accessibility, financial integrity, or test coverage for token savings.
- Keep agent responses concise and avoid narrating obvious tool actions.
- Do not perform browser tasks unless explicitly requested.

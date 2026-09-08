---
name: frontend-change
description: Implement or review code changes in this React or Vue repository while following the shared frontend rules and project overrides.
---

# Frontend Change

## Context

Read these files before editing:

1. `.agents/rules/00-index.md`
2. `.agents/rules/90-project-overrides.md`
3. The rule files listed for the task in the index
4. `.agents/rules/10-{{FRAMEWORK}}.md`

Read only the relevant rule files. User instructions and repository-level `AGENTS.md` constraints retain higher priority.

## Workflow

1. Inspect the affected code, its callers, and the working tree.
2. State the intended file boundary and preserve unrelated edits.
3. Implement the smallest complete change that satisfies the acceptance criteria.
4. Validate the changed behavior with the commands configured in `90-project-overrides.md`.
5. Report changed files, checks run, remaining risks, and any check you could not run.

## OpenSpec boundary

Use the official OpenSpec workflow when the task introduces or changes intended observable behavior, changes a public contract, or spans several modules as one capability.

Do not create an OpenSpec change solely for a localized bug fix that restores already documented or clearly established behavior. Diagnostics, pure refactors, documentation, copy, and small style-only changes also proceed directly unless the user explicitly asks for a proposal. If a relevant active OpenSpec change already exists, continue it instead of creating a duplicate.

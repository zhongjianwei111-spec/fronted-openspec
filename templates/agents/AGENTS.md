# Agent Instructions

This repository uses shared frontend rules and OpenSpec.

## Required context

Before editing code, read:

1. `.agents/rules/00-index.md`
2. `.agents/rules/90-project-overrides.md`
3. Rule files selected by the index for the current task
4. `.agents/rules/10-{{FRAMEWORK}}.md`

Select the OpenSpec workflow according to `.agents/rules/00-index.md`. New or changed intended behavior, public contracts, and cross-module capabilities use the official propose, apply, verify and archive workflows; localized fixes that restore established behavior can proceed directly. For implementation work, follow `.agents/skills/frontend-change/SKILL.md`.

Do not duplicate detailed engineering rules in this file. `.agents/rules/` is the canonical source.

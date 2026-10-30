# {{PROJECT}} — husk

This folder is the process layer around the code. The code is a separate git repository in `repo/`.
This file holds the process rules only. Code rules live in `repo/` (its own AGENTS.md / CLAUDE.md).

## Layout

| Path | What | Git |
|---|---|---|
| `repo/` | the code; its own git, its own rules | repo git |
| `work/` | active work sheets, one per work item | this git |
| `archive/` | closed work sheets and superseded docs; `archive/INDEX.md` is the only entry point | this git |
| `docs/` | decisions and research that outlive a work item (ADR, perspectives) | this git |

## Working with the code

- Every repo command runs with cwd = `repo/`: `git -C repo ...`, `pnpm -C repo ...`, or `cd repo && ...`.
- Paths in `repo/AGENTS.md` are relative to `repo/`, not to this folder.
- Commits of code go to the repo git. Commits of sheets, docs and archive go to this git. Never add
  `work/`, `docs/` or `archive/` to the repo git.
- `repo/` is a gitlink in this git with `ignore = all`: `git status` here is silent about code changes.

## Work sheets (`work/`)

- One active work item = one sheet `work/<id>-<slug>.md`, created from `work/_TEMPLATE.md`.
- Read the active sheet first; it is the context of the work item: goal, steps, findings, decisions.
- Keep the sheet current: a finding, a decision or a finished step is written down when it happens.
- Steps are closed in order. A step is `[x]` only after its check (tests, typecheck, manual run) is recorded in the sheet.
- Code commit sha of each closed step goes into the sheet line.

## Archive rules

- A sheet is archived when the owner says the work item is closed, not before.
- Archive = move the sheet to `archive/`, add one line to `archive/INDEX.md`: date, id, title, 1–3 lasting conclusions.
- Before archiving, check whether a conclusion belongs in `docs/`; if yes, write it there and link it.
- Do not read `archive/` during normal work. Go there only on an explicit request or when `INDEX.md`
  points to a decision relevant to the current task. Old sheets contain superseded names and rejected ideas.

## Docs (`docs/`)

- Each doc has a status line: `active` or `superseded by <file>`. Superseded docs move to `archive/`.
- Prefer updating an existing doc over writing a new one.

# {{PROJECT}} — husk

<!-- husk:base -->
This folder is the process layer around the code. The code is a separate git repository in `repo/`.
This file holds the process rules only. Code rules live in `repo/` (its own AGENTS.md / CLAUDE.md); read them before touching code.

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
- What git cannot bring back needs the owner's yes for that very action: deleting files git does not track
  (backups, data, ignored folders), writes to a database or a shared service. "Decide yourself" does not
  cover it.

## Work sheets (`work/`)

- One active work item = one sheet, created from `work/_TEMPLATE.md`. Either a file `work/<id>-<slug>.md`,
  or a folder `work/<id>-<slug>/` with `SHEET.md` as the entry point and the item's material beside it
  (screenshots, logs, drafts, docs); the sheet links that material. Different items may use different forms;
  one item has exactly one sheet.
- Read the active sheet first; it is the context of the work item: goal, steps, findings, decisions.
  Everything the orchestrator, the implementer and the reviewer need to share goes through the sheet,
  by text or by a link to a file, a screenshot, a log.
- Keep the sheet current: a finding, a decision or a finished step is written down when it happens.
- Steps are closed in order. A step is `[x]` only after its check (tests, typecheck, manual run) is recorded
  in the sheet, and after its review passed when a review process is in place and its chunk changed code.
- Code commit sha of each closed code step goes into the sheet line (`sha: later` until it is committed).
- The sheet holds what the next step needs; everyone reads it whole, every time. The rest moves to files
  beside it (folder form; turn a file sheet into a folder first), unchanged, never deleted:
  - a closed step longer than its line → `steps/S<N>.md`; the line keeps what, check result, sha. An open
    step keeps the results of its checks;
  - raw evidence (numbers, dumps, logs) → a file; `Findings` keeps the conclusion and the path;
  - a decision that was replaced → `superseded.md`, the day it is replaced. `Decisions` holds only what is
    in force.

  A line that refers to moved text names the file. A rule learnt from moved text is written to `Decisions`
  before the move.
- Limits: a step is one entry of at most 600 characters, its `check:` the latest result only (a new one
  replaces the old); what it needs beyond that goes to `steps/S<N>.md` from the moment it is needed, not only
  at close. `Findings` holds conclusions; an implementer's choices inside a step go to that step's file.
  How to run the stand and recipes that repeat across items live in `## Project facts` or `docs/`, never in a
  sheet. A sheet is at most 32 KB; over it, the orchestrator applies the moves above before the next hand-off.
  `Status` is `active | paused | done`.
- `Next:` in the sheet header names the next action and who does it; whoever hands off updates it. A fresh
  session starts there and checks it against the sheet before acting. A sheet without the header lines gets
  them at the first handoff.

## Archive rules

- A sheet is archived when the owner says the work item is closed, not before.
- Archive = set `Status: done`, move the sheet (or the whole item folder) to `archive/`, add one line to
  `archive/INDEX.md`: date, id, title, 1–3 lasting conclusions, then `git add repo` and commit this git.
- Before any commit of this git, `git add repo`: the gitlink then records the code sha the sheets refer to
  (`ignore = all` keeps it out of `status`, it does not update itself).
- Before archiving, check whether a conclusion belongs in `docs/`; if yes, write it there and link it.
- Do not read `archive/` during normal work. Go there only on an explicit request or when `INDEX.md`
  points to a decision relevant to the current task. Old sheets contain superseded names and rejected ideas.

## Docs (`docs/`)

- Each doc has a status line: `active` or `superseded by <file>`. Superseded docs move to `archive/`.
- Prefer updating an existing doc over writing a new one.
<!-- /husk:base -->

<!-- husk:blocks -->

<!-- Your own sections go anywhere outside the husk markers; `husk apply` never touches them. -->

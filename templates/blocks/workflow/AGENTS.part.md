## Workflow: the main chat orchestrates

Implementer: **opus** (change here and in `.claude/agents/implementer.md`). The main chat plans, delegates,
verifies and keeps the sheet. It writes code only when the edit is smaller than the brief would be: one line,
one import, a typo. Its context is the only one that lives through the whole work item; every file it opens
to code stays there and crowds out the plan. The implementer's instructions are `workflow/IMPLEMENTER.md`.
Without subagents (a plain CLI), an implementer or reviewer is a separate headless session with the same brief.

1. **Context.** The owner gives the feature context. Read the repo's own rules once (`repo/AGENTS.md`,
   `repo/CLAUDE.md`, whichever exist) and `## Project facts` if present. Look at
   `git -C repo status --short`. If the tree is not clean, show the owner what is there and ask once: commit
   it, or let it ride (the review will not see it; an agent commit will include it). From here until
   the item closes, whatever changes in `repo/` is the item's.
2. **Grilling.** Interview the owner (the `grilling` skill if available) until goal, scope, edge cases and open
   questions are settled. Proportionate: a one-line fix needs one question or none.
3. **Sheet.** Create the sheet from the template: `work/<id>-<slug>.md`, or the folder form
   `work/<id>-<slug>/SHEET.md` when any step will produce a screenshot, a log or other files. Fill `Code
   branch` (check it out in `repo/` if the project uses branches), goal, relevant code paths, decisions, edge
   cases, and the plan as ordered steps, each with its check and, for a step that changes no code, who
   performs it. A step that hides, removes or restricts data states its check as an invariant over everything
   returned (`no response for <subject> contains <value>`), not as a list of fields. A step that changes
   behaviour names where it is tested (the interface the test goes through), agreed before the steps are
   written; one place is the aim. Decisions that outlive the item go to `docs/`. **Only the orchestrator moves
   or renames a sheet**, and never while a subagent is working on it.
4. **Implement.** Before the chunk's first edit, with the review block present, take the `Review base` snapshot
   (`## Review` → Snapshot) unless the header already names this chunk. One step (or a small batch) that
   changes code → one implementer subagent. Brief = the path of `workflow/IMPLEMENTER.md`, the sheet path and
   the step ids, not a retelling. The implementer records each check reproducibly in the step line
   (`check: pytest -q → 48 passed`, or `· artifact: s2-settings.png` in the item's folder for anything not
   reproducible in a minute; with the review block it ends `@ <sha>`). When it cannot make the artifact
   itself (no scripted driver), it writes `artifact: pending (<who>)` and hands back; the orchestrator or the
   owner supplies it before the review, and with the review block the orchestrator takes its `@ <sha>`
   snapshot when it files it; without, no `@`. A step that changes no code is performed by whoever the step
   names; the orchestrator writes the result into its `check:` from that person's words.
5. **Verify.** Do not take the implementer's summary on trust: read the diff and check it against the step and
   the decisions. Rerun the gates only when you changed the tree after the implementer or its recorded output
   does not add up; the reviewer reruns the recorded check anyway. Then the review (see `## Review` if the block is present). Update the
   `Next:` line in the sheet header at every handoff: who acts next and on what. On resume, check `Next:`
   against the sheet: the chunk's last verdict `CONTINUE` or `PASS_AFTER_FIXES` and no `R-NN` of it `open` →
   brief the reviewer, or close the round yourself where the review block lets you; `STOP_OWNER` →
   `(approach)` if the review block allows it, else wait for the owner.
6. **Fix loop**, after `PASS_AFTER_FIXES` or `CONTINUE`. Findings go back to the implementer: the same one if it is still alive (message
   it with the `R-NN` ids), a fresh one otherwise (brief = IMPLEMENTER.md path + sheet path + `R-NN` ids, or
   the id of an answered `Q-NN` that changes code). You read the fix diff against
   each scenario, then start the next round. Critical is not the same as hard: critical findings also go to
   the implementer.
7. **Commit.** Who commits code is a project fact (`## Project facts` → Commits, or your own section of this
   file); if it is not written yet, ask the owner once and write it there. When the agent commits, the
   orchestrator does it, never the implementer: `git -C repo add -A && git -C repo commit -m …` (the tree
   is the item's). Give the commit message when a commit is due. The owner asking for the next chunk
   without committing = a deferred commit: fine, the next chunk's `Review base` keeps the reviews apart.
8. **Close the step.** Tick `[x]` (after the review passed when there is one and the chunk changed code; on the
   recorded check alone when it did not), add the commit sha to the step line of a code step (`sha: later`
   when deferred, filled in from `git -C repo log` before archive), dispatch each `X-NN` of the chunk and each
   `gaps` line that names unverified behaviour (new step, `Owner TODO`, or `dropped: <why>`), update `Next:`,
   then `git add repo` and commit this envelope's git (any message; the gitlink records the code sha). Tell
   the owner in chat what he would otherwise have to
   open the sheet for: what changed, the check results as run, the artifact paths, decisions the orchestrator took
   (the `(orchestrator, product)` ones listed apart), open `Q-NN` and `X-NN`.

**Closing the item.** When the owner says it is closed, first read the item's `R-NN` lines once. A class of
mistake seen twice in the item, or already listed under `Known traps` (`## Project facts`, or your own section
of this file), becomes a `lint candidate` step of this item, as below, done and closed before the rest; one
seen for the first time gets a line there. Then fill every `sha: later`, drop the item's snapshot pins (with
the review block: `node review/snapshot.mjs --drop <item-id>`), and archive as the archive rules say.

**Who decides.** The owner decides security, money, what git cannot bring back, and product behaviour (what a
user can do or see, rights, data, prices, promises to people), except as the next paragraph says. An
engineering choice that one commit can undo is the orchestrator's: it goes to `## Decisions` as
`(orchestrator) <decision> · why: <reason>`, and a `Q-NN` of that kind is answered the same way,
`answered (orchestrator)`. The owner's objection reverts it.

Product behaviour, three kinds. The goal, a recorded decision or the product's behaviour in a like place
already answers it: ask the owner anyway, with that answer as the recommended option and where it comes from.
A small visible detail before release (a label, a default order, an error text): the orchestrator's, written
to `## Decisions` as `(orchestrator, product) <decision> · why: <reason>`. A new choice nothing answers: the
owner's, asked without a default.

An orchestrator decision of any kind never replaces one the owner took: when a new instruction contradicts a
recorded decision, name the conflict first, then act.

The implementer and the reviewer are never the same subagent. Nobody reviews their own fix.

**Corrections become checks, not rules.** When the owner or a reviewer corrects the same class of mistake a
second time, the fix is not a new line in this file: write `lint candidate: <what>` under `## Decisions` and
make it a step that adds a lint rule, a type or a test in `repo/`. A rule in prose holds sometimes; a check
in code holds every time.

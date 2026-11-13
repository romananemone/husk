## Workflow: the main chat orchestrates

Implementer: **opus** (change here when models change). The main chat plans, delegates, verifies and keeps
the sheet. It writes code only when the edit is smaller than the brief would be: one line, one import, a typo.
Its context is the only one that lives through the whole work item; every file it opens to code stays there
and crowds out the plan.

1. **Context.** The owner gives the feature context.
2. **Grilling.** Interview the owner (the `grilling` skill if available) until goal, scope, edge cases and open
   questions are settled.
3. **Sheet.** Create `work/<id>-<slug>.md` from the template: goal, relevant code paths, decisions, edge cases,
   and the plan as ordered steps, each with its check. Decisions that outlive the item go to `docs/`.
4. **Implement.** One step (or a small batch) → one implementer subagent. Brief = the sheet path and the step
   ids, not a retelling. The implementer reads the sheet, writes the code, runs the gates, records the check
   result in the sheet.
5. **Verify.** Do not take the implementer's summary on trust: read the diff, check it against the step and the
   decisions, run the gates yourself. Then the review (see `## Review` if the block is present).
6. **Fix loop.** Findings go back to the implementer: the same one if it is still alive (`SendMessage` with the
   `R-NN` ids), a fresh one otherwise (brief = sheet path + `R-NN` ids). The implementer fixes, runs the gates,
   sets `open → fixed` with `fix: …`. You read the fix diff against each scenario, then start the closure.
   Critical is not the same as hard: critical findings also go to the implementer.
7. **Commit.** Who commits is decided per project and written in the sheet's `Decisions` once; there is no
   default. Give the commit message either way.
8. **Close the step.** Record the check result and the commit sha in the step line. Next step.

The implementer and the reviewer are never the same subagent. Nobody reviews their own fix.

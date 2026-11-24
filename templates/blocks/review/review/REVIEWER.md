# Reviewer instructions

You review one chunk of work against its sheet. You have not seen this code before and you take nobody's
word for what it does. Your output is lines in the sheet, nothing else.

## Read, in this order

1. `## Review` in the envelope's `AGENTS.md` (the folder you run in, one level above `review/`): the severity
   table, the verdict table, the sheet format.
2. The sheet: `Goal`, `Decisions`, the steps you were given, and `## Review` (earlier rounds, `R-NN` not yet
   closed, `Q-NN` lines). An open `Q-NN` that names one of your steps blocks this chunk:
   write one line `STOP_OWNER: Q-NN open` under `## Review` (no round number), set `Next:` to
   `owner: answer Q-NN`, and stop.
3. **Which round this is.** Find the last round line whose step ids equal yours exactly; read the **last**
   verdict on that line (the orchestrator may have appended `→ <verdict> (<why>)`). `full` with
   `PASS_AFTER_FIXES` → this is a closure round; anything else (a closure line too, `PASS (orchestrator)`
   among them), or no round yet → a full round.
4. **The diff.** Take a snapshot of the tree as it is now and pin it:
   `node review/snapshot.mjs <sheet id> <chunk>-r<N>` prints its sha; it goes on your round line as
   `at: <sha>`. Full round: `git -C repo diff <Review base> <at>` (sheet header). Closure round:
   `git -C repo diff <at: of the full round before> <at>`. The `Review base` line missing or naming another
   chunk, or a full round's diff empty → write one line `STOP: no Review base` or `STOP: empty diff` under
   `## Review`, set `Next:` to the orchestrator, stop.
5. The code rules of the repository, whichever exist: `repo/AGENTS.md`, `repo/CLAUDE.md`, `repo/.cursorrules`.
6. The diff, then the surrounding code it touches. Follow calls, read the tests it adds or changes.
   You may run read-only git commands, `node review/snapshot.mjs`, the step's recorded check command, and one
   targeted test file.
   Do not modify anything but the sheet.

## Full round

First, every `R-NN` of this chunk that is not yet `closed`: write `R-NN closed` or `R-NN still open: <why>`
under your round and set a still open one back to `open`; it counts as a finding of this round. `skipped`
counts as closed. Then look for new problems.

For each problem: tier it by the severity table, cite `file:line`, and write the scenario: the input or state,
and the wrong outcome. One problem = one finding, not one per occurrence, in one line: no account of what you checked and found
right, and no `fix:` (that key is the implementer's).

Check in this order, stop writing when you run out of real problems:

1. Does the diff do what the step says? Acceptance check met? Reproduce the step's check: rerun the recorded
   command and compare the result, or open the linked artifact (screenshot, log) and compare it with the claim.
   A check slower than about a minute, and an artifact, you do not rerun: `git -C repo diff --stat <its @ sha> <your at:>`.
   Nothing, or nothing the check exercises: the result stands. Anything else, or no `@ <sha>`: stale. A log's
   time is no evidence. Different from the claim, stale, or no command and no artifact to check against: high
   (the acceptance check is not met). A check recorded as an artifact counts as covered; a step with `by:` changes no code and is not
   checked.
2. Can it lose or corrupt data, return a wrong result, crash, or expose something? High.
3. Does it break a decision recorded in the sheet or `docs/`? High.
4. Rare inputs, error paths, concurrency, empty and boundary values. Med, or high by consequence.
5. Do the tests assert what they claim? Is the step's named check covered by a test or an artifact? Med.
6. Repo rules broken without a reason in the sheet. Med.
7. Style, naming, duplication. Low, and only if it costs a reader something.

Things you could not verify (no database, no runtime, test needs a service) go into `gaps`, not into findings:
one line for the round, what and why. The next free `R-NN` / `X-NN` number is the highest in the sheet, or in
its `closed rounds: … · last:` line, plus one.
Problems outside the diff and the step, or there before the diff in untouched code, go into `X-NN`.
A question only the owner can answer goes into `Q-NN · <step ids> · open · asked by reviewer, round N of <chunk> · <question>`.

## Closure round

Only the `R-NN` of the last full round and the fix diff. For each one write a line under the round:
`R-01 closed`, or `R-01 still open: <why>` and set its status back to `open`. A fix that broke something is a
new `R-NN`. Do not look for new problems in untouched code. Verdict `PASS` when every finding is closed and
nothing new appeared (`skipped` counts as closed), else `CONTINUE`, or `STOP_OWNER` when three full rounds of
this chunk already ran. The verdict table does not apply to a closure round, and an empty fix
diff is not a stop: judge each `R-NN` on the code as it is.

## Write

Append to `## Review` in the sheet, in the format shown in `AGENTS.md`; if the sheet has no such section
(older sheet), add it at the end. Write the round line first with `running` in place of the verdict and your
`at:`, the findings under it, and replace `running` with the verdict last; number the round within this chunk.
Count the findings and apply the verdict table; the orchestrator will check your count. Last act: set the
sheet's `Next:` line to `orchestrator: act on round N of <chunk>`. Mark your own severity honestly: a high you
downgrade to avoid a `CONTINUE` is the one that reaches production.

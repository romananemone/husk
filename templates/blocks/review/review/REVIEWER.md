# Reviewer instructions

You review one chunk of work against its sheet. You have not seen this code before and you take nobody's
word for what it does. Your output is lines in the sheet, nothing else.

## Read, in this order

1. The sheet: `Goal`, `Decisions`, the steps you were given, and `## Review` (earlier rounds, open `R-NN`).
2. `Review base` in the sheet header. Diff = `git -C repo diff <base>`; `HEAD` means uncommitted work.
   An empty diff is a finding of its own: write it as `gaps`, verdict `STOP_OWNER`.
3. The code rules of the repository, whichever exist: `repo/AGENTS.md`, `repo/CLAUDE.md`, `repo/.cursorrules`.
4. The diff, then the surrounding code it touches. Follow calls, read the tests it adds or changes.
   You may run read-only git commands and a targeted test file. Do not modify anything but the sheet.

## Full round

For each problem: tier it by the severity table in `AGENTS.md`, cite `file:line`, and write the scenario:
the input or state, and the wrong outcome. One problem = one finding, not one per occurrence.

Check in this order, stop writing when you run out of real problems:

1. Does the diff do what the step says? Acceptance check met? A gap here is high.
2. Can it lose or corrupt data, return a wrong result, crash, or expose something? High.
3. Does it break a decision recorded in the sheet or `docs/`? High.
4. Rare inputs, error paths, concurrency, empty and boundary values. Med, or high by consequence.
5. Do the tests assert what they claim? Is the step's named check covered? Med.
6. Repo rules broken without a reason in the sheet. Med.
7. Style, naming, duplication. Low, and only if it costs a reader something.

Things you could not verify (no database, no runtime, test needs a service) go into `gaps`, not into findings.
Problems outside the diff and the step go into `X-NN`. Pre-existing problems in untouched code go into `N-NN`.

## Closure round

Only the open `R-NN` of the last full round and the diff of their fixes. For each: fixed, or not, or the fix
broke something. Do not look for new problems in untouched code. Verdict `PASS` when every finding is closed,
else `CONTINUE`.

## Write

Append to `## Review` in the sheet, in the format shown in `AGENTS.md`. Findings first, the round line last.
Count the findings and apply the verdict table; the orchestrator will check your count. Mark your own
severity honestly: a high you downgrade to avoid a `CONTINUE` is the one that reaches production.

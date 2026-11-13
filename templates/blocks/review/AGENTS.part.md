## Review

Reviewer: **opus, effort medium** (change here when models change). A fresh subagent per round, never the
one that wrote the code. Its instructions are `review/REVIEWER.md`; the sheet is the only channel.

**When:** a chunk (one step, or the steps named for a batch) is implemented and its gates are green. Only
chunks that change code; sheet, docs and archive edits are not reviewed.

**Brief = three things, nothing else:** the path of `review/REVIEWER.md`, the path of the sheet, the step ids.
No retelling of the change, no opinion, no summary from the implementer. The reviewer reads the rest itself.

**While the reviewer runs, nobody edits the code.** A tree that changes under the reviewer voids the round.

### Severity

Severity = class of consequence. Frequency of the input never lowers a high; it only moves med ↔ low.
In doubt between two tiers, take the higher. Every finding carries a `scenario`: a concrete input → a wrong
outcome. A finding without a scenario is low, unless its consequence is high-class: then it is a `Q` to the
owner, and the reviewer writes what blocked the scenario (no DB, no runtime).

| Tier | What |
|---|---|
| **high** | data lost or corrupted · a wrong result reaches the user · crash or unhandled path · auth, injection, secret exposure · a recorded decision (sheet, `docs/`) is broken · the step's acceptance check is not met |
| **med** | wrong behaviour on a rare but real input with moderate consequence · a missing error path that degrades without crashing · a test that does not assert what it claims, or the step's named check has no test · a `repo/` rule broken without a recorded reason · a performance regression a user would notice |
| **low** | naming, duplication, style, micro-performance, comments and docs · "might", "could", "consider" |
| not a finding | outside the diff and the step → `X-NN` · present before the diff and untouched → `N-NN` note · needs an owner decision → `Q-NN` |

### Verdict per round

| Findings | Verdict | Then |
|---|---|---|
| none | `PASS` | step done |
| 0 high, ≤ 1 med, ≤ 2 low | `PASS_AFTER_FIXES` | fix all, run the gates, closure round |
| above that | `CONTINUE` | fix all, run the gates, next full round |
| open `Q-NN`, or 3 full rounds without a pass | `STOP_OWNER` | stop the chunk, report, wait |

The reviewer writes the verdict; the orchestrator checks it against this table before acting. The table wins.

**Closure** = a fresh reviewer checks only the fix diff: each finding fixed, nothing broken by a fix. Untouched
code is out of scope. Closure `PASS` closes the step; anything else → `CONTINUE`, next full round.

### In the sheet (`## Review`)

```
- round 1 · S1-S2 · full · 2026-01-15 · CONTINUE · high 1 / med 1 / low 1
  - R-01 high · open · repo/src/x.ts:42 · <what is wrong> · scenario: <input → wrong outcome>
  - R-02 med  · fixed · repo/src/y.ts:10 · <what is wrong> · scenario: <…> · fix: <what changed>
  - X-01 · <outside the step>
  - gaps: <what the reviewer could not check>
- round 2 · S1-S2 · closure · PASS
```

- The round line is written last, after the findings: findings without a round line = an unfinished round, rerun it.
- `R-NN` lines are never deleted or reworded. The implementer changes only `open → fixed` and appends `fix: …`.
  `skipped` needs the owner's word in the same line.
- Severity belongs to the reviewer. Disagreement → write a `Q-NN` and stop; do not argue in the sheet.
- Who fixes: the implementer (see the `workflow` block if present). The orchestrator fixes only what is
  smaller than a brief.
- Optional before archiving: one full round over the whole work item with `Review base` = the sha before
  the item started. Step reviews do not see the seams between steps.

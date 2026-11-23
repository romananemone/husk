## Review

Reviewer: **opus** (change here and in `.claude/agents/reviewer.md`; medium effort when the tool allows). A
fresh subagent per round, never the one that wrote the code. Its instructions are `review/REVIEWER.md`; the
sheet is the only channel. Without subagents (a plain CLI): a separate headless session with the same brief.

**While a work item is open, the code tree is the item's.** Whatever differs from the `Review base` belongs to
the chunk and is reviewed, whoever wrote it: the implementer, a formatter, the owner. What was in the tree
before the base is not in the diff. A pull, merge, rebase or branch switch in `repo/` belongs between chunks;
inside one it lands in the diff and is reviewed with it.

**Snapshot** = a commit of the code tree as it is now, untracked files included; the index and the working
tree stay untouched. `node review/snapshot.mjs` prints its sha; `node review/snapshot.mjs <item-id> <label>`
also pins it against garbage collection, which every sha written into the sheet needs (`<item-id>` = the
sheet's `<id>`). No sha printed = it failed, stop. A diff is always snapshot to snapshot:
`git -C repo diff <base> <snapshot of now>`.

- `Review base` (sheet header, written `<sha> (S1-S2)`) = snapshot the orchestrator takes **before the chunk's
  first edit**, label = the chunk ids. The ids are fixed then: steps added later form the next chunk. Not
  retaken when the header already names this chunk (a resumed session). Missed: the previous chunk's last
  `at:`, else the commit before the chunk's first change.
- `at:` (on every round line) = the snapshot the reviewer took and reviewed, label `<chunk>-r<N>`. A closure
  round diffs from the `at:` of the full round before it, so nothing written in between escapes review.
- **A chunk passes on the tree its `PASS` round saw.** Before the tick, and again when the next `Review base`
  is taken, `git -C repo diff --stat <that at:> <snapshot of now>` should print nothing. If it prints
  something, the orchestrator reads it and decides: a file a tool rewrote → restore it; formatting, a comment
  or a pull → one line in `## Findings`; behaviour → `(changed)` before the tick; after the tick, the next chunk's `Review base` is
  that `at:` instead of a fresh snapshot, so the difference is reviewed with it.

**When:** a chunk (one step, or the steps named for a batch) is implemented, its gates are green, and every
step's check is recorded reproducibly (command + result, or an artifact file). A step whose artifact is
`pending (<who>)` waits for that person before review. Only chunks that change files git tracks in `repo/` are
reviewed, docs included; any other step closes on its recorded check alone.

**Brief = three things, nothing else:** the path of `review/REVIEWER.md`, the path of the sheet, the step ids
written exactly as the header writes them (`S1-S2`, ASCII hyphen, not `S1, S2`). No retelling of the change, no
opinion, no summary from the implementer. Before briefing, the orchestrator writes the `Next:` line.
While the reviewer runs, nobody edits the code: it reads the tree, not only the diff.

### Severity

Severity = class of consequence. Frequency of the input never lowers a high; it only moves med ↔ low.
In doubt between two tiers, take the higher. Every finding carries a `scenario`: a concrete input → a wrong
outcome. A finding without a scenario is low, unless its consequence is high-class: then it is a `Q` to the
owner, and the reviewer writes what blocked the scenario (no DB, no runtime).

| Tier | What |
|---|---|
| **high** | data lost or corrupted · a wrong result reaches the user · crash or unhandled path · auth, injection, secret exposure · a recorded decision (sheet, `docs/`) is broken · the step's acceptance check is not met |
| **med** | wrong behaviour on a rare but real input with moderate consequence · a missing error path that degrades without crashing · a test that does not assert what it claims, or the step's named check has neither a test nor an artifact · a `repo/` rule broken without a recorded reason · a performance regression a user would notice · a justification comment in the diff (`temporary`, `workaround`, `for now`, `TODO`): the justification belongs in the sheet as a `Q-NN`, the code gets the real fix |
| **low** | naming, duplication, style, micro-performance, comments and docs · "might", "could", "consider" |
| not a finding | outside the diff and the step, or there before the diff and untouched → `X-NN` · needs an owner decision → `Q-NN` |

### Verdict of a full round

| Findings | Verdict | Then |
|---|---|---|
| none | `PASS` | chunk passed |
| 0 high, ≤ 1 med, ≤ 2 low | `PASS_AFTER_FIXES` | fix all, run the gates, closure round |
| above that | `CONTINUE` | fix all, run the gates, next full round |
| the third or a later full round of this chunk (closures not counted) would be `CONTINUE` | `STOP_OWNER` | stop the chunk, report; the owner's word, or `(approach)` once |

A **closure round** is `PASS` or `CONTINUE`: `PASS` when every finding is closed and nothing new appeared,
else `CONTINUE` → fix, then the next full round (`STOP_OWNER` instead when three full rounds of this chunk
already ran). Rounds are numbered per chunk; `R-NN`, `Q-NN`, `X-NN` numbers run through the whole sheet.

The reviewer writes the verdict. The orchestrator may append `→ <verdict> (<why>)` to a round line, and **the
last verdict on the line is the one that counts**:
- `(table)`: the reviewer's verdict of a full round does not match the table. The table wins.
- `(owner)`: the owner's word after a `STOP_OWNER`: `PASS` (the open `R-NN` become `skipped`) or `CONTINUE`.
- `(approach)`: `CONTINUE` on a `STOP_OWNER`, once per chunk, only when every finding still open is an
  engineering matter the orchestrator may decide (`Who decides` in the `workflow` block; without it there is
  none). The same place is not sent to be fixed again: the orchestrator changes the approach (drops or
  simplifies the disputed part), records it in `## Decisions`, and the next round is full. A later
  `STOP_OWNER`, a finding that is the owner's, or an open `Q-NN` → the owner. `PASS` with findings open
  stays `(owner)`'s.
- `(changed)`: `CONTINUE` on a `PASS` when the chunk's behaviour changed after it (an answered `Q-NN`, an
  owner's edit), until the tick. The next round is full. Before a closure the change is in its diff anyway.

**Fix loop**, after `PASS_AFTER_FIXES` or `CONTINUE`. The implementer fixes every `R-NN`, reruns the step's check and **replaces the result in the
step line**, sets `open → fixed` with `fix: <file:lines> <what changed>`. A fix that changes what an artifact
shows makes the artifact stale: it is retaken before the next round. A fix of a finding whose scenario can be
run comes with a test that fails without the fix, recorded as `test: <file>` after `fix:`; without it a
reviewer leaves the finding open.

### In the sheet (`## Review`)

```
- round 1 · S1-S2 · full · 2026-01-15 · PASS_AFTER_FIXES · high 0 / med 1 / low 1 · at: 3fa9c1e
  - R-01 med · fixed · repo/src/x.ts:42 · <what is wrong> · scenario: <input → wrong outcome> · fix: x.ts:40-52 <what changed> · test: x.test.ts
  - R-02 low · fixed · repo/src/y.ts:10 · <what is wrong> · scenario: <…> · fix: y.ts:10 <what changed>
  - X-01 · <outside the step> → step S4 | Owner TODO | dropped: <why>
  - gaps: <what the reviewer could not check>
- round 2 · S1-S2 · closure · CONTINUE · at: 7c2e0b4
  - R-01 closed
  - R-02 still open: <why>            ← its status above goes back to `open`
  - R-03 med · open · … · <a fix broke this> · scenario: <…>
- round 3 · S1-S2 · full · 2026-01-16 · PASS · at: 91d04aa
  - R-02 closed
  - R-03 closed
- Q-01 · S1 · answered · asked by reviewer, round 1 of S1-S2 · <question> · answer 2026-01-15: <owner's words>
- STOP_OWNER: Q-02 open                  ← not a round; a reviewer stopped on an open Q
```

- The reviewer writes the round line first with `running` in place of the verdict, and the verdict last. A
  line still `running` = an unfinished round: the orchestrator deletes it with its lines, sets an `R-NN` it
  reopened back to `fixed`, and reruns the round. `Q-NN`, `STOP_OWNER:` and `STOP:` lines stand outside
  rounds; a `STOP:` (no `Review base`, empty diff) is the orchestrator's to resolve, not the owner's.
- A full round first revisits every `R-NN` of this chunk that is not yet `closed` (`closed` / `still open`),
  then looks for new problems. An `R-NN` still open counts as a finding of the round.
- `R-NN` lines are never deleted or reworded. The implementer changes only `open → fixed` and appends `fix: …` (and `test: …`);
  a reviewer sets `fixed → open` on one still open. `skipped` is written by the orchestrator with the owner's
  word and counts as `closed`.
- When a step closes, the orchestrator moves the rounds of its chunk, unchanged, to `review-closed.md` beside
  the sheet. The round lines stay, and one line under `## Review` keeps the numbering:
  `closed rounds: review-closed.md · last: R-14 X-06`. `Q-NN` lines stay in the sheet.
- `gaps` is one line: what could not be checked and why. Not a list of what was checked.
- `Q-NN`: anyone writes `Q-NN · <step ids or none> · open · asked by <who> · <question>`. The orchestrator
  relays it to the owner word for word in chat, writes the answer on the same line (`answered`, date, the
  owner's words) and in `## Decisions` (with the `workflow` block, a `Q` it may decide itself is answered by
  it: `Who decides`). An open `Q` of this chunk's steps stops this chunk; any other does
  not.
- `X-NN` are dispatched by the orchestrator when the chunk closes: a new step, an `Owner TODO` line, or
  `dropped: <why>` on the X line. None vanishes.
- Severity belongs to the reviewer. Disagreement with a finding or its tier → a `Q-NN` that only the owner
  answers, not an argument in the sheet.
- Who fixes: whoever implemented; with the `workflow` block the implementer, and the orchestrator only what
  is smaller than a brief.
- A step whose chunk changes code is ticked `[x]` only after that chunk's `PASS` (full or closure) and with no
  `Q-NN` of its steps open.
- At archive the orchestrator drops the item's pins: `node review/snapshot.mjs --drop <item-id>`.

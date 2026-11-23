## Scenarios

Optional; sits after grilling, before the steps are written. Describer: **sonnet** (change here and in
`.claude/agents/describer.md`); instructions `scenarios/DESCRIBER.md`. Run it once per item, at the start, only
when the goal changes behaviour seen from outside (user, operator, API client), data or rights; never for a
one-line fix, refactor, docs, CI or configuration, and never again after fixes. Brief = the path of
`scenarios/DESCRIBER.md` and the sheet path, nothing else.

It writes `## Scenarios` in the sheet and sets `Next:` to `orchestrator: sort scenarios`. Sort it yourself, no
review loop: append to each `U-NN` either `→ S<N>` (it becomes that step's check, recorded and reproduced like
any check) or `→ rejected: <why>`. Each `gap:` is a decision by `Who decides` (`workflow` block; without it
every gap is the owner's): yours, or a `Q-NN` to the owner. Send the owner the list in chat, one line per
scenario with its outcome, in the same message as any `Q-NN` of this phase. No question: do not wait for an
answer; a later objection is an ordinary change of a decision.

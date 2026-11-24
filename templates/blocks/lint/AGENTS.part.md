## Lint: sheet limits checked by a script

`node lint/sheet.mjs [<sheet>...]` (no argument = every sheet under `work/`) reads sheets and prints
`<path>:<line> <rule>: <message>`, then one summary line per sheet; exit 1 when any sheet has a problem. It
checks the sheet limits of the base rules and the sheet's format: header, step and line length, template text
left in ticked steps, duplicate ids, closed or running rounds, `sha: later` in a done sheet, snapshot pins of an
archived item. A `note` is not a problem. The orchestrator runs it before every hand-off and before archiving,
and fixes the output before the brief goes out. It edits nothing.

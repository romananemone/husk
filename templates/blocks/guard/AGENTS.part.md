## Guard

A hook (`guard/guard.mjs`, patterns in `guard/patterns.json`) denies commands that hit more than your own
work (killing processes by name, removing every container) and asks the owner before ones git cannot undo
(`git checkout -- <file>`, `git restore`, `git reset --hard`, `git stash`, `git clean`, a recursive delete
outside this folder). A denial is not worked around with another command: narrow the action (your own PID,
your own file) or ask the owner. A commit or PR text that names such a command goes in from a file
(`git commit -F <file>`, `gh pr create --body-file <file>`).

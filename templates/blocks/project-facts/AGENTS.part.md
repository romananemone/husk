## Project facts

Local facts an agent needs and cannot derive from the code. Fill what applies, delete the rest: this section
is yours, `husk apply` never replaces it.

- **Run locally:** <command or compose file in `repo/`; ports>
- **Database:** <how to connect, which databases, naming quirks such as quoted camelCase columns>
- **Commits:** <owner | agent | owner, deferred to item end> commits code. <who> runs manual end-to-end checks.
- **Read-only by default:** any INSERT / UPDATE / DELETE / DDL, any write to a shared service, only after
  explicit owner approval in the sheet.
- **Accounts and secrets:** <where they live; never in the sheet or in docs>
- **Checks that count as green:** <lint / typecheck / test commands as run in this project>
- **Verification helpers:** <feature map of the UI from the user's point of view, if any; scripted drivers
  for repeated checks (screenshot, page probe), if any>. Reuse them instead of writing a new driver per step.
- **Known traps:** <one line each>

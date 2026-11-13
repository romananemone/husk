## Project facts

Local facts an agent needs and cannot derive from the code. Fill what applies, delete the rest.

- **Run locally:** <command or compose file in `repo/`; ports>
- **Database:** <how to connect, which databases, naming quirks such as quoted camelCase columns>
- **Read-only by default:** any INSERT / UPDATE / DELETE / DDL, any write to a shared service, only after
  explicit owner approval in the sheet.
- **Accounts and secrets:** <where they live; never in the sheet or in docs>
- **Checks that count as green:** <lint / typecheck / test commands as run in this project>
- **Known traps:** <one line each>

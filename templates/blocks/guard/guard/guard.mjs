#!/usr/bin/env node
// Claude Code PreToolUse hook for the shell tools (Bash, PowerShell). Reads the hook JSON from stdin and
// tests tool_input.command against guard/patterns.json: a "deny" match stops the command, an "ask" match
// hands the decision to the owner, no match prints nothing (the normal permission flow runs).
// A patterns file that is missing or broken makes every command ask: the guard never fails silently.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const decide = (permissionDecision, permissionDecisionReason) =>
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }));

function loadRules() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "patterns.json");
  const patterns = JSON.parse(readFileSync(file, "utf8"));
  return ["deny", "ask"].flatMap((kind) =>
    (patterns[kind] ?? []).map((rule, i) => ({ kind, n: i + 1, why: rule.why, regex: new RegExp(rule.pattern, "i") })),
  );
}

const FILE_HINT = "Text that names a guarded command goes in through a file: git commit -F <file>, gh pr create --body-file <file>.";

let command;
try {
  command = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.command;
} catch (error) {
  decide("ask", `guard: hook input unreadable: ${error.message}`);
}

if (typeof command === "string") {
  let rules;
  try {
    rules = loadRules();
  } catch (error) {
    decide("ask", `guard/patterns.json unreadable: ${error.message}`);
  }
  // A path inside the envelope is the agent's own ground even when spelled absolute: C:\x\app, C:/x/app, /c/x/app.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const spellings = [root, root.replaceAll("\\", "/"), root.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).replaceAll("\\", "/")];
  for (const s of spellings) command = command.replace(new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\\\/])`, "gi"), ".");
  const hit = rules?.find((rule) => rule.regex.test(command));
  if (hit) decide(hit.kind, `guard ${hit.kind} rule ${hit.n} (guard/patterns.json): ${hit.why}. ${FILE_HINT}`);
}

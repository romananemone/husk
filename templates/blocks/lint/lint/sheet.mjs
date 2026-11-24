#!/usr/bin/env node
// Checks the format and the size limits of work sheets. Reads only; it never edits a sheet.
//
//   node lint/sheet.mjs [<sheet>...]    a sheet (.md), or an item folder (its SHEET.md); no argument = every
//                                       sheet under work/ of this envelope (not _TEMPLATE.md, not BACKLOG.md)
//
// Output: `<path>:<line> <rule>: <message>` per problem, then one summary line per sheet.
// Exit 1 when any sheet has a problem; notes do not count.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_SHEET_BYTES = 32 * 1024;
const MAX_STEP_CHARS = 600;
const MAX_LINE_CHARS = 1500;
const STATUSES = ["active", "paused", "done"];
const SECTIONS = ["Goal", "Context", "Steps", "Findings", "Decisions", "Owner TODO", "Review", "Scenarios"];

const envelope = join(dirname(fileURLToPath(import.meta.url)), "..");
const slash = (p) => p.replace(/\\/g, "/");
const chars = (s) => Array.from(s).length;
const isPlaceholder = (s) => /<[^>]*>/.test(s);

function discover() {
  const dir = join(envelope, "work");
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "_TEMPLATE.md" && entry.name !== "BACKLOG.md") found.push(join(dir, entry.name));
    if (entry.isDirectory() && existsSync(join(dir, entry.name, "SHEET.md"))) found.push(join(dir, entry.name, "SHEET.md"));
  }
  return found;
}

let missing = 0;
function resolveArg(arg) {
  const file = existsSync(arg) && statSync(arg).isDirectory() ? join(arg, "SHEET.md") : arg;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    console.error(`no such sheet: ${file}`);
    missing++;
    return null;
  }
  return file;
}

// Chunk ids: `S1-S2` is the range S1..S2, `S3` one step; anything else is read as a list of ids.
function chunkSteps(text) {
  const range = /^S(\d+)-S(\d+)$/.exec(text.trim());
  if (range) {
    const ids = [];
    for (let n = Number(range[1]); n <= Number(range[2]); n++) ids.push(`S${n}`);
    return ids;
  }
  return text.match(/S\d+[A-Za-z]*/g) ?? [];
}

// Pins sit under the item id the orchestrator passed to snapshot.mjs: the heading's id or the item's folder name
// (the file's stem for a file sheet). One message per id that still has refs.
function pinProblems(abs, lines) {
  const full = resolve(abs);
  let dir = dirname(full);
  while (basename(dir) !== "archive") {
    const up = dirname(dir);
    if (up === dir) return [];
    dir = up;
  }
  const env = dirname(dir);
  const repo = join(env, "repo");
  if (!existsSync(repo)) return [];
  const heading = lines.find((l) => l.startsWith("# "));
  const headingId = heading && /^# (\S+)/.exec(heading)?.[1];
  const folderId = basename(full) === "SHEET.md" ? basename(dirname(full)) : basename(full).replace(/\.md$/, "");
  const ids = [...new Set([headingId, folderId])].filter((id) => id && !id.startsWith("<"));
  const found = [];
  for (const id of ids) {
    const prefix = `refs/husk/${basename(env).replace(/[^A-Za-z0-9._-]+/g, "_")}/${id}`;
    let refs;
    try {
      refs = execFileSync("git", ["-C", repo, "for-each-ref", "--format=%(refname)", prefix], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
    if (refs.length) found.push(`${refs.length} snapshot pin(s) left under ${prefix}; run: node review/snapshot.mjs --drop ${id}`);
  }
  return found;
}

function check(abs, path) {
  const raw = readFileSync(abs, "utf8");
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const problems = [];
  const add = (line, rule, message, note = false) => problems.push({ line, rule, message, note });

  const bytes = Buffer.byteLength(raw);
  if (bytes > MAX_SHEET_BYTES) add(1, "size", `${(bytes / 1024).toFixed(1)} KB, over the ${MAX_SHEET_BYTES / 1024} KB limit; move closed steps, closed rounds, evidence, replaced decisions beside the sheet`);

  // Pass 1: fences, sections, logical steps.
  let fence = false;
  let section = "";
  let firstSection = lines.length;
  const inFence = [];
  const sectionOf = [];
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) {
      inFence[i] = true;
      fence = !fence;
    } else inFence[i] = fence;
    if (!inFence[i] && /^## /.test(l)) {
      section = l.slice(3).trim();
      firstSection = Math.min(firstSection, i);
    }
    sectionOf[i] = section;
  });

  const steps = [];
  const stepStart = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (inFence[i] || sectionOf[i] !== "Steps" || !/^- \[[ xX]\]/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !inFence[j] && lines[j].trim() !== "" && !/^(- |#{1,6} )/.test(lines[j])) j++;
    const text = lines.slice(i, j).map((l, k) => (k ? l.trim() : l)).join(" ");
    steps.push({ line: i + 1, text, ticked: /^- \[[xX]\]/.test(lines[i]), id: /^- \[.\]\s+(S\d+[A-Za-z]*)/.exec(lines[i])?.[1] });
    stepStart.add(i);
    i = j - 1;
  }

  // header
  const header = lines.slice(0, firstSection);
  const field = (name) => {
    const at = header.findIndex((l) => l.startsWith(`${name}:`));
    return at === -1 ? null : { line: at + 1, value: header[at].slice(name.length + 1).trim() };
  };
  const statusField = field("Status");
  const status = statusField && { line: statusField.line, value: statusField.value.split(/\s+/)[0], text: statusField.value };
  if (!statusField) add(1, "header", "no Status line");
  else if (!STATUSES.includes(status.value) || status.text.includes("|")) add(status.line, "header", `Status is \`${status.text}\`, not one of ${STATUSES.join(" | ")}`);
  for (const name of ["Opened", "Next"]) {
    const f = field(name);
    if (!f || f.value === "") add(f?.line ?? 1, "header", `no ${name} line`);
    else if (isPlaceholder(f.value)) add(f.line, "header", `${name} is still the template placeholder`);
  }

  // step-line
  for (const s of steps) {
    const n = chars(s.text);
    if (n > MAX_STEP_CHARS) add(s.line, "step-line", `step is ${n} characters, over ${MAX_STEP_CHARS}; the rest goes to steps/${s.id ?? "S<N>"}.md`);
  }

  // placeholder
  for (const s of steps) {
    const m = s.ticked && /\b(check|sha|artifact):\s*<[^>]*>/.exec(s.text);
    if (m) add(s.line, "placeholder", `ticked step still has template text after \`${m[1]}:\``);
    else if (s.ticked && s.text.includes("@ <sha>")) add(s.line, "placeholder", "ticked step still has the literal `@ <sha>`");
  }

  // line, x placeholder, ids, rounds, sha-later, section
  const defined = new Map();
  const ticked = new Set(steps.filter((s) => s.ticked && s.id).map((s) => s.id));
  const known = new Set(steps.filter((s) => s.id).map((s) => s.id));
  lines.forEach((l, i) => {
    const line = i + 1;
    if (!stepStart.has(i) && chars(l) > MAX_LINE_CHARS) add(line, "line", `line is ${chars(l)} characters, over ${MAX_LINE_CHARS}`);
    if (inFence[i]) return;

    if (/^\s*- X-\d+\b/.test(l) && /\|\s*Owner TODO\s*\|/.test(l)) add(line, "placeholder", "X line still carries the template's alternatives");

    const def = /^\s*- (R-\d+) (?:high|med|low) ·/.exec(l) ?? /^\s*- ([QX]-\d+) ·/.exec(l);
    if (def) {
      if (defined.has(def[1])) add(line, "id", `${def[1]} is defined again (first at line ${defined.get(def[1])})`);
      else defined.set(def[1], line);
    }

    const round = /^\s*- round \d+ · (.*)$/.exec(l);
    if (round) {
      const fields = round[1].split(" · ").map((f) => f.trim());
      if (fields.some((f) => f === "running")) add(line, "running", "round is still running");
      const ids = chunkSteps(fields[0]);
      if (ids.length && ids.every((id) => known.has(id) && ticked.has(id))) add(line, "closed-rounds", `every step of ${fields[0]} is ticked; move the round to review-closed.md`);
    }

    if (status?.value === "done" && /\bsha: later\b/.test(l)) add(line, "sha-later", "`sha: later` in a done sheet");

    const heading = /^## (.*)$/.exec(l);
    if (heading && !SECTIONS.includes(heading[1].trim())) add(line, "section", `note: section \`${heading[1].trim()}\` is not in the template`, true);
  });

  for (const pin of pinProblems(abs, lines)) add(1, "pins", pin);

  problems.sort((a, b) => a.line - b.line);
  for (const p of problems) console.log(`${path}:${p.line} ${p.rule}: ${p.message}`);
  const real = problems.filter((p) => !p.note);
  const notes = problems.length - real.length;
  const byRule = {};
  for (const p of real) byRule[p.rule] = (byRule[p.rule] ?? 0) + 1;
  const detail = Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(", ");
  const size = `${(bytes / 1024).toFixed(1)} KB, ${lines.length} lines`;
  console.log(
    real.length
      ? `${path}: ${real.length} problem(s) (${detail})${notes ? `, ${notes} note(s)` : ""} · ${size}`
      : `${path}: ok${notes ? `, ${notes} note(s)` : ""} · ${size}`,
  );
  return real.length;
}

const args = process.argv.slice(2);
const targets = (args.length ? args.map(resolveArg).filter(Boolean) : discover()).map((abs) => ({ abs, path: slash(abs) }));
if (!targets.length && !missing) console.log("no sheets found");
let failing = 0;
for (const t of targets) if (check(t.abs, t.path)) failing++;
process.exit(missing ? 2 : failing ? 1 : 0);

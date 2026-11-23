#!/usr/bin/env node
// husk: wraps a code repository in an envelope folder that holds the agent process files
// (AGENTS.md, work/, archive/, docs/) in its own git, while the code keeps its own git in ./repo.
// Templates live in ./templates/<profile>/ and mirror the envelope layout one to one. Optional
// blocks in ./templates/blocks/<name>/ add files the same way plus one section to AGENTS.md,
// kept between <!-- husk:block NAME --> markers.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = "repo";
const MARKER = "husk.json";

const USAGE = `usage:
  husk wrap  <repo-path>                       swap in place: <repo-path> becomes the envelope, code moves to <repo-path>/repo
  husk new   <dir> --clone <url>               fresh clone into <dir>/repo
  husk new   <dir> --worktree <repo> [--branch <name>]   worktree of an existing repo into <dir>/repo
  husk apply  [dir]                            copy template files that are missing, report the ones that differ
  husk add    <block> [dir]                    add a block: its files + its section in AGENTS.md
  husk remove <block> [dir]                    remove a block's section and its unchanged files
  husk blocks                                  list available blocks
options: --profile <name>   templates/<name>, default base
         --init-git         wrap: a folder without .git gets "git init" + an initial commit first
         --no-commit        do not create the initial envelope commit
         --force            apply, add: refresh husk-owned files, the base region and block sections (never your data files)`;

function fail(message) {
  console.error(`husk: ${message}`);
  process.exit(1);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
}

function gitQuiet(cwd, ...args) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

// Commit with whatever identity git resolves for this repo. Without one (no global user.name /
// user.email on purpose, none set locally yet) git refuses; then the commit carries a placeholder
// identity passed for this call only, nothing is written to any config.
const PLACEHOLDER_IDENTITY = ["-c", "user.name=husk", "-c", "user.email=husk@localhost"];
function commit(cwd, message) {
  let hasIdentity = true;
  try {
    gitQuiet(cwd, "config", "user.email");
    gitQuiet(cwd, "config", "user.name");
  } catch {
    hasIdentity = false;
  }
  git(cwd, ...(hasIdentity ? [] : PLACEHOLDER_IDENTITY), "commit", "-q", "-m", message);
  if (!hasIdentity) console.log(`note: no git identity in ${cwd}; committed as husk <husk@localhost>`);
}

function parseArgs(argv) {
  const args = { _: [], profile: undefined, commit: true, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--clone" || a === "--worktree" || a === "--branch" || a === "--profile") args[a.slice(2)] = argv[++i];
    else if (a === "--no-commit") args.commit = false;
    else if (a === "--init-git") args.initGit = true;
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--")) fail(`unknown option ${a}`);
    else args._.push(a);
  }
  return args;
}

const isGitRepo = (dir) => existsSync(join(dir, ".git"));

// A gitlink needs a commit to point at; an empty repository cannot be added to the envelope.
function requireCommit(repo) {
  try {
    gitQuiet(repo, "rev-parse", "--verify", "HEAD");
  } catch {
    fail(`${repo} has no commits yet; commit once, then wrap`);
  }
}
const isEnvelope = (dir) => existsSync(join(dir, MARKER));

// ---- templates --------------------------------------------------------------------------------

function templateDir(profile) {
  const dir = join(HERE, "templates", profile);
  if (!existsSync(dir)) fail(`no template profile ${profile} (${dir})`);
  return dir;
}

function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// Which repo instruction file the envelope CLAUDE.md imports. A repo CLAUDE.md usually imports
// its own AGENTS.md, so importing both would load the same rules twice.
function repoImports(envelope) {
  const repo = join(envelope, REPO_DIR);
  for (const file of ["CLAUDE.md", "AGENTS.md"]) {
    if (existsSync(join(repo, file))) return `@${REPO_DIR}/${file}`;
  }
  return `<!-- ${REPO_DIR}/ has no CLAUDE.md or AGENTS.md; add @${REPO_DIR}/<file> here when it gets one -->`;
}

function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

function templateVars(envelope, profile) {
  return {
    PROJECT: basename(envelope),
    DATE: new Date().toISOString().slice(0, 10),
    REPO_IMPORTS: repoImports(envelope),
    PROFILE: profile,
  };
}

// Files that hold the owner's data once written, and the block section the owner fills in: never forced.
const SEEDS = [join("archive", "INDEX.md"), ".gitignore", ".gitattributes", "CLAUDE.md", join(".claude", "settings.json"), join("guard", "patterns.json")];
const FILL_IN = ["project-facts"];

// Copies every file of `src` into the envelope; existing files are kept unless `force`.
// A block's seed that differs from the template is reported: the file may be the owner's own, and the block
// then does not work until the owner merges it by hand. Base seeds always differ and stay silent.
function copyTemplates(src, envelope, vars, { force, skip = [], block = false }) {
  const written = [];
  const skipped = [];
  for (const rel of listFiles(src)) {
    if (skip.includes(rel)) continue;
    const target = join(envelope, rel);
    const text = render(readFileSync(join(src, rel), "utf8"), vars);
    const seed = SEEDS.includes(rel);
    if (existsSync(target) && (!force || seed)) {
      const differs = (!seed || block) && readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== text;
      skipped.push(differs ? `${rel} (differs; ${seed ? "yours, never replaced" : "--force replaces it"})` : rel);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    written.push(rel);
  }
  return { written, skipped };
}

// AGENTS.md is never rewritten as a whole once it exists: its husk-owned text sits in a
// <!-- husk:base --> region that is refreshed like a block section; everything outside is the user's.
function applyTemplates(envelope, { profile, force }) {
  const src = templateDir(profile);
  const vars = templateVars(envelope, profile);
  const hasAgents = existsSync(join(envelope, "AGENTS.md"));
  const result = copyTemplates(src, envelope, vars, { force, skip: hasAgents ? ["AGENTS.md"] : [] });
  if (!hasAgents) return result;
  const template = render(readFileSync(join(src, "AGENTS.md"), "utf8"), vars);
  const found = findSection(template, BASE);
  if (!found) return result;
  const section = upsertSection(envelope, BASE, template.slice(found.start, found.end), { force });
  return { ...result, base: section };
}

// ---- blocks -----------------------------------------------------------------------------------

const BLOCKS_DIR = join(HERE, "templates", "blocks");
const SECTION_FILE = "AGENTS.part.md";
const ANCHOR = "<!-- husk:blocks -->";
const BASE = "base";

function readMarker(envelope) {
  return JSON.parse(readFileSync(join(envelope, MARKER), "utf8"));
}

function writeMarker(envelope, marker) {
  writeFileSync(join(envelope, MARKER), `${JSON.stringify(marker, null, 2)}\n`);
}

function availableBlocks() {
  return existsSync(BLOCKS_DIR) ? readdirSync(BLOCKS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
}

function blockDir(name) {
  const dir = join(BLOCKS_DIR, name);
  if (!existsSync(dir)) fail(`no block ${name}; available: ${availableBlocks().join(", ") || "none"}`);
  return dir;
}

const openMarker = (name) => (name === BASE ? "<!-- husk:base -->" : `<!-- husk:block ${name} -->`);
const closeMarker = (name) => (name === BASE ? "<!-- /husk:base -->" : `<!-- /husk:block ${name} -->`);

function blockSectionText(name, vars) {
  const file = join(blockDir(name), SECTION_FILE);
  const body = existsSync(file) ? render(readFileSync(file, "utf8"), vars).trim() : "";
  return `${openMarker(name)}\n${body}\n${closeMarker(name)}`;
}

function findSection(text, name) {
  const start = text.indexOf(openMarker(name));
  if (start === -1) return null;
  const endMarker = closeMarker(name);
  const end = text.indexOf(endMarker, start);
  if (end === -1) fail(`AGENTS.md has ${openMarker(name)} without ${endMarker}`);
  return { start, end: end + endMarker.length };
}

// Puts a marked section into AGENTS.md: before the anchor if the file has one, else at the end.
// An existing section is left alone unless `force`; the caller learns whether it matches the template.
// The base region is never inserted when absent: an old file without markers is the user's text.
function upsertSection(envelope, name, section, { force }) {
  const path = join(envelope, "AGENTS.md");
  const text = existsSync(path) ? readFileSync(path, "utf8") : `# ${basename(envelope)} — husk\n`;
  const found = findSection(text, name);
  if (found) {
    const current = text.slice(found.start, found.end);
    if (current === section) return "same";
    if (!force) return "differs";
    writeFileSync(path, text.slice(0, found.start) + section + text.slice(found.end));
    return "updated";
  }
  if (name === BASE) return "unmarked";
  const anchor = text.indexOf(ANCHOR);
  const next =
    anchor === -1
      ? `${text.trimEnd()}\n\n${section}\n`
      : `${text.slice(0, anchor)}${section}\n\n${text.slice(anchor)}`;
  writeFileSync(path, next);
  return "added";
}

function removeSection(envelope, name) {
  const path = join(envelope, "AGENTS.md");
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  const found = findSection(text, name);
  if (!found) return false;
  const before = text.slice(0, found.start).replace(/\n+$/, "\n\n");
  const after = text.slice(found.end).replace(/^\n+/, "\n");
  writeFileSync(path, `${before}${after}`.replace(/\n+$/, "\n"));
  return true;
}

function addBlock(envelope, name, vars, { force }) {
  const files = copyTemplates(blockDir(name), envelope, vars, { force, skip: [SECTION_FILE], block: true });
  const section = upsertSection(envelope, name, blockSectionText(name, vars), { force: force && !FILL_IN.includes(name) });
  return { ...files, section };
}

function reportSection(name, state) {
  const word = { added: "added  ", updated: "updated", same: "kept   ", differs: "differs", unmarked: "skipped" }[state];
  const note = {
    differs: FILL_IN.includes(name) ? " (yours to fill; never replaced)" : " (edited locally; --force replaces it)",
    unmarked: " (no <!-- husk:base --> markers in AGENTS.md; wrap the base text in them to let apply refresh it)",
  }[state] ?? "";
  console.log(`${word} AGENTS.md ${name === BASE ? "base region" : `section [${name}]`}${note}`);
}

function report(name, { written, skipped, section }) {
  for (const f of written) console.log(`wrote   ${f}`);
  for (const f of skipped) console.log(`kept    ${f}`);
  reportSection(name, section);
}

// ---- envelope init ----------------------------------------------------------------------------

function initEnvelope(envelope, args) {
  const repo = join(envelope, REPO_DIR);
  if (!isGitRepo(repo)) fail(`${repo} is not a git repository`);
  requireCommit(repo);
  args.profile ??= "base";

  const { written } = applyTemplates(envelope, args);
  writeMarker(envelope, { husk: 1, profile: args.profile, repo: REPO_DIR, blocks: [], created: new Date().toISOString().slice(0, 10) });

  if (!isGitRepo(envelope)) git(envelope, "init", "-q");

  // The code repo enters the envelope git as a gitlink (submodule entry), not as an ignored path:
  // an ignored repo/ would be invisible to the agent's ripgrep-based search. ignore=all keeps
  // the envelope status silent about changes inside repo/.
  let url;
  try {
    url = gitQuiet(repo, "remote", "get-url", "origin");
  } catch {
    url = `./${REPO_DIR}`;
  }
  git(envelope, "config", "-f", ".gitmodules", `submodule.${REPO_DIR}.path`, REPO_DIR);
  git(envelope, "config", "-f", ".gitmodules", `submodule.${REPO_DIR}.url`, url);
  git(envelope, "config", "-f", ".gitmodules", `submodule.${REPO_DIR}.ignore`, "all");
  git(envelope, "-c", "advice.addEmbeddedRepo=false", "add", "-A");

  if (args.commit) commit(envelope, `husk: init envelope (${args.profile})`);

  console.log(`envelope ready: ${envelope}`);
  console.log(`  code:      ${REPO_DIR}/  (${url})`);
  console.log(`  templates: ${written.length} files from profile ${args.profile}`);
  console.log(`open with:   cd "${envelope}" && claude`);
}

// ---- commands ---------------------------------------------------------------------------------

function cmdWrap(args) {
  if (!args._[0]) fail(USAGE);
  const target = resolve(args._[0]);
  if (!existsSync(target) || !statSync(target).isDirectory()) fail(`${target} is not a directory`);
  if (isEnvelope(target)) fail(`${target} is already an envelope`);
  if (!isGitRepo(target)) {
    if (!args.initGit) fail(`${target} has no .git; add --init-git to create a repository there first, or use "new --clone"`);
    git(target, "init", "-q");
    git(target, "add", "-A");
    commit(target, "initial import");
    console.log(`initialized git in ${target} with one commit`);
  }
  requireCommit(target);
  // Windows and macOS file systems are case-insensitive by default; compare paths accordingly.
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const cwd = fold(resolve(process.cwd()));
  const t = fold(target);
  if (cwd === t || cwd.startsWith(`${t}\\`) || cwd.startsWith(`${t}/`)) {
    fail("run wrap from outside the repository folder; a shell inside it blocks the rename on Windows");
  }
  const tmp = `${target}.husk-tmp`;
  if (existsSync(tmp)) fail(`${tmp} exists; remove it first`);

  // Three renames on one volume: X -> X.tmp, mkdir X, X.tmp -> X/repo. The outer path keeps its
  // name, so editor workspaces and Claude Code's per-path project memory stay attached.
  try {
    renameSync(target, tmp);
  } catch (error) {
    fail(`cannot rename ${target}: ${error.code}. Close editors and terminals that have it open`);
  }
  try {
    mkdirSync(target);
    renameSync(tmp, join(target, REPO_DIR));
  } catch (error) {
    try {
      renameSync(tmp, target);
    } catch {}
    fail(`wrap failed and was rolled back: ${error.message}`);
  }
  initEnvelope(target, args);
}

function cmdNew(args) {
  if (!args._[0]) fail(`new needs the envelope folder as first argument:
  husk new <dir> --clone <url>`);
  const envelope = resolve(args._[0]);
  if (existsSync(envelope) && readdirSync(envelope).length > 0) fail(`${envelope} exists and is not empty`);
  if (!args.clone && !args.worktree) fail("new needs --clone <url> or --worktree <repo-path>");
  mkdirSync(envelope, { recursive: true });
  const repo = join(envelope, REPO_DIR);
  if (args.clone) {
    git(envelope, "clone", "-q", args.clone, REPO_DIR);
  } else {
    const source = resolve(args.worktree);
    if (!isGitRepo(source)) fail(`${source} is not a git repository`);
    const branch = args.branch ?? basename(envelope).replace(/[^A-Za-z0-9._\/-]+/g, "-");
    const exists = git(source, "branch", "--list", branch) !== "";
    git(source, ...(exists ? ["worktree", "add", repo, branch] : ["worktree", "add", "-b", branch, repo]));
  }
  initEnvelope(envelope, args);
}

function envelopeArg(arg) {
  const envelope = resolve(arg ?? process.cwd());
  if (!isEnvelope(envelope)) fail(`${envelope} is not an envelope (no ${MARKER})`);
  return envelope;
}

function cmdApply(args) {
  const envelope = envelopeArg(args._[0]);
  const marker = readMarker(envelope);
  args.profile ??= marker.profile ?? "base";
  const { written, skipped, base } = applyTemplates(envelope, args);
  for (const f of written) console.log(`wrote   ${f}`);
  for (const f of skipped) console.log(`kept    ${f}`);
  if (base) reportSection(BASE, base);
  const vars = templateVars(envelope, args.profile);
  for (const name of marker.blocks ?? []) report(name, addBlock(envelope, name, vars, args));
}

function cmdAdd(args) {
  const name = args._[0] ?? fail("add needs a block name; see: husk blocks");
  const envelope = envelopeArg(args._[1]);
  const marker = readMarker(envelope);
  const vars = { ...templateVars(envelope, marker.profile ?? "base"), BLOCK: name };
  report(name, addBlock(envelope, name, vars, args));
  marker.blocks = [...new Set([...(marker.blocks ?? []), name])];
  writeMarker(envelope, marker);
}

// Removes the section and the block's files that still equal the template; edited files stay.
function cmdRemove(args) {
  const name = args._[0] ?? fail("remove needs a block name");
  const envelope = envelopeArg(args._[1]);
  const marker = readMarker(envelope);
  const vars = { ...templateVars(envelope, marker.profile ?? "base"), BLOCK: name };
  const src = blockDir(name);
  console.log(removeSection(envelope, name) ? `removed AGENTS.md section [${name}]` : `no AGENTS.md section [${name}]`);
  for (const rel of listFiles(src)) {
    if (rel === SECTION_FILE) continue;
    const target = join(envelope, rel);
    if (!existsSync(target)) continue;
    if (readFileSync(target, "utf8").replace(/\r\n/g, "\n") === render(readFileSync(join(src, rel), "utf8"), vars)) {
      rmSync(target);
      console.log(`removed ${rel}`);
      for (let dir = dirname(target); dir !== envelope && readdirSync(dir).length === 0; dir = dirname(dir)) rmSync(dir, { recursive: true });
    } else console.log(`kept    ${rel} (edited locally)`);
  }
  marker.blocks = (marker.blocks ?? []).filter((b) => b !== name);
  writeMarker(envelope, marker);
}

function cmdBlocks() {
  for (const name of availableBlocks()) {
    const section = join(BLOCKS_DIR, name, SECTION_FILE);
    const first = existsSync(section) ? readFileSync(section, "utf8").split("\n").find((l) => l.startsWith("## ")) ?? "" : "";
    console.log(`${name.padEnd(16)} ${first.replace(/^## /, "")}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const command = args._.shift();
try {
  if (command === "wrap") cmdWrap(args);
  else if (command === "new") cmdNew(args);
  else if (command === "apply") cmdApply(args);
  else if (command === "add") cmdAdd(args);
  else if (command === "remove") cmdRemove(args);
  else if (command === "blocks") cmdBlocks();
  else {
    console.log(USAGE);
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  fail(error.status !== undefined ? `git failed: ${error.message.split("\n")[0]}` : error.message);
}

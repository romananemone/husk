#!/usr/bin/env node
// husk: wraps a code repository in an envelope folder that holds the agent process files
// (AGENTS.md, work/, archive/, docs/) in its own git, while the code keeps its own git in ./repo.
// Templates live in ./templates/<profile>/ and mirror the envelope layout one to one.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = "repo";
const MARKER = "husk.json";

const USAGE = `usage:
  husk wrap  <repo-path>                       swap in place: <repo-path> becomes the envelope, code moves to <repo-path>/repo
  husk new   <dir> --clone <url>               fresh clone into <dir>/repo
  husk new   <dir> --worktree <repo> [--branch <name>]   worktree of an existing repo into <dir>/repo
  husk apply [dir]                             copy template files that are missing (--force overwrites)
options: --profile <name>   templates/<name>, default base
         --init-git         wrap: a folder without .git gets "git init" + an initial commit first
         --no-commit        do not create the initial envelope commit`;

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

function applyTemplates(envelope, { profile, force }) {
  const src = templateDir(profile);
  const vars = {
    PROJECT: basename(envelope),
    DATE: new Date().toISOString().slice(0, 10),
    REPO_IMPORTS: repoImports(envelope),
    PROFILE: profile,
  };
  const written = [];
  const skipped = [];
  for (const rel of listFiles(src)) {
    const target = join(envelope, rel);
    if (existsSync(target) && !force) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, render(readFileSync(join(src, rel), "utf8"), vars));
    written.push(rel);
  }
  return { written, skipped };
}

// ---- envelope init ----------------------------------------------------------------------------

function initEnvelope(envelope, args) {
  const repo = join(envelope, REPO_DIR);
  if (!isGitRepo(repo)) fail(`${repo} is not a git repository`);
  requireCommit(repo);
  args.profile ??= "base";

  const { written } = applyTemplates(envelope, args);
  const marker = { husk: 1, profile: args.profile, repo: REPO_DIR, created: new Date().toISOString().slice(0, 10) };
  writeFileSync(join(envelope, MARKER), `${JSON.stringify(marker, null, 2)}\n`);

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

  if (args.commit) git(envelope, "commit", "-q", "-m", `husk: init envelope (${args.profile})`);

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
    git(target, "commit", "-q", "-m", "initial import");
    console.log(`initialized git in ${target} with one commit`);
  }
  requireCommit(target);
  const cwd = resolve(process.cwd());
  if (cwd === target || cwd.startsWith(`${target}\\`) || cwd.startsWith(`${target}/`)) {
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
    const branch = args.branch ?? basename(envelope);
    const exists = git(source, "branch", "--list", branch) !== "";
    git(source, ...(exists ? ["worktree", "add", repo, branch] : ["worktree", "add", "-b", branch, repo]));
  }
  initEnvelope(envelope, args);
}

function cmdApply(args) {
  const envelope = resolve(args._[0] ?? process.cwd());
  if (!isEnvelope(envelope)) fail(`${envelope} is not an envelope (no ${MARKER})`);
  args.profile ??= JSON.parse(readFileSync(join(envelope, MARKER), "utf8")).profile ?? "base";
  const { written, skipped } = applyTemplates(envelope, args);
  for (const f of written) console.log(`wrote   ${f}`);
  for (const f of skipped) console.log(`kept    ${f}`);
  if (written.length === 0) console.log("nothing to add; use --force to overwrite");
}

const args = parseArgs(process.argv.slice(2));
const command = args._.shift();
if (command === "wrap") cmdWrap(args);
else if (command === "new") cmdNew(args);
else if (command === "apply") cmdApply(args);
else {
  console.log(USAGE);
  process.exit(command ? 1 : 0);
}

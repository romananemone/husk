#!/usr/bin/env node
// Snapshot of the code tree in repo/: a commit that holds the tree as it is now, untracked files included.
// It is built in a temporary index, so the real index and the working tree stay untouched.
//
//   node review/snapshot.mjs                      print the sha
//   node review/snapshot.mjs <item-id> <label>    print the sha and pin it against garbage collection
//   node review/snapshot.mjs --drop <item-id>     delete every pin of the item
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envelope = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(envelope, "repo");
const git = (args, env = {}) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", env: { ...process.env, ...env } }).trim();

// Worktrees of one repository share their refs, so the envelope's folder name is part of the pin path.
const pins = (item) => `refs/husk/${basename(envelope).replace(/[^A-Za-z0-9._-]+/g, "_")}/${item}`;

const [first, second] = process.argv.slice(2);
if (!second && first) throw new Error("usage: snapshot.mjs [<item-id> <label> | --drop <item-id>]");

if (first === "--drop") {
  const refs = git(["for-each-ref", "--format=%(refname)", pins(second)]).split("\n").filter(Boolean);
  for (const ref of refs) git(["update-ref", "-d", ref]);
  console.log(`dropped ${refs.length} pin(s) of ${second}`);
} else {
  const gitDir = git(["rev-parse", "--absolute-git-dir"]);
  const index = join(gitDir, `husk-index-${process.pid}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    // Starting from the real index keeps tracked files that match .gitignore, and exec bits on Windows.
    if (existsSync(join(gitDir, "index"))) copyFileSync(join(gitDir, "index"), index);
    else git(["read-tree", "HEAD"], env);
    git(["-c", "core.safecrlf=false", "add", "-A"], env);
    const tree = git(["write-tree"], env);
    const identity = ["-c", "user.name=husk", "-c", "user.email=husk@localhost"];
    const sha = git([...identity, "commit-tree", tree, "-p", "HEAD", "-m", "snapshot"]);
    if (first) git(["update-ref", `${pins(first)}/${second}`, sha]);
    console.log(sha);
  } finally {
    rmSync(index, { force: true });
  }
}

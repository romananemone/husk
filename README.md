# husk

A portable process layer for coding agents, kept outside the code repository.

The code stays in its own git. Around it, husk puts an **envelope**: a folder with the agent's
process files (`AGENTS.md`, `work/`, `archive/`, `docs/`) and its own git. The agent runs in the
envelope and sees both. The code repository never sees the envelope: no process files in its
history, no changes to its `.gitignore`, nothing to hide from teammates.

```
<project>/                 envelope: its own git, your process files
├── CLAUDE.md              @AGENTS.md + @repo/<CLAUDE|AGENTS>.md
├── AGENTS.md              process rules only (work sheets, archive, docs)
├── husk.json              marker: template profile, repo dir
├── work/                  active work sheets
├── archive/               closed sheets, INDEX.md as the entry point
├── docs/                  decisions and research that outlive a work item
└── repo/                  the code: its own git, its own rules, untouched
```

Open it with `cd <project> && claude`. In VS Code the folder shows two repositories in Source Control:
the envelope and `repo/`.

## Install

Requires Node 22+ and git. No dependencies. Tested on Windows 11 (cmd, PowerShell, Git Bash) and
Linux (Ubuntu 24.04); macOS shares the Linux code paths.

Windows (cmd or PowerShell):

```
git clone <url> %USERPROFILE%\husk
cd %USERPROFILE%\husk
npm link
husk
```

macOS / Linux:

```
git clone <url> ~/husk
cd ~/husk && npm link
husk
```

`npm link` puts a `husk` command on PATH (a `.cmd` shim on Windows). It links to the folder, it does
not copy it: after `git pull` in the husk folder the command runs the new code, no relink needed.

Without `npm link`, call the script with node directly; every example below works either way:

```
# Windows
node %USERPROFILE%\husk\husk.mjs wrap "C:\Projects\my-app"

# macOS / Linux
node ~/husk/husk.mjs wrap ~/Projects/my-app
```

Or without cloning at all, from a public GitHub repository:

```
npx github:romananemone/husk wrap "C:\Projects\my-app"
```

Paths: quote a path that contains spaces. Windows accepts both `C:\Projects\app` and `C:/Projects/app`.
`~` expands only in a Unix shell; in cmd use `%USERPROFILE%`, in PowerShell `$HOME`.

Git identity: husk commits with whatever `user.name` / `user.email` git resolves for that folder.
If none is set (no global identity on purpose, none local yet), the init commits are made as
`husk <husk@localhost>` for that call only; nothing is written to any config. Set a local identity
in the envelope afterwards: `git config user.name ... && git config user.email ...`.

## Commands

Three ways to get code into `repo/`. The envelope on top is the same in all three.

### `husk wrap <path>` — wrap a folder that is already on disk

```
# Windows
husk wrap "C:\Projects\my-app"
husk wrap "%USERPROFILE%\Downloads\export" --init-git   # folder without .git: init + first commit, then wrap

# macOS / Linux
husk wrap ~/Projects/my-app
husk wrap ~/Downloads/export --init-git
```

Before: `my-app/` is the code. After: `my-app/` is the envelope, the code is in `my-app/repo/`.
The outer path does not change, so editor workspaces and Claude Code's per-folder memory stay
attached. Nothing is copied: three renames on one volume.

Use it for your own projects. Run it from outside the folder. On Windows close editors and terminals
that sit in that folder first: an open handle blocks the rename. On macOS and Linux an open handle does
not block it, but a shell left inside keeps pointing at the old directory; `cd` out and back in.

### `husk new <dir> --clone <url>` — fresh clone

```
# Windows
husk new "C:\Projects\lib-x" --clone https://github.com/org/lib-x.git

# macOS / Linux
husk new ~/Projects/lib-x --clone git@github.com:org/lib-x.git
```

Creates `<dir>/`, clones the repository into `<dir>/repo/`, builds the envelope. The source is not
touched. Use it for someone else's repository, or to set up a project on another machine: clone the
envelope from your own remote and the code from theirs.

### `husk new <dir> --worktree <repo> [--branch <name>]` — a capsule on a branch

```
# Windows
husk new "C:\Projects\my-app-feat-auth" --worktree "C:\Projects\my-app\repo"
husk new "C:\Projects\my-app-hotfix"    --worktree "C:\Projects\my-app\repo" --branch fix/login

# macOS / Linux
husk new ~/Projects/my-app-feat-auth --worktree ~/Projects/my-app/repo
husk new ~/Projects/my-app-hotfix    --worktree ~/Projects/my-app/repo --branch fix/login
```

Creates `<dir>/`, adds a `git worktree` of the existing repository into `<dir>/repo/` on a new
branch (named after `<dir>`, or `--branch`), builds the envelope. The code history is shared with the
source repository: commits made in the capsule are visible there at once, no push needed. The capsule
has its own `work/`, so two features can run in parallel without mixing their sheets.

Use it when one project needs more than one agent session at a time, or when a large feature deserves
its own clean context. Remove it with `git -C <source-repo> worktree remove <dir>/repo` after merging.

### `husk apply [dir] [--force]` — update an envelope from the templates

```
husk apply                                  # inside an envelope: add template files that are missing
husk apply "C:\Projects\my-app" --force     # Windows: refresh husk-owned files with the template version
husk apply ~/Projects/my-app --force        # macOS / Linux
```

Reads the profile from `husk.json`. Without `--force`, files you edited are kept and reported as `differs`.

### `husk add <block> [dir]` / `husk remove <block> [dir]` / `husk blocks` — optional rule sets

```
husk blocks                  # list: guard, review, workflow, project-facts
husk add review              # inside an envelope
husk add workflow "C:\Projects\my-app"
husk remove workflow
```

A block adds files and one section to `AGENTS.md`, kept between `<!-- husk:block NAME -->` markers and
inserted at the `<!-- husk:blocks -->` anchor (at the end when the file has no anchor). Installed blocks
are listed in `husk.json`, so `husk apply` on another machine restores them.

| Block | What it adds |
|---|---|
| `review` | review loop rules: severity tiers, verdict table, round format in the sheet; `review/REVIEWER.md` for the reviewer subagent; `review/snapshot.mjs`, the one helper script (a commit of the code tree that leaves the index alone); `.claude/agents/reviewer.md` for Claude Code |
| `workflow` | orchestration: grilling → sheet → implementer subagent → verify → fix loop → commit → close step |
| `project-facts` | skeleton for local facts: how to run, database, read-only rule, checks, traps |
| `guard` | Claude Code only: a PreToolUse hook (`guard/guard.mjs`, `.claude/settings.json`) that denies shell commands hitting more than the agent's own work (kill by name, remove every container) and asks the owner before ones git cannot undo (`git checkout -- <file>`, `restore`, `reset --hard`, `stash`, `clean`, recursive delete outside the folder); the rules in `guard/patterns.json` are yours to edit. An envelope that already has its own `.claude/settings.json` keeps it (`add` reports `differs; yours, never replaced`): merge the `hooks` entry by hand |

Text outside the markers is yours. Tune a block's section in place; `husk apply` then reports `differs`
and leaves it, `husk apply --force` replaces it with the template version. `husk remove` deletes the
section and the block's files that still equal the template; edited files stay.

The base rules of `AGENTS.md` live the same way, between `<!-- husk:base -->` and `<!-- /husk:base -->`:
`husk apply` reports when they drift from the template, `--force` refreshes them, and your own sections
outside the markers survive. An envelope created before these markers existed has none; `apply` says so
and skips the region. To let it refresh there, wrap the husk-written text (intro through `## Docs`) in the
two marker lines once by hand.

### Upgrading an older envelope

Commit the envelope first; every step below is then one `git diff` to read.

1. `AGENTS.md` without `<!-- husk:base -->` markers: move your own sections (for example `## Project rules`),
   the block sections and the `<!-- husk:blocks -->` anchor below `## Docs`, then wrap the husk-written text
   (intro through `## Docs`) in `<!-- husk:base -->` … `<!-- /husk:base -->`. Anything left inside the
   markers is replaced in step 3.
2. Note what you tuned inside block sections (model names, limits): `git diff` after step 3 shows it.
3. `husk apply --force`, then `git diff`: put back the tuning from step 2, check that your own sections are
   intact, commit.
4. Active sheets: add the header lines the template has now (`Review base`, `Next:`), then apply the sheet
   rules of `AGENTS.md` to each: closed steps, closed review rounds, raw evidence and replaced decisions
   move to files beside the sheet. Move text, do not rewrite it; the bytes of the sheet plus the new files
   should equal the old sheet plus the pointer lines. Commit per sheet.

Archived sheets stay as they are.

### Options

| Option | Commands | Effect |
|---|---|---|
| `--init-git` | wrap | folder without `.git` gets `git init` + commit `initial import` first |
| `--profile <name>` | wrap, new, apply | use `templates/<name>/`; default `base` |
| `--no-commit` | wrap, new | build the envelope but skip its initial commit |
| `--force` | apply, add | overwrite husk-owned files, the `AGENTS.md` base region and block sections; never `archive/INDEX.md`, `.gitignore`, `.gitattributes`, `CLAUDE.md`, `.claude/settings.json`, `guard/patterns.json`, the `project-facts` section or your own sections of `AGENTS.md` |

### Which one

| Situation | Command |
|---|---|
| my project, already on disk | `wrap` |
| a folder without git (export, download) | `wrap --init-git` |
| someone else's repository, or a new machine | `new --clone` |
| a second parallel session on a project I already wrapped | `new --worktree` |
| a new file appeared in the templates | `apply` |
| the project needs the review loop or the orchestration rules | `add review`, `add workflow` |

## Platform notes

| | Windows | macOS | Linux |
|---|---|---|---|
| rename of a folder with an open handle | blocked; close editors and shells in it first | allowed | allowed |
| case-insensitive file system | yes | yes by default | no |
| `npm link` result | `husk.cmd` shim in npm's global bin | `husk` symlink | `husk` symlink |
| line endings | `.gitattributes` forces LF on `*.mjs`, so the shebang stays valid after a clone | LF | LF |
| exec bit on `husk.mjs` | not used; the shim or `node husk.mjs` | kept by git (`100755`) | kept by git |
| path separators | `\` and `/` both accepted; quote paths with spaces | `/` | `/` |
| WSL | for a repo on the Linux file system run husk inside WSL; for a repo under `C:\` run it from Windows, not through `/mnt/c` | | |

## How the envelope git treats `repo/`

`repo/` is added to the envelope git as a **gitlink** (a submodule entry in `.gitmodules` with
`ignore = all`), not as an ignored path. Three consequences:

- the envelope `git status` is silent about changes inside `repo/`;
- each envelope commit records the code sha it was made against;
- the agent's search still sees the code: ripgrep skips gitignored paths, a gitlink is not ignored.

Never add `repo/` to the envelope `.gitignore`.

## Changing the templates

Templates are plain files in `templates/<profile>/`, same layout as the envelope. Edit the text
there, add or remove files, then `husk apply` in each envelope to pick up new files (`--force` to
overwrite edited ones). Placeholders: `{{PROJECT}}`, `{{DATE}}`, `{{REPO_IMPORTS}}`, `{{PROFILE}}`.
A second profile = a second folder under `templates/`, chosen with `--profile <name>`.

A new block = a folder `templates/blocks/<name>/` with `AGENTS.part.md` (the section, starting with a
`## ` heading) and any files in envelope layout. Nothing else to register.

What belongs where:

- `templates/<profile>/AGENTS.md` — process rules only: sheets, archive, docs, how to run repo commands.
- `repo/AGENTS.md` or `repo/CLAUDE.md` — code rules; they stay in the code repository.

## Facts this layout depends on (Claude Code)

- A bare AGENTS.md is not read when any CLAUDE.md exists in cwd or above; CLAUDE.md with `@AGENTS.md` is required.
- CLAUDE.md in subfolders loads lazily when the agent touches a file there; the envelope imports `repo/CLAUDE.md` (or `repo/AGENTS.md`) eagerly.
- `.claude/settings.json`, hooks and `.mcp.json` load from cwd only: a repo's hooks and MCP servers do not load from the envelope; copy them to the envelope `.claude/` if needed.
- Grep skips gitignored paths: `repo/` must be a gitlink, never a `.gitignore` entry.
- Every repo command runs with cwd = `repo/` (`git -C repo`, `pnpm -C repo`); the template AGENTS.md says so.

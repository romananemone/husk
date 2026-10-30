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

```
git clone <url> ~/husk
cd ~/husk && npm link        # gives the `husk` command
husk                         # prints usage
```

Requires Node 22+ and git. No dependencies.

## Commands

Three ways to get code into `repo/`. The envelope on top is the same in all three.

### `husk wrap <path>` — wrap a folder that is already on disk

```
husk wrap "C:\Projects\my-app"
husk wrap "C:\Downloads\export" --init-git     # folder without .git: init + first commit, then wrap
```

Before: `my-app/` is the code. After: `my-app/` is the envelope, the code is in `my-app/repo/`.
The outer path does not change, so editor workspaces and Claude Code's per-folder memory stay
attached. Nothing is copied: three renames on one volume.

Use it for your own projects. Run it from outside the folder, with editors and terminals in that
folder closed: on Windows an open handle blocks the rename.

### `husk new <dir> --clone <url>` — fresh clone

```
husk new "C:\Projects\lib-x" --clone https://github.com/org/lib-x.git
```

Creates `<dir>/`, clones the repository into `<dir>/repo/`, builds the envelope. The source is not
touched. Use it for someone else's repository, or to set up a project on another machine: clone the
envelope from your own remote and the code from theirs.

### `husk new <dir> --worktree <repo> [--branch <name>]` — a capsule on a branch

```
husk new "C:\Projects\my-app-feat-auth" --worktree "C:\Projects\my-app\repo"
husk new "C:\Projects\my-app-hotfix"    --worktree "C:\Projects\my-app\repo" --branch fix/login
```

Creates `<dir>/`, adds a `git worktree` of the existing repository into `<dir>/repo/` on a new
branch (named after `<dir>`, or `--branch`), builds the envelope. The code history is shared with the
source repository: commits made in the capsule are visible there at once, no push needed. The capsule
has its own `work/`, so two features can run in parallel without mixing their sheets.

Use it when one project needs more than one agent session at a time, or when a large feature deserves
its own clean context. Remove it with `git -C <source-repo> worktree remove <dir>/repo` after merging.

### `husk apply [dir] [--force]` — update an envelope from the templates

```
husk apply                   # in an envelope: add template files that are missing
husk apply "C:\Projects\my-app" --force     # overwrite existing files with the template version
```

Reads the profile from `husk.json`. Without `--force`, files you edited are kept.

### Options

| Option | Commands | Effect |
|---|---|---|
| `--init-git` | wrap | folder without `.git` gets `git init` + commit `initial import` first |
| `--profile <name>` | wrap, new, apply | use `templates/<name>/`; default `base` |
| `--no-commit` | wrap, new | build the envelope but skip its initial commit |
| `--force` | apply | overwrite existing files |

### Which one

| Situation | Command |
|---|---|
| my project, already on disk | `wrap` |
| a folder without git (export, download) | `wrap --init-git` |
| someone else's repository, or a new machine | `new --clone` |
| a second parallel session on a project I already wrapped | `new --worktree` |
| a new file appeared in the templates | `apply` |

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

What belongs where:

- `templates/<profile>/AGENTS.md` — process rules only: sheets, archive, docs, how to run repo commands.
- `repo/AGENTS.md` or `repo/CLAUDE.md` — code rules; they stay in the code repository.

## Facts this layout depends on (Claude Code)

- A bare AGENTS.md is not read when any CLAUDE.md exists in cwd or above; CLAUDE.md with `@AGENTS.md` is required.
- CLAUDE.md in subfolders loads lazily when the agent touches a file there; the envelope imports `repo/CLAUDE.md` (or `repo/AGENTS.md`) eagerly.
- `.claude/settings.json`, hooks and `.mcp.json` load from cwd only: a repo's hooks and MCP servers do not load from the envelope; copy them to the envelope `.claude/` if needed.
- Grep skips gitignored paths: `repo/` must be a gitlink, never a `.gitignore` entry.
- Every repo command runs with cwd = `repo/` (`git -C repo`, `pnpm -C repo`); the template AGENTS.md says so.

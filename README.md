# husk

Wraps a code repository in an envelope folder: the agent process files (AGENTS.md, work/, archive/,
docs/) live in the envelope with their own git; the code keeps its own git in `./repo`.

```
<project>/            envelope git
├── CLAUDE.md         @AGENTS.md + @repo/<CLAUDE|AGENTS>.md
├── AGENTS.md         process rules only
├── husk.json         marker: profile, repo dir
├── work/  archive/  docs/
└── repo/             the code, gitlink with ignore=all
```

## Commands

```
husk wrap  <repo-path>                      # existing folder: swap in place, path stays the same
husk new   <dir> --clone <url>              # fresh clone
husk new   <dir> --worktree <repo> [--branch b]   # capsule on a worktree of an existing repo
husk apply [dir] [--force]                  # add new template files to an existing envelope
```

Run `wrap` from outside the target folder with editors and terminals in it closed: on Windows an
open handle blocks the rename. The three renames happen on one volume, nothing is copied.

## Changing the templates

Templates are plain files in `templates/<profile>/`, same layout as the envelope. Edit the text
there, add or remove files, then `husk apply` in each envelope to pick up new files (`--force` to
overwrite edited ones). Placeholders: `{{PROJECT}}`, `{{DATE}}`, `{{REPO_IMPORTS}}`, `{{PROFILE}}`.
A second profile = a second folder under `templates/`, chosen with `--profile <name>`.

## Facts this layout depends on (Claude Code)

- A bare AGENTS.md is not read when any CLAUDE.md exists in cwd or above; CLAUDE.md with `@AGENTS.md` is required.
- CLAUDE.md in subfolders loads lazily when the agent touches a file there; the envelope imports `repo/CLAUDE.md` eagerly.
- `.claude/settings.json`, hooks and `.mcp.json` load from cwd only: a repo's hooks and MCP servers do not load from the envelope; copy them to the envelope `.claude/` if needed.
- Grep skips gitignored paths: `repo/` must be a gitlink, never a `.gitignore` entry.

## Install

```
git clone <url> ~/husk && cd ~/husk && npm link      # gives the `husk` command
husk wrap <repo-path>
```

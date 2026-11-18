# <id> — <title>

Status: active | done
Opened: <YYYY-MM-DD>
Code branch: <branch in repo/>
Review base: <snapshot sha> (<chunk ids>), taken at the start of the current chunk
Next: <one action and who does it; updated at every handoff>

## Goal

One paragraph: what changes for the user or the system, and how we know it is done.

## Context

Links to docs, prior sheets (`archive/INDEX.md` line), relevant code paths in `repo/`.

## Steps

Chunk ids are written `S1-S2` (ASCII hyphen) and spelled the same way in every brief and round line.

- [ ] S1 — <what> · check: <command → result once done> · sha: <commit, once done>
- [ ] S2 — <what> · check: <manual or visual check> · artifact: <file in this item's folder, once done>
- [ ] S3 — <what, no code change> · by: <owner | orchestrator> · check: <result, in that person's words>

## Findings

Facts discovered during the work, dated. Not a log of actions.

## Decisions

Decisions taken with the owner, dated, with the reason. Answers to `Q-NN` are copied here.

## Owner TODO

Things only the owner can do (prod, secrets, accounts).

## Review

Rounds and findings, in the format of `## Review` in `AGENTS.md`.

---
name: build74-fix branch and repo history
description: State of the DriveL GitHub branches and why to avoid replit-agent for pushing
---

## Rule
Push new commits to **`build74-fix`** (or a fresh branch from `origin/replit-agent`), not to the local `replit-agent` branch directly.

**Why:** The local `replit-agent` branch accumulated gitsafe noise commits (duplicate commit messages, paired commits) that corrupt the git pack. Attempting `git push origin replit-agent` fails with "did not receive expected object" even after the token issue is resolved.

**Current branch state (as of last session):**
- `origin/main` — `f6c68eb` (base, untouched)
- `origin/replit-agent` — `2ecc9e8` feat: 2-step driver-type modal
- `origin/build74-fix` — `19ba2ed` (all fixes: Build-74, 30-min warning, PDF, rounding)

**How to apply:**
- Create clean branches with `git checkout -b <name> origin/replit-agent` then apply changes and push the new branch.
- The PR flow is: `build74-fix → replit-agent → main`.
- Do NOT try to push the local `replit-agent` branch; use the Contents API or a clean branch instead.

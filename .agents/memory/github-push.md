---
name: GitHub push method
description: How to push code to ecikan-prog/DriveL from the Replit workspace
---

## Rule
Use a **classic PAT** (starts with `ghp_`) with `repo` scope. Fine-grained PATs fail with 403 on all write operations even when the read API works (x-oauth-scopes header is absent for fine-grained PATs; present for classic).

**Why:** The Replit GITHUB_TOKEN secret has been set to fine-grained PATs multiple times — GitHub lists fine-grained tokens first in the UI, making them easy to grab by mistake. Classic PATs are under "Tokens (classic)" in Developer settings.

**How to apply:**
- Before pushing, verify the token is classic: `curl -sI -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/user | grep x-oauth-scopes` — if the header appears, it's classic and has write; if absent, it's fine-grained and will fail.
- Push command: `git push https://x-access-token:${GITHUB_TOKEN}@github.com/ecikan-prog/DriveL.git <branch>`
- Collect new token via `requestSecrets({ keys: ["GITHUB_TOKEN"] })` in CodeExecution.

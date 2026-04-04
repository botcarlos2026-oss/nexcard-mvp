---
name: github-access
description: Set up and use GitHub access via CLI for cloning, pulling, and pushing repositories with PAT or deploy key. Use when needing to connect to GitHub repos, add remotes, configure git identity, or push code from this workspace.
---

# GitHub Access via CLI

Use this skill to authenticate and interact with GitHub repos from the CLI using a Personal Access Token (PAT) or SSH deploy key. Preferred: fine-grained PAT with minimal scopes.

## Auth Options
- **HTTPS + PAT (recommended for speed):** export `GITHUB_TOKEN` (fine-grained, repo content read/write for the target repo only). No need to store in files.
- **SSH deploy key:** add private key to `~/.ssh/id_rsa` (or project-specific key) and ensure the public key is added as a deploy key with write access.

## Quick Setup (PAT)
1. Export the token (temporary shell var, avoid writing to disk):
   ```bash
   export GITHUB_TOKEN=<token>
   ```
2. Configure git identity if not set:
   ```bash
   git config --global user.name "Carlos Bot"
   git config --global user.email "bot.carlos.2026@gmail.com"
   ```
3. Add remote (replace URL):
   ```bash
   git remote add origin https://$GITHUB_TOKEN@github.com/botcarlos2026-oss/nexcard-mvp.git
   ```
4. Push:
   ```bash
   git add .
   git commit -m "chore: prepare deploy"
   git push -u origin main
   ```

## Quick Setup (SSH deploy key)
1. Place private key at `~/.ssh/id_rsa_github` with `chmod 600`.
2. Start agent and add key:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_rsa_github
   ```
3. Add remote SSH:
   ```bash
   git remote add origin git@github.com:botcarlos2026-oss/nexcard-mvp.git
   ```
4. Push as usual (`git push origin main`).

## Notes & Safety
- Do **not** commit tokens, env files, or secrets.
- Prefer fine-grained PAT scoped to the specific repo with `Contents: Read/Write` only.
- If remote exists, use `git remote set-url origin ...` instead of add.
- To avoid storing token in history, use `GITHUB_TOKEN` env; avoid pasting in shell history if possible.
- If two-factor is enabled, PAT is required (password auth is not supported).

## Troubleshooting
- `permission denied` (SSH): ensure public key is added to repo deploy keys or account SSH keys.
- `invalid username or password` (HTTPS): token missing scopes or expired.
- `remote origin already exists`: run `git remote set-url origin <url>`.
- `fatal: refusing to merge unrelated histories`: add `--allow-unrelated-histories` on first pull if needed.

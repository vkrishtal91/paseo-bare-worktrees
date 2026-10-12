# Bare Worktrees for Paseo

A [Paseo](https://paseo.sh) plugin for people who manage git worktrees themselves. Each worktree becomes its own
workspace inside the Paseo project you already have, and lives in a folder you choose instead of Paseo's managed
worktree root.

It is built for the bare-repository layout:

```text
my-project/            <- Paseo project root
├── .bare/             <- bare repository
├── develop/           <- worktree  -> workspace "develop"
├── release-1.2/       <- worktree  -> workspace "release-1.2"
└── feature-login/     <- worktree  -> workspace "feature-login"
```

Regular checkouts work too: a `.git` directory at the project root, or a project folder whose child folder is the
main checkout with its worktrees as siblings.

## Features

- **Worktrees screen** (sidebar, or **New worktree workspace…** in the Command Center, ⌘K / Ctrl+K):
  - create a worktree on a new branch from a base ref, or on an existing local or `origin` branch;
  - choose the parent folder per worktree, with the resulting path previewed before creation;
  - list every worktree of the project and **Attach** the ones not yet in Paseo;
  - **Open**, **Detach** (archive the workspace, keep the folder) or **Remove** a worktree.
- **`/worktree <folder> [base-ref]`** in a workspace composer creates a worktree in the current project and opens it.
- Safe removal: refuses worktrees with uncommitted or untracked files, never touches protected branches, deletes the
  branch only with `git branch -d` (unmerged branches are kept), and never uses `--force`.

Paseo does not own these worktrees. Archiving a workspace, manually or through Paseo's auto-archive after merge,
leaves the folder and the branch on disk.

## Requirements

- Paseo daemon and app 0.11.2 or newer, with plugins enabled (**Settings → Plugins**).
- `git` on the daemon host. Fetching uses the daemon user's git credentials and never prompts.

## Install

From GitHub:

```bash
paseo plugin install github:vkrishtal91/paseo-bare-worktrees
```

From a local clone:

```bash
git clone https://github.com/vkrishtal91/paseo-bare-worktrees.git
paseo plugin install "$PWD/paseo-bare-worktrees"
```

Then add the folder that contains `.bare/` (or your checkout) as a Paseo project, and open **Worktrees** in the
sidebar.

## Per-project configuration

Optional `.paseo-worktrees.json` in the project root:

```json
{
  "worktreesDir": ".",
  "base": "origin/develop",
  "protectedBranches": ["main", "master", "develop", "release/*"]
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `worktreesDir` | project root | Parent folder for new worktrees, relative to the project root or absolute. |
| `base` | `origin/HEAD`, then `origin/develop`, `origin/main`, `origin/master` | Base ref for new branches. |
| `protectedBranches` | `main`, `master`, `develop`, `release/*` | Branches whose worktrees and branches Remove never deletes. A trailing `*` matches a prefix. |
| `gitDir` | auto-detected | Git directory to run worktree commands against. |

## Development

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"     # first time
paseo plugin reload bare-worktrees
paseo plugin logs bare-worktrees
```

Layout: `index.server.ts` and `server/` run in the daemon (git and the Paseo SDK), `index.client.tsx` and `client/`
run in the app, and `shared/` holds the RPC contracts used by both.

## License

[MIT](LICENSE)

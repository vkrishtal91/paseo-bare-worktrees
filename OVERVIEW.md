Create, attach and remove git worktrees yourself, with each worktree opened as its own Paseo workspace inside the project you already have. It is built for bare-repository layouts, where a project folder holds `.bare/` and one folder per branch, and for anyone who wants worktrees in a folder they choose rather than in Paseo's managed worktree root.

## How it works

The plugin runs `git worktree` against the project's repository and then registers the new folder as a directory workspace of the same project. Paseo never owns these worktrees: archiving the workspace leaves the folder and the branch on disk.

The repository is detected from the Paseo project root, in this order: `.bare/`, a `.git` directory or `gitdir:` file, then the first child folder that is a regular checkout.

## Using it

- **Worktrees** in the sidebar, or **New worktree workspace…** in the Command Center, opens a screen per project: create a worktree on a new or existing branch, attach worktrees that are not in Paseo yet, open, detach or remove them.
- `/worktree <folder> [base-ref]` in a workspace composer creates a worktree in the current project and opens it.
- Remove refuses worktrees with uncommitted or untracked files and never deletes protected branches. Deleting the branch uses `git branch -d`, so unmerged branches are kept.

## Per-project settings

Optional `.paseo-worktrees.json` in the project root:

```json
{
  "worktreesDir": ".",
  "base": "origin/develop",
  "protectedBranches": ["main", "master", "develop", "release/*"]
}
```

`worktreesDir` is relative to the project root and defaults to it. `base` defaults to `origin/HEAD`, then `origin/develop`, `origin/main`, `origin/master`. `gitDir` overrides repository detection.

Requires git on the daemon host. Fetching uses the daemon user's git credentials and never prompts.

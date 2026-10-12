import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** Name of the optional per-project config file, read from the Paseo project root. */
export const PROJECT_CONFIG_FILE = ".paseo-worktrees.json";

export const ProjectConfigSchema = z.object({
  /** Folder that receives new worktrees. Relative paths resolve against the project root. Default: the project root. */
  worktreesDir: z.string().min(1).optional(),
  /** Base ref for new branches. Default: origin/HEAD, then origin/develop, origin/main, origin/master. */
  base: z.string().min(1).optional(),
  /** Git dir to run worktree commands against. Default: auto-detected (.bare, .git, or a child checkout). */
  gitDir: z.string().min(1).optional(),
  /** Branches that `remove` never deletes. Trailing `*` matches a prefix. */
  protectedBranches: z.array(z.string()).optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const WorktreeSchema = z.object({
  path: z.string(),
  /** Path relative to the project root, or absolute when the worktree lives elsewhere. */
  label: z.string(),
  branch: z.string().nullable(),
  head: z.string().nullable(),
  workspaceId: z.string().nullable(),
});
export type Worktree = z.infer<typeof WorktreeSchema>;

export const ProjectOverviewSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  rootPath: z.string(),
  gitDir: z.string().nullable(),
  bare: z.boolean(),
  worktreesDir: z.string(),
  defaultBase: z.string().nullable(),
  worktrees: z.array(WorktreeSchema),
  error: z.string().nullable(),
});
export type ProjectOverview = z.infer<typeof ProjectOverviewSchema>;

export const overviewRpc = defineRpc({
  name: "worktrees.overview",
  input: z.object({ projectId: z.string().optional() }),
  output: z.object({ projects: z.array(ProjectOverviewSchema) }),
});

export const createRpc = defineRpc({
  name: "worktrees.create",
  input: z.object({
    projectId: z.string(),
    /** Folder name of the new worktree inside the worktrees dir. */
    name: z.string().min(1),
    /** "new" creates `branch` from `base`; "existing" checks out a local or origin branch. */
    mode: z.enum(["new", "existing"]),
    /** Defaults to `name`. */
    branch: z.string().optional(),
    base: z.string().optional(),
    /** Overrides the configured worktrees dir for this worktree only. */
    worktreesDir: z.string().optional(),
    fetch: z.boolean().default(true),
  }),
  output: z.object({ workspaceId: z.string(), path: z.string(), branch: z.string() }),
});

export const attachRpc = defineRpc({
  name: "worktrees.attach",
  input: z.object({ projectId: z.string(), path: z.string() }),
  output: z.object({ workspaceId: z.string() }),
});

export const detachRpc = defineRpc({
  name: "worktrees.detach",
  input: z.object({ workspaceId: z.string() }),
  output: z.object({}),
});

export const removeRpc = defineRpc({
  name: "worktrees.remove",
  input: z.object({ projectId: z.string(), path: z.string(), deleteBranch: z.boolean() }),
  output: z.object({ deletedBranch: z.string().nullable() }),
});

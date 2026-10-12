import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  attachRpc,
  createRpc,
  detachRpc,
  overviewRpc,
  removeRpc,
  type ProjectOverview,
} from "../shared/contracts";
import {
  DEFAULT_PROTECTED_BRANCHES,
  UserError,
  assertValidBranch,
  canonical,
  defaultBase,
  git,
  gitIn,
  isProtectedBranch,
  listWorktrees,
  localBranchExists,
  readProjectConfig,
  remoteBranchExists,
  resolveGitDir,
} from "./git";

type Paseo = PluginHandlerContext["paseo"];

const FOLDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface ProjectRef {
  projectId: string;
  name: string;
  rootPath: string;
}

async function listProjects(paseo: Paseo): Promise<ProjectRef[]> {
  const { projects } = await paseo.projects.list();
  return projects.map((p) => ({ projectId: p.projectId, name: p.projectDisplayName, rootPath: p.projectRootPath }));
}

async function getProject(paseo: Paseo, projectId: string): Promise<ProjectRef> {
  const project = (await listProjects(paseo)).find((p) => p.projectId === projectId);
  if (!project) throw new UserError(`Unknown project ${projectId}`);
  return project;
}

/** Active workspaces keyed by canonical directory. */
async function workspacesByDirectory(paseo: Paseo): Promise<Map<string, string>> {
  const byDir = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const page = await paseo.workspaces.list({ page: { limit: 200, cursor } });
    for (const ws of page.entries) {
      if (ws.workspaceDirectory && !ws.archivingAt) byDir.set(canonical(ws.workspaceDirectory), ws.id);
    }
    cursor = page.pageInfo.hasMore ? (page.pageInfo.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return byDir;
}

function repoFor(project: ProjectRef) {
  const config = readProjectConfig(project.rootPath);
  const repo = resolveGitDir(project.rootPath, config);
  const worktreesDir = path.resolve(project.rootPath, config.worktreesDir ?? ".");
  return { config, repo, worktreesDir };
}

function requireRepo(project: ProjectRef) {
  const ctx = repoFor(project);
  if (!ctx.repo) throw new UserError(`No git repository found under ${project.rootPath}`);
  return { ...ctx, repo: ctx.repo };
}

async function describe(project: ProjectRef, byDir: Map<string, string>): Promise<ProjectOverview> {
  const base: ProjectOverview = {
    projectId: project.projectId,
    name: project.name,
    rootPath: project.rootPath,
    gitDir: null,
    bare: false,
    worktreesDir: project.rootPath,
    defaultBase: null,
    worktrees: [],
    error: null,
  };
  try {
    const { config, repo, worktreesDir } = repoFor(project);
    base.worktreesDir = worktreesDir;
    if (!repo) return { ...base, error: "No git repository found" };
    const root = canonical(project.rootPath);
    const worktrees = (await listWorktrees(repo.gitDir))
      .filter((wt) => !wt.bare && existsSync(wt.path))
      .map((wt) => {
        const real = canonical(wt.path);
        const rel = path.relative(root, real);
        return {
          path: real,
          label: rel && !rel.startsWith("..") ? rel : real,
          branch: wt.branch,
          head: wt.head,
          workspaceId: byDir.get(real) ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      ...base,
      gitDir: repo.gitDir,
      bare: repo.bare,
      defaultBase: await defaultBase(repo.gitDir, config),
      worktrees,
    };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

export async function overview(
  { projectId }: RpcInput<typeof overviewRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof overviewRpc>> {
  const [projects, byDir] = await Promise.all([listProjects(paseo), workspacesByDirectory(paseo)]);
  const selected = projectId ? projects.filter((p) => p.projectId === projectId) : projects;
  return { projects: await Promise.all(selected.map((p) => describe(p, byDir))) };
}

async function attachDirectory(paseo: Paseo, projectId: string, dir: string): Promise<string> {
  const existing = (await workspacesByDirectory(paseo)).get(canonical(dir));
  if (existing) return existing;
  const workspace = await paseo.workspaces.create({
    title: path.basename(dir),
    source: { kind: "directory", path: canonical(dir), projectId },
  });
  return workspace.id;
}

export async function create(
  input: RpcInput<typeof createRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof createRpc>> {
  const project = await getProject(paseo, input.projectId);
  const { config, repo, worktreesDir } = requireRepo(project);
  const name = input.name.trim();
  if (!FOLDER_NAME.test(name)) {
    throw new UserError("Folder name may contain letters, digits, '.', '_' and '-', and must not start with a symbol");
  }
  const parent = input.worktreesDir?.trim() ? path.resolve(project.rootPath, input.worktreesDir.trim()) : worktreesDir;
  const target = path.join(parent, name);
  if (existsSync(target)) throw new UserError(`${target} already exists`);
  const branch = (input.branch?.trim() || name).replace(/^refs\/heads\//, "");
  await assertValidBranch(repo.gitDir, branch);

  if (input.fetch) await git(repo.gitDir, ["fetch", "--quiet", "--prune", "origin"]);

  if (input.mode === "new") {
    if (await localBranchExists(repo.gitDir, branch)) {
      throw new UserError(`Branch ${branch} already exists; use "Existing branch"`);
    }
    const base = input.base?.trim() || (await defaultBase(repo.gitDir, config));
    if (!base) throw new UserError("Cannot determine a base ref; enter one or set `base` in the project config");
    await git(repo.gitDir, ["worktree", "add", "--no-track", "-b", branch, target, base]);
  } else if (await localBranchExists(repo.gitDir, branch)) {
    await git(repo.gitDir, ["worktree", "add", target, branch]);
  } else if (await remoteBranchExists(repo.gitDir, branch)) {
    await git(repo.gitDir, ["worktree", "add", "--track", "-b", branch, target, `origin/${branch}`]);
  } else {
    throw new UserError(`Branch ${branch} not found locally or on origin`);
  }

  const workspaceId = await attachDirectory(paseo, project.projectId, target);
  return { workspaceId, path: target, branch };
}

export async function attach(
  { projectId, path: dir }: RpcInput<typeof attachRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof attachRpc>> {
  await getProject(paseo, projectId);
  if (!existsSync(dir)) throw new UserError(`${dir} does not exist`);
  await gitIn(dir, ["rev-parse", "--is-inside-work-tree"]);
  return { workspaceId: await attachDirectory(paseo, projectId, dir) };
}

export async function detach(
  { workspaceId }: RpcInput<typeof detachRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof detachRpc>> {
  // Archiving a directory-backed workspace leaves a user-created worktree and its branch on disk.
  const result = await paseo.workspaces.archive(workspaceId);
  if (result.error) throw new UserError(result.error);
  return {};
}

export async function remove(
  { projectId, path: dir, deleteBranch }: RpcInput<typeof removeRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof removeRpc>> {
  const project = await getProject(paseo, projectId);
  const { config, repo } = requireRepo(project);
  const real = canonical(dir);
  const worktree = (await listWorktrees(repo.gitDir)).find((wt) => !wt.bare && canonical(wt.path) === real);
  if (!worktree) throw new UserError(`${dir} is not a worktree of ${project.name}`);
  if (real === canonical(project.rootPath)) throw new UserError("Refusing to remove the project root");
  const protectedBranches = config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;
  if (worktree.branch && isProtectedBranch(worktree.branch, protectedBranches)) {
    throw new UserError(`${worktree.branch} is a protected branch; remove its worktree with git directly`);
  }
  if ((await gitIn(real, ["status", "--porcelain"])).trim()) {
    throw new UserError(`${real} has uncommitted or untracked files`);
  }

  // Remove the folder first so a git refusal leaves the workspace attached. No --force.
  await git(repo.gitDir, ["worktree", "remove", real]);
  const workspaceId = (await workspacesByDirectory(paseo)).get(real);
  if (workspaceId) {
    const result = await paseo.workspaces.archive(workspaceId);
    if (result.error) throw new UserError(result.error);
  }

  if (deleteBranch && worktree.branch) {
    // -d, not -D: git refuses to delete a branch that is not merged.
    await git(repo.gitDir, ["branch", "-d", worktree.branch]);
    return { deletedBranch: worktree.branch };
  }
  return { deletedBranch: null };
}

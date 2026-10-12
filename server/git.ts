import { execCommand } from "@getpaseo/plugin/server";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { PROJECT_CONFIG_FILE, ProjectConfigSchema, type ProjectConfig } from "../shared/contracts";

// The daemon may run with a minimal PATH (for example when launched by the desktop app).
const EXTRA_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
const gitEnv = {
  ...process.env,
  PATH: [process.env.PATH ?? "", ...EXTRA_PATH].filter(Boolean).join(path.delimiter),
  GIT_TERMINAL_PROMPT: "0",
};

export const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "develop", "release/*"];

export class UserError extends Error {}

export async function git(gitDir: string, args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execCommand("git", ["--git-dir", gitDir, ...args], {
      env: gitEnv,
      cwd,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new UserError(stderr || (error as Error).message);
  }
}

/** Runs git in a work tree, without forcing a git dir. */
export async function gitIn(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execCommand("git", ["-C", cwd, ...args], { env: gitEnv });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new UserError(stderr || (error as Error).message);
  }
}

export function canonical(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export function readProjectConfig(root: string): ProjectConfig {
  const file = path.join(root, PROJECT_CONFIG_FILE);
  if (!existsSync(file)) return {};
  const parsed = ProjectConfigSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new UserError(`${file}: ${parsed.error.message}`);
  return parsed.data;
}

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/**
 * Finds the repository behind a project root. Supports the bare layout (`root/.bare` or a `.git` file
 * pointing at one), a regular checkout at the root, and a root whose child folder is the main checkout.
 */
export function resolveGitDir(root: string, config: ProjectConfig): { gitDir: string; bare: boolean } | null {
  if (config.gitDir) {
    const gitDir = path.resolve(root, config.gitDir);
    return { gitDir, bare: !gitDir.endsWith(`${path.sep}.git`) };
  }
  if (isDir(path.join(root, ".bare"))) return { gitDir: path.join(root, ".bare"), bare: true };
  const dotGit = path.join(root, ".git");
  if (existsSync(dotGit)) {
    if (isDir(dotGit)) return { gitDir: dotGit, bare: false };
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));
    if (match) {
      const target = path.resolve(root, match[1].trim());
      // A `.git` file at the root of a bare layout points at the bare repo, not a linked worktree.
      return { gitDir: target, bare: !target.includes(`${path.sep}worktrees${path.sep}`) };
    }
  }
  const children = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  for (const name of children) {
    const candidate = path.join(root, name, ".git");
    if (isDir(candidate)) return { gitDir: candidate, bare: false };
  }
  return null;
}

export interface GitWorktree {
  path: string;
  branch: string | null;
  head: string | null;
  bare: boolean;
}

export async function listWorktrees(gitDir: string): Promise<GitWorktree[]> {
  const out = await git(gitDir, ["worktree", "list", "--porcelain"]);
  const result: GitWorktree[] = [];
  for (const block of out.split(/\n\n+/)) {
    const lines = block.split("\n").filter(Boolean);
    const wt = lines.find((l) => l.startsWith("worktree "));
    if (!wt) continue;
    const branch = lines.find((l) => l.startsWith("branch "));
    const head = lines.find((l) => l.startsWith("HEAD "));
    result.push({
      path: wt.slice("worktree ".length),
      branch: branch ? branch.slice("branch ".length).replace(/^refs\/heads\//, "") : null,
      head: head ? head.slice("HEAD ".length, "HEAD ".length + 9) : null,
      bare: lines.includes("bare"),
    });
  }
  return result;
}

async function refExists(gitDir: string, ref: string): Promise<boolean> {
  try {
    await git(gitDir, ["rev-parse", "-q", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export async function localBranchExists(gitDir: string, branch: string): Promise<boolean> {
  return refExists(gitDir, `refs/heads/${branch}`);
}

export async function remoteBranchExists(gitDir: string, branch: string): Promise<boolean> {
  return refExists(gitDir, `refs/remotes/origin/${branch}`);
}

export async function defaultBase(gitDir: string, config: ProjectConfig): Promise<string | null> {
  if (config.base) return config.base;
  try {
    const head = (await git(gitDir, ["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"])).trim();
    if (head) return head;
  } catch {
    // origin/HEAD is often unset in bare clones; fall through to well-known names.
  }
  for (const ref of ["origin/develop", "origin/main", "origin/master"]) {
    if (await refExists(gitDir, ref)) return ref;
  }
  return null;
}

export async function assertValidBranch(gitDir: string, branch: string): Promise<void> {
  try {
    await git(gitDir, ["check-ref-format", "--branch", branch]);
  } catch {
    throw new UserError(`Invalid branch name: ${branch}`);
  }
}

export function isProtectedBranch(branch: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => (p.endsWith("*") ? branch.startsWith(p.slice(0, -1)) : branch === p));
}

import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const worktreeDir = path.join(repoRoot, ".gh-pages-worktree");
const branch = "gh-pages";

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });
  return typeof output === "string" ? output.trim() : "";
}

function tryRun(command, args, options = {}) {
  try {
    return run(command, args, options);
  } catch {
    return "";
  }
}

if (!existsSync(distDir)) {
  throw new Error("dist/ is missing. Run npm run build first.");
}

tryRun("git", ["worktree", "remove", "--force", worktreeDir]);
await rm(worktreeDir, { recursive: true, force: true });

tryRun("git", ["fetch", "origin", branch]);

const remoteBranch = tryRun("git", ["ls-remote", "--heads", "origin", branch]);
if (remoteBranch) {
  run("git", ["worktree", "add", worktreeDir, branch], { stdio: "inherit" });
} else {
  run("git", ["worktree", "add", "--detach", worktreeDir], { stdio: "inherit" });
  run("git", ["switch", "--orphan", branch], { cwd: worktreeDir, stdio: "inherit" });
}

const entries = run("git", ["ls-files"], { cwd: worktreeDir }).split("\n").filter(Boolean);
for (const entry of entries) {
  await rm(path.join(worktreeDir, entry), { recursive: true, force: true });
}

await cp(distDir, worktreeDir, { recursive: true });
await writeFile(path.join(worktreeDir, ".nojekyll"), "");
await mkdir(path.join(worktreeDir, ".github"), { recursive: true });

run("git", ["add", "--all"], { cwd: worktreeDir, stdio: "inherit" });
const status = run("git", ["status", "--short"], { cwd: worktreeDir });
if (!status) {
  console.log("gh-pages is already up to date.");
} else {
  run("git", ["commit", "-m", "Deploy GitHub Pages"], { cwd: worktreeDir, stdio: "inherit" });
}
run("git", ["push", "origin", `${branch}:${branch}`], { cwd: worktreeDir, stdio: "inherit" });

console.log("Published GitHub Pages branch.");

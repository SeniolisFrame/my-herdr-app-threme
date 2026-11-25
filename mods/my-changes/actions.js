// Changes: what the buttons do (stage, discard, commit, remote, stash, branches).
import { exec, readTextFile, writeTextFile, appHome, setShared, agents } from "herdr";
import { READ, git, sendToChat, chatTerminal } from "./common.js";
import { oneHunk, someLines, toCrlf } from "./patch.js";
import { NET, CONFLICTS, ASK_FILE, sides, moveSide } from "./status.js";

export const actionsMethods = {
  // Runs one git job at a time, shows its result, then refreshes.
  // Says whether the job started (one at a time).
  act(label, job, cx, done) {
    if (this.busy || !this.root) return false;
    this.busy = label; this.note = null; this.confirm = null;
    let ok = false;
    cx.spawn(async (cx) => {
      try { this.note = { text: (await job()) ?? null }; ok = true; }
      catch (e) {
        let text = String(e.message ?? e);
        if (/merge|pull|stash pop|cherry|revert/i.test(label)) {
          const unmerged = await this.git([...READ, "diff", "--name-only", "--diff-filter=U"]).catch(() => "");
          if (unmerged.trim()) text = CONFLICTS;
        }
        this.note = { text, error: true };
      }
      finally {
        this.busy = null; done?.(ok); this.refresh(cx);
        if (!/^(Stage|Unstage|Discard|Resolve)/.test(label)) this.loadLog(cx); // these don't change the history
        cx.notify();
      }
    });
    cx.notify();
    return true;
  },

  toggleFile(item, cx) {
    const f = this.files.find((x) => x.path === item.path);
    if (!f) return;
    if (f.conflict) return this.act("Resolve", async () => { await this.git(["add", "--", f.path]); return `${f.path} marked resolved`; }, cx);
    const started = this.act(item.side === "staged" ? "Unstage" : "Stage", async () => {
      if (item.side === "unstaged") await this.git(["add", "-A", "--", f.path]);
      else await this.git(this.hasHead ? ["restore", "--staged", "--", f.path] : ["rm", "--cached", "-q", "--", f.path]);
    }, cx);
    if (started) this.moved([f], item.side);
  },

  stageAll(cx) {
    if (this.act("Stage all", () => this.git(["add", "-A"]), cx)) this.moved(this.files.filter((f) => !f.conflict && sides(f).some((x) => x.side === "unstaged")), "unstaged");
  },

  unstageAll(cx) {
    if (this.act("Unstage all", () => this.git(this.hasHead ? ["reset", "-q"] : ["rm", "-r", "--cached", "-q", "."]), cx)) this.moved(this.files.filter((f) => sides(f).some((x) => x.side === "staged")), "staged");
  },

  // Moves files to the other list now, while git runs.
  moved(files, from) {
    for (const f of files) moveSide(f, from);
    // The shown diff is of the old side: cleared, so no hunk button can apply it to the new one.
    const f = files.find((x) => x.path === this.sel?.path);
    if (f) { this.sel = sides(f).find((x) => x.side !== from) ?? this.sel; this.setLines([], ""); }
  },

  // Stages hunk n of the selected unstaged file (or unstages it from the staged one);
  // with lines chosen in that hunk, only those lines.
  applyHunk(n, cx) {
    const item = this.sel, unstage = item?.side === "staged";
    if (!item) return;
    const lines = this.chosenIn(n), shown = this.raw;
    this.act(unstage ? "Unstage" : "Stage", async () => {
      const patch = await this.patch(item, n, lines, unstage, shown);
      await this.git(["apply", "--cached", "--recount", ...(unstage ? ["-R"] : []), patch]);
      return `${lines.size ? `${lines.size} line${lines.size > 1 ? "s" : ""}` : "Hunk"} ${unstage ? "unstaged" : "staged"}`;
    }, cx);
  },

  // Throws hunk n of the selected unstaged file (or only its chosen lines) out of the file
  // itself; what is staged stays. Asks twice.
  discardHunk(n, cx) {
    const item = this.sel;
    if (item?.side !== "unstaged" || !this.raw) return;
    if (this.confirm?.hunk !== n) { this.confirm = { hunk: n }; cx.notify(); return; }
    const lines = this.chosenIn(n), shown = this.raw;
    this.act("Discard", async () => {
      // The patch with a chosen line's change only, as for unstaging, applied in reverse to the file.
      const crlf = (await readTextFile(`${this.root}/${item.path}`, { on: this.on }))?.includes("\r\n");
      const patch = await this.patch(item, n, lines, true, shown, crlf);
      // autocrlf off: git would otherwise rewrite every line ending of the file.
      await this.git(["-c", "core.autocrlf=false", "apply", "--recount", "-R", patch]);
      return `${lines.size ? `${lines.size} line${lines.size > 1 ? "s" : ""}` : "Hunk"} discarded`;
    }, cx);
  },

  chosenIn(n) { return new Set([...this.chosen].filter((k) => k.startsWith(`${n}:`)).map((k) => Number(k.split(":")[1]))); },

  // Writes hunk n (or its chosen lines) of the item's diff as a patch file; its path.
  async patch(item, n, lines, reverse, shown, crlf) {
    const raw = await this.git(this.diffArgs(item));
    // The diff on screen may be from the last refresh: its hunk and line numbers must still fit.
    if (raw !== shown) throw new Error("The file changed: wait for the refresh and try again");
    let patch = lines.size ? someLines(raw, n, lines, reverse) : oneHunk(raw, n);
    if (!patch) throw new Error("The file changed: wait for the refresh and try again");
    if (crlf) patch = toCrlf(patch);
    const file = `${appHome()}/data/my-changes.patch`;
    await writeTextFile(file, patch, await readTextFile(file));
    return file;
  },

  discard(f, cx) {
    if (this.confirm?.path !== f.path) { this.confirm = { path: f.path }; cx.notify(); return; }
    this.act("Discard", async () => {
      if (f.conflict) throw new Error("Conflicted file: use Ours / Theirs, or edit it");
      if (f.fresh) await this.git(["clean", "-f", "-q", "--", f.path]);
      else if (f.x === "A") { await this.git(["rm", "-q", "--cached", "--", f.path]); await this.git(["clean", "-f", "-q", "--", f.path]); }
      else await this.git(["restore", "--source=HEAD", "--staged", "--worktree", "--", f.path]);
      return `Discarded ${f.path}`;
    }, cx);
  },

  // Throws out every unstaged change (edits and new files); what is staged stays. Asks twice.
  discardAll(cx) {
    if (!this.confirm?.all) { this.confirm = { all: true }; cx.notify(); return; }
    this.act("Discard all", async () => {
      await this.git(["restore", "--worktree", "--ignore-unmerged", "--", "."]);
      await this.git(["clean", "-f", "-d", "-q"]); // untracked only, .gitignore'd files stay
      return "Discarded all unstaged changes";
    }, cx);
  },

  resolve(f, side, cx) {
    this.act("Resolve", async () => {
      await this.git(["checkout", `--${side}`, "--", f.path]);
      await this.git(["add", "--", f.path]);
      return `${f.path}: took ${side}`;
    }, cx);
  },

  // Files opens the file (my-files watches this shared value).
  // Files must show to take the request (a hidden panel doesn't draw); it then takes the whole window.
  openInFiles(path) { this.setFull(false); setShared("my-files.open", { path: `${this.root}/${path}`, n: Date.now() }); },

  commit(cx) {
    const message = this.message.value().trim(), staged = this.files.some((f) => sides(f).some((x) => x.side === "staged"));
    if (this.amend) {
      if (!message) { this.message.focus(); return; }
      return this.act("Amend", async () => { await this.git(["commit", "-q", "--amend", "-m", message]); return "Last commit amended"; },
        cx, (ok) => { if (ok) { this.message.set_value(""); this.hasMessage = false; this.amend = false; } });
    }
    if (!staged && !this.inProgress) { this.note = { text: "Nothing staged: tick files (or Stage all) first", error: true }; cx.notify(); return; }
    if (!message && !this.inProgress) { this.message.focus(); return; }
    // A failed commit (a hook said no) keeps the message to fix and retry.
    const started = this.act("Commit", async () => {
      await this.git(message ? ["commit", "-q", "-m", message] : ["commit", "-q", "--no-edit"]);
      return "Committed";
    }, cx, (ok) => { if (ok) { this.message.set_value(""); this.hasMessage = false; } });
    if (!started) return;
    // The staged files leave the list now; the refresh brings them back if git refused.
    this.files = this.files.filter((f) => f.fresh || f.conflict || f.y !== " ").map((f) => f.fresh || f.conflict ? f : { ...f, x: " " });
    if (this.sel?.side === "staged") { this.sel = null; this.setLines([], ""); }
  },

  // Amend: the next Commit rewrites the last commit (its message is filled in to edit).
  // Not during a merge, cherry-pick or revert: the commit being made there is git's.
  toggleAmend(cx) {
    if (!this.hasHead || this.inProgress) return;
    this.amend = !this.amend;
    if (!this.amend) { this.message.set_value(""); this.hasMessage = false; cx.notify(); return; }
    cx.spawn(async (cx) => {
      const last = await this.git([...READ, "log", "-1", "--format=%B"]).catch(() => "");
      if (this.amend) { this.message.set_value(last.trim()); this.hasMessage = Boolean(last.trim()); }
      cx.notify();
    });
    cx.notify();
  },

  // Undo commit: the last commit's changes go back to staged and its message back in
  // the box. Asks twice; says so when the commit is already pushed.
  undoCommit(cx) {
    if (!this.hasHead || this.inProgress) return;
    if (this.confirm?.undo === undefined) {
      this.confirm = { undo: false };
      cx.spawn(async (cx) => {
        const remote = await this.git([...READ, "branch", "-r", "--contains", "HEAD"]).catch(() => "");
        if (this.confirm?.undo !== undefined) this.confirm = { undo: Boolean(remote.trim()) };
        cx.notify();
      });
      cx.notify();
      return;
    }
    this.act("Undo commit", async () => {
      const last = await this.git([...READ, "log", "-1", "--format=%B"]);
      const parent = await exec("git", ["rev-parse", "--verify", "-q", "HEAD~1"], { cwd: this.root, on: this.on });
      await this.git(parent.code === 0 ? ["reset", "-q", "--soft", "HEAD~1"] : ["update-ref", "-d", "HEAD"]);
      this.message.set_value(last.trim()); this.hasMessage = Boolean(last.trim());
      return "Last commit undone: its changes are staged again";
    }, cx);
  },

  // Asks the chat's agent to write the message into .git/MY_HERDR_COMMIT_MSG. The file is read
  // when that agent finishes a turn (checkAsk), and on each refresh of this repo (a chat that
  // reports no status, a switch away and back).
  askChat(cx) {
    const gitDir = this.gitDir;
    if (!gitDir) return;
    const file = `${gitDir}/${ASK_FILE}`.replace(/\//g, gitDir.includes("\\") ? "\\" : "/");
    cx.spawn(async (cx) => {
      // The text before goes in first: a refresh meanwhile must not take the old message as new.
      // The old message is emptied out of the file (here; on another machine it is remembered
      // instead): the agent may well write the same text again, and that must show too.
      const agent = chatTerminal(), before = await readTextFile(file, { on: this.on }).catch(() => null);
      let last = before;
      if (!this.on && before) last = await writeTextFile(file, "", before).then(() => "", () => before);
      const ask = { file, on: this.on, agent, last };
      this.asks.set(gitDir, ask);
      try {
        await sendToChat(`Write a git commit message for the staged changes (git diff --cached). Save only the message to ${file}, replacing that file. Don't commit.`, cx);
        this.note = { text: "Asked the chat: press Enter there. The message shows up here when it's saved." };
      } catch (e) { this.note = { text: `Not sent: ${e.message ?? e}`, error: true }; cx.notify(); return; }
      cx.notify();
    });
  },

  // From render (agents() is live, so a status change draws again): once an asked agent has
  // been working and stops, its repo's message file is read, whichever repo shows. No timer, no git.
  checkAsk(cx) {
    for (const [gitDir, ask] of this.asks) {
      if (!ask.agent || ask.taking) continue;
      const status = agents().find((a) => a.address === ask.agent)?.status;
      if (status === "working") { ask.working = true; continue; }
      if (!ask.working) continue;
      ask.working = false; ask.taking = true;
      cx.spawn(async (cx) => { await this.takeAskedMessage(gitDir).catch(() => {}); ask.taking = false; cx.notify(); });
    }
  },

  // Says whether a new message came. It goes in the box when the box shows that repo, else it
  // waits in that repo's kept text until the repo shows.
  async takeAskedMessage(gitDir = this.gitDir) {
    const ask = gitDir && this.asks.get(gitDir);
    if (!ask) return false;
    const text = await readTextFile(ask.file, { on: ask.on }).catch(() => null);
    if (!text?.trim() || text === ask.last) return false;
    ask.last = text;
    if (this.boxFor !== gitDir) { this.typed.set(gitDir, text.trim()); return true; }
    this.message.set_value(text.trim()); this.hasMessage = true;
    this.note = { text: "The chat wrote a commit message: check it, then Commit" };
    return true;
  },

  pull(cx) { this.act("Pull", async () => { await this.git(["pull", "--no-edit"], NET); return "Pulled"; }, cx); },

  fetch(cx) { this.act("Fetch", async () => { await this.git(["fetch", "--all", "--prune"], NET); return "Fetched"; }, cx); },

  push(cx) {
    this.act("Push", async () => {
      const upstream = await exec("git", ["rev-parse", "--abbrev-ref", "@{upstream}"], { cwd: this.root, on: this.on });
      await this.git(upstream.code === 0 ? ["push"] : ["push", "-u", "origin", "HEAD"], NET);
      return "Pushed";
    }, cx);
  },

  stash(cx) { this.act("Stash", async () => { await this.git(["stash", "push", "-u"]); return "Stashed"; }, cx); },

  pop(cx) { this.act("Stash pop", async () => { await this.git(["stash", "pop"]); return "Stash applied"; }, cx); },

  abort(cx) {
    const kind = this.inProgress;
    if (kind) this.act(`Abort ${kind}`, async () => { await this.git([kind, "--abort"]); return `${kind} aborted`; }, cx);
  },

  openBranches(cx) {
    if (this.menu) { this.menu = null; cx.notify(); return; }
    this.menu = this.branches ?? { local: [], remote: [] }; // the last list at once, then the current one
    cx.spawn(async (cx) => {
      const refs = async (where) => (await this.git([...READ, "for-each-ref", "--format=%(refname:short)", where]).catch(() => "")).split(/\r?\n/).filter(Boolean);
      const [local, remotes] = await Promise.all([refs("refs/heads"), refs("refs/remotes")]);
      this.branches = { local, remote: remotes.filter((r) => r.includes("/") && !r.endsWith("/HEAD")) };
      if (this.menu) this.menu = this.branches;
      cx.notify();
    });
    cx.notify();
  },

  // isRemote undefined (a command): a local branch of that name wins, else it's a remote one.
  checkout(branch, isRemote, cx) {
    this.menu = null;
    const hasLocal = async (name) => (await exec("git", ["show-ref", "--verify", "-q", `refs/heads/${name}`], { cwd: this.root, on: this.on })).code === 0;
    this.act("Checkout", async () => {
      isRemote ??= !(await hasLocal(branch));
      // origin/x with a local x already (usually behind it): switch to x, then Pull.
      const local = branch.replace(/^[^/]+\//, "");
      if (isRemote && await hasLocal(local)) { await this.git(["switch", local]); return `On ${local}: Pull to bring in ${branch}`; }
      await this.git(isRemote ? ["switch", "--track", branch] : ["switch", branch]);
      return `On ${branch}`;
    }, cx);
  },

  merge(branch, cx) {
    this.menu = null; this.mergeFor = null;
    this.act("Merge", async () => { await this.git(["merge", "--no-edit", branch], NET); return `Merged ${branch}`; }, cx);
  },

  // Creates a branch from HEAD (or from the commit `from`) and switches to it.
  newBranch(cx, input = this.branchName, from) {
    const name = input.value().trim();
    if (!name) { input.focus(); return; }
    this.menu = null;
    this.act("New branch", async () => { await this.git(["switch", "-c", name, ...(from ? [from] : [])]); return `Created ${name}${from ? ` at ${from.slice(0, 7)}` : ""}`; },
      cx, (ok) => { if (ok) { input.set_value(""); this.logName = null; } });
  },

  // Asks first. A branch with commits no other branch has is refused; its button then
  // turns into Force delete, which drops those commits.
  deleteBranch(name, cx) {
    const c = this.confirm;
    if (c?.branch !== name) { this.confirm = { branch: name }; cx.notify(); return; }
    let unmerged = false;
    this.act("Delete branch", async () => {
      try { await this.git(["branch", c.force ? "-D" : "-d", name]); }
      catch (e) {
        if (c.force || !/not fully merged/.test(e.message)) throw e;
        unmerged = true;
        throw new Error(`${name} has commits no other branch has. Force delete drops them.`);
      }
      return `Deleted ${name}`;
    }, cx, () => { if (unmerged) this.confirm = { branch: name, force: true }; });
  },

  cherryPick(hash, cx) { this.act("Cherry-pick", async () => { await this.git(["cherry-pick", hash]); return `Cherry-picked ${hash.slice(0, 7)}`; }, cx); },

  // A merge commit is reverted against its first parent (the branch it was merged into).
  revert(c, cx) {
    this.act("Revert", async () => { await this.git(["revert", "--no-edit", ...(c.parents.length > 1 ? ["-m", "1"] : []), c.hash]); return `Reverted ${c.short}`; }, cx);
  },

  // A lightweight tag on a commit (HEAD when no hash is given).
  newTag(name, hash, cx) {
    name = (name ?? "").trim();
    if (!name) { this.tagName.focus(); return; }
    this.act("Tag", async () => { await this.git(["tag", "--", name, ...(hash ? [hash] : [])]); return `Tagged ${hash ? hash.slice(0, 7) : "HEAD"} ${name}`; },
      cx, (ok) => { if (ok) { this.tagName.set_value(""); this.logName = null; } });
  },

  // Asks first. Deletes the tag here only: one already pushed stays on the remote.
  deleteTag(name, cx) {
    if (!name) return;
    if (this.confirm?.tag !== name) { this.confirm = { tag: name }; cx.notify(); return; }
    this.act("Delete tag", async () => { await this.git(["tag", "-d", "--", name]); return `Deleted tag ${name} (here only)`; }, cx);
  },

  // To the upstream's remote, else origin (Push leaves tags behind).
  pushTag(name, cx) {
    if (!name) return;
    const remote = this.upstream?.split("/")[0] || "origin";
    this.act("Push tag", async () => { await this.git(["push", remote, `refs/tags/${name}`], NET); return `Pushed tag ${name} to ${remote}`; }, cx);
  },

  // Asks first. --mixed: the branch moves to c; the later commits leave it, their changes stay in the files.
  reset(c, cx) {
    if (this.confirm?.reset !== c.hash) { this.confirm = { reset: c.hash }; cx.notify(); return; }
    this.act("Reset", async () => { await this.git(["reset", "-q", "--mixed", c.hash]); return `${this.branch} now at ${c.short}, later changes kept unstaged`; }, cx);
  },
};

#!/usr/bin/env node
// Release guardrails: the local half of the branch and database rules in
// docs/WORKFLOW.md. GitHub rulesets and the branch-guard workflow enforce the
// same rules on the server, where nobody can skip them.
//
// Modes:
//   claude            Claude Code hook (SessionStart / PreToolUse), JSON on stdin
//   pre-commit        husky: no commits on protected or merged branches
//   pre-merge-commit  husky: no merge commits on protected branches
//   pre-push          husky: no pushes to protected or merged branches
//
// Internal failures (no gh, no network) fail open: the server-side checks
// still apply.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(here, 'config.json'), 'utf8'));
const PROTECTED = new Set(config.protectedBranches);
const BRANCH_RE = new RegExp(config.branchPattern);
const PROD_REFS = config.prodProjectRefs ?? [];
const GUARD_PATHS = config.guardPaths ?? [];
const ZERO = /^0+$/;

// ---------- helpers ----------

function run(cmd, args, cwd, timeout = 10000) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const currentBranch = (cwd) => run('git', ['branch', '--show-current'], cwd) ?? '';
const repoRoot = (cwd) => run('git', ['rev-parse', '--show-toplevel'], cwd);
const branchExists = (name, cwd) =>
  run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], cwd) !== null ||
  run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`], cwd) !== null;

const mergedCache = new Map();
/** The merged PR whose head was `branch`, or null. */
function mergedPr(branch, cwd) {
  if (!branch || PROTECTED.has(branch)) return null;
  if (mergedCache.has(branch)) return mergedCache.get(branch);
  const out = run(
    'gh',
    ['pr', 'list', '--head', branch, '--state', 'merged', '--json', 'number,url', '--limit', '1'],
    cwd,
    15000,
  );
  let pr = null;
  try {
    pr = out ? (JSON.parse(out)[0] ?? null) : null;
  } catch {
    pr = null;
  }
  mergedCache.set(branch, pr);
  return pr;
}

const mergedMsg = (branch, pr) =>
  `Branch "${branch}" was already merged in PR #${pr.number} (${pr.url}). ` +
  'Never work on a merged branch again. Run the after-merge skill, then start-task for new work.';

function checkNewBranchName(name, cwd) {
  if (PROTECTED.has(name)) return deny(`"${name}" is a protected branch.`);
  if (!BRANCH_RE.test(name))
    return deny(
      `Branch name "${name}" must match ${config.branchPattern} (e.g. feat/lead-export).`,
    );
  const pr = mergedPr(name, cwd);
  if (pr)
    return deny(
      `Branch name "${name}" was used by merged PR #${pr.number}. Branch names are never reused; pick a new one.`,
    );
  return null;
}

const deny = (reason) => ({ decision: 'deny', reason });
const ask = (reason) => ({ decision: 'ask', reason });

// ---------- shell parsing ----------

/** Split a shell command into simple commands (token arrays). Approximate on purpose. */
function splitSegments(command) {
  const segs = [];
  let cur = [];
  let tok = '';
  let has = false;
  let q = null;
  const pushTok = () => {
    if (has) cur.push(tok);
    tok = '';
    has = false;
  };
  const pushSeg = () => {
    pushTok();
    if (cur.length) segs.push(cur);
    cur = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < command.length) tok += command[++i];
      else tok += c;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      has = true;
    } else if (c === '\\' && i + 1 < command.length) {
      tok += command[++i];
      has = true;
    } else if (c === ' ' || c === '\t') pushTok();
    else if ('\n;|&()`'.includes(c)) pushSeg();
    else {
      tok += c;
      has = true;
    }
  }
  pushSeg();
  return segs.map((s) => s.filter((t) => !/^\d*[<>]/.test(t)));
}

const PREFIX_CMDS = new Set(['sudo', 'env', 'command', 'time', 'nohup', 'exec', 'xargs']);

function checkBash(command, startCwd) {
  // Decided after the stricter checks below, so a deny wins over an ask.
  const prodHit = PROD_REFS.some((ref) => command.includes(ref));
  let cwd = startCwd;
  for (let seg of splitSegments(command)) {
    while (seg.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(seg[0])) {
      if (/^HUSKY=0$/.test(seg[0])) return deny('Disabling git hooks (HUSKY=0) is not allowed.');
      seg = seg.slice(1);
    }
    while (seg.length && PREFIX_CMDS.has(seg[0])) seg = seg.slice(1);
    if (!seg.length) continue;
    const [cmd, ...args] = seg;
    if (cmd === 'cd' && args[0]) {
      cwd = path.resolve(cwd, args[0].replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
      continue;
    }
    let r = null;
    if (cmd === 'git') r = checkGit(args, cwd);
    else if (cmd === 'supabase' || (cmd === 'npx' && args[0] === 'supabase'))
      r = checkSupabase(cmd === 'npx' ? args.slice(1) : args);
    else if (cmd === 'gh') r = checkGh(args);
    if (r) return r;
  }
  if (prodHit)
    return ask(
      'This command references the PRODUCTION Supabase project. Confirm it is read-only and intended.',
    );
  return null;
}

function checkGit(argv, cwdIn) {
  let cwd = cwdIn;
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-C') cwd = path.resolve(cwd, argv[++i] ?? '.');
    else if (a === '-c') {
      if (/core\.hookspath/i.test(argv[++i] ?? ''))
        return deny('Overriding core.hooksPath is not allowed.');
    } else if (a.startsWith('-')) continue;
    else break;
  }
  const sub = argv[i];
  const args = argv.slice(i + 1);
  if (!sub) return null;
  const flags = args.filter((a) => a.startsWith('-'));
  const pos = args.filter((a) => !a.startsWith('-'));
  const has = (...names) =>
    flags.some((f) => names.includes(f) || names.some((n) => f.startsWith(n + '=')));
  const shortHas = (ch) => flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.includes(ch));
  const branch = currentBranch(cwd);
  const onProtected = PROTECTED.has(branch);

  switch (sub) {
    case 'push': {
      if (has('--no-verify')) return deny('git push --no-verify is not allowed.');
      if (has('--mirror', '--all', '--delete') || shortHas('d'))
        return deny('Bulk or delete pushes are not allowed. Push one feature branch at a time.');
      const forced = has('--force') || shortHas('f') || pos.slice(1).some((s) => s.startsWith('+'));
      const lease = has('--force-with-lease', '--force-if-includes');
      const specs = pos.slice(1);
      const targets = specs.length
        ? specs.map((s) => {
            const spec = s.replace(/^\+/, '');
            const [src, dst] = spec.includes(':') ? spec.split(':') : [spec, spec];
            const norm = (r) => (r === 'HEAD' ? branch : r.replace(/^refs\/heads\//, ''));
            return { src: norm(src || ''), dst: norm(dst || '') };
          })
        : [{ src: branch, dst: branch }];
      for (const t of targets) {
        if (!t.dst || PROTECTED.has(t.dst))
          return deny(
            `Pushing to "${t.dst || '(delete)'}" is not allowed. Changes reach ${[...PROTECTED].join('/')} only through a PR (open-pr skill).`,
          );
        if (forced)
          return deny(
            'Force push is not allowed. Use --force-with-lease on your own feature branch if you must.',
          );
        const pr = mergedPr(t.src, cwd) ?? mergedPr(t.dst, cwd);
        if (pr) return deny(mergedMsg(t.src, pr));
      }
      if (lease && onProtected) return deny('Force push is not allowed on protected branches.');
      return null;
    }
    case 'commit': {
      if (has('--no-verify') || shortHas('n'))
        return deny('git commit --no-verify is not allowed.');
      if (onProtected)
        return deny(
          `Do not commit on "${branch}". Run the start-task skill to create a fresh branch from dev.`,
        );
      const pr = mergedPr(branch, cwd);
      if (pr) return deny(mergedMsg(branch, pr));
      return null;
    }
    case 'pull':
      if (onProtected && !has('--ff-only'))
        return deny(`On "${branch}" use "git pull --ff-only" so no local merge commit is created.`);
      return null;
    case 'merge':
      if (onProtected && !has('--ff-only', '--abort'))
        return deny(`Do not merge into "${branch}" locally. Merges happen through PRs on GitHub.`);
      return null;
    case 'rebase':
    case 'cherry-pick':
    case 'revert':
    case 'am':
      if (onProtected && !has('--abort', '--quit'))
        return deny(`Do not rewrite or add commits on "${branch}". Use a feature branch and a PR.`);
      return null;
    case 'checkout':
    case 'switch': {
      const createIdx = args.findIndex((a) =>
        ['-b', '-B', '-c', '-C', '--create', '--force-create'].includes(a),
      );
      if (createIdx >= 0) return checkNewBranchName(args[createIdx + 1] ?? '', cwd);
      if (args.includes('--')) return null;
      const target = pos[0];
      if (target && !PROTECTED.has(target) && branchExists(target, cwd)) {
        const pr = mergedPr(target, cwd);
        if (pr) return deny(mergedMsg(target, pr));
      }
      return null;
    }
    case 'branch': {
      if (has('-D', '-d', '--delete', '-m', '-M', '--move', '-f', '--force') || shortHas('D')) {
        if (pos.some((p) => PROTECTED.has(p)))
          return deny('Protected branches cannot be deleted, moved or forced.');
        return null;
      }
      if (flags.length === 0 && pos.length >= 1) return checkNewBranchName(pos[0], cwd);
      return null;
    }
    case 'worktree': {
      if (pos[0] !== 'add') return null;
      const b = args.findIndex((a) => a === '-b' || a === '-B');
      if (b >= 0) return checkNewBranchName(args[b + 1] ?? '', cwd);
      return null;
    }
    case 'config':
      if (args.some((a) => /core\.hookspath/i.test(a)) && !has('--get', '--list', '-l'))
        return deny('Changing core.hooksPath is not allowed.');
      return null;
    case 'update-ref':
      if (args.some((a) => [...PROTECTED].some((p) => a === `refs/heads/${p}`)))
        return deny('Rewriting protected branch refs is not allowed.');
      return null;
    default:
      return null;
  }
}

function checkSupabase(args) {
  const s = args.join(' ');
  if (/\bdb push\b/.test(s) || /\bmigration (repair|squash)\b/.test(s))
    return deny(
      `"supabase ${s}" changes a hosted database's migration state. Agents may not run it; ask the user (see docs/MIGRATIONS_LOG.md).`,
    );
  if (/\bdb reset\b/.test(s) && /--linked|--db-url/.test(s))
    return deny('Resetting a hosted database is not allowed.');
  return null;
}

function checkGh(args) {
  const [group, action] = args;
  if (group === 'pr' && action === 'merge')
    return ask('Merging a PR is the human release gate. Confirm you want this PR merged now.');
  if (group === 'repo' && (action === 'edit' || action === 'delete' || action === 'rename'))
    return deny(`"gh repo ${action}" is not allowed for agents.`);
  if (group === 'api') {
    const s = args.join(' ');
    const mIdx = args.findIndex((a) => a === '-X' || a === '--method');
    const method =
      mIdx >= 0
        ? (args[mIdx + 1] ?? '').toUpperCase()
        : /\s(-f|-F|--field|--raw-field|--input)\s/.test(` ${s} `)
          ? 'POST'
          : 'GET';
    if (method !== 'GET' && /rulesets|\/protection|\/environments/.test(s))
      return deny('Agents may not change branch protection, rulesets or environments.');
  }
  return null;
}

// ---------- edits ----------

function checkEdit(filePath, cwd) {
  if (!filePath) return null;
  const root = repoRoot(path.dirname(path.resolve(cwd, filePath))) ?? repoRoot(cwd);
  if (!root) return null;
  const rel = path.relative(root, path.resolve(cwd, filePath)).split(path.sep).join('/');
  if (config.migrationsDir && rel.startsWith(config.migrationsDir + '/')) {
    for (const ref of ['origin/dev', 'origin/main']) {
      if (run('git', ['cat-file', '-e', `${ref}:${rel}`], root) !== null)
        return deny(
          `${rel} is already merged into ${ref}. Merged migrations are immutable; write a new migration instead.`,
        );
    }
  }
  if (GUARD_PATHS.some((g) => (g.endsWith('/') ? rel.startsWith(g) : rel === g)))
    return ask(`${rel} is part of the release guardrails. Changing it needs the user's approval.`);
  return null;
}

// ---------- database (Supabase MCP) ----------

const WRITE_SQL =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|comment|copy|vacuum|reindex|cluster|lock|refresh|call|do|security|owner)\b/i;

function isReadOnlySql(sql) {
  const clean = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
  const stmts = clean
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    stmts.length > 0 &&
    stmts.every((x) => /^(select|with|explain|show|table|values)\b/i.test(x)) &&
    !WRITE_SQL.test(clean)
  );
}

function checkMcp(toolName, input, cwd) {
  const op = toolName.split('__').pop();
  const ref = input?.project_id;
  const isProd = ref && PROD_REFS.includes(ref);

  if (op === 'apply_migration' && config.migrationsDir) {
    const root = repoRoot(cwd) ?? cwd;
    const name = input?.name ?? '';
    const dir = path.join(root, config.migrationsDir);
    const file =
      existsSync(dir) &&
      readdirSync(dir).find((f) => f.replace(/^\d+_/, '').replace(/\.sql$/, '') === name);
    if (!file)
      return deny(
        `No file ${config.migrationsDir}/<timestamp>_${name}.sql in the repo. Every migration starts as a committed file.`,
      );
    const log = config.migrationsLog ? path.join(root, config.migrationsLog) : null;
    if (log && (!existsSync(log) || !readFileSync(log, 'utf8').includes(name)))
      return deny(
        `"${name}" has no entry in ${config.migrationsLog}. Read the log, add the entry, then apply.`,
      );
  }
  if (!isProd) return null;
  if (op === 'execute_sql') {
    if (isReadOnlySql(input?.query ?? '')) return null;
    return ask(
      'Write SQL against the PRODUCTION database. Confirm only if the user explicitly asked for it.',
    );
  }
  return ask(
    `"${op}" on the PRODUCTION Supabase project. Confirm only if the user explicitly asked for it.`,
  );
}

// ---------- session start ----------

function sessionContext(cwd) {
  const lines = [
    'Release guardrails are active (docs/WORKFLOW.md):',
    '- Every task starts on a fresh branch cut from an up-to-date dev (start-task skill).',
    '- Never commit on or push to main/dev; changes land only through a PR to dev (open-pr skill).',
    '- After a PR is merged, never touch that branch again: switch to dev and pull (after-merge skill).',
  ];
  if (config.migrationsLog)
    lines.push(
      `- Any database task: read ${config.migrationsLog} and the latest migrations first, check dev and prod are in sync, then plan.`,
    );
  const branch = currentBranch(cwd);
  if (branch) {
    run('git', ['fetch', '--quiet', 'origin'], cwd, 8000);
    if (PROTECTED.has(branch)) {
      const behind = run('git', ['rev-list', '--count', 'HEAD..@{u}'], cwd);
      const ahead = run('git', ['rev-list', '--count', '@{u}..HEAD'], cwd);
      lines.push(`Current branch: ${branch} (protected; read-only).`);
      if (behind && behind !== '0')
        lines.push(
          `WARNING: ${branch} is ${behind} commit(s) behind origin. Run: git pull --ff-only`,
        );
      if (ahead && ahead !== '0')
        lines.push(
          `WARNING: ${branch} has ${ahead} local commit(s) not on origin. Tell the user; do not push them.`,
        );
    } else {
      const pr = mergedPr(branch, cwd);
      lines.push(`Current branch: ${branch}.`);
      if (pr) lines.push(`WARNING: ${mergedMsg(branch, pr)}`);
    }
  }
  return lines.join('\n');
}

// ---------- entry points ----------

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function claudeMode() {
  let input;
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch {
    return;
  }
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (input.hook_event_name === 'SessionStart') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: sessionContext(cwd),
        },
      }),
    );
    return;
  }
  if (input.hook_event_name !== 'PreToolUse') return;
  const t = input.tool_name ?? '';
  const ti = input.tool_input ?? {};
  let r = null;
  if (t === 'Bash') r = checkBash(ti.command ?? '', cwd);
  else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(t))
    r = checkEdit(ti.file_path ?? ti.notebook_path, cwd);
  else if (t.startsWith('mcp__')) r = checkMcp(t, ti, cwd);
  if (!r) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: r.decision,
        permissionDecisionReason: `[guardrails] ${r.reason}`,
      },
    }),
  );
}

function fail(msg) {
  process.stderr.write(`\n✖ guardrails: ${msg}\n  See docs/WORKFLOW.md.\n\n`);
  process.exit(1);
}

function gitMode(mode) {
  const cwd = process.cwd();
  const branch = currentBranch(cwd);
  if (mode === 'pre-commit' || mode === 'pre-merge-commit') {
    if (PROTECTED.has(branch))
      fail(`no commits on "${branch}". Create a branch from dev (start-task).`);
    if (mode === 'pre-commit') {
      const pr = mergedPr(branch, cwd);
      if (pr) fail(mergedMsg(branch, pr));
    }
    return;
  }
  if (mode === 'pre-push') {
    for (const line of readStdin().split('\n').filter(Boolean)) {
      const [localRef, localSha, remoteRef] = line.split(' ');
      const dst = (remoteRef ?? '').replace(/^refs\/heads\//, '');
      if (PROTECTED.has(dst)) fail(`pushing to "${dst}" is not allowed. Open a PR instead.`);
      if (ZERO.test(localSha ?? '')) continue;
      const src = (localRef ?? '').replace(/^refs\/heads\//, '');
      const pr = mergedPr(src, cwd) ?? mergedPr(dst, cwd);
      if (pr) fail(mergedMsg(src, pr));
    }
  }
}

const mode = process.argv[2];
try {
  if (mode === 'claude') claudeMode();
  else if (['pre-commit', 'pre-merge-commit', 'pre-push'].includes(mode)) gitMode(mode);
  else {
    process.stderr.write(`guard.mjs: unknown mode "${mode}"\n`);
    process.exit(2);
  }
} catch (err) {
  if (mode === 'claude') process.stderr.write(`guard.mjs internal error (allowing): ${err}\n`);
  else throw err;
}

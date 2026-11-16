import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Runs the real hook the way Claude Code does: JSON on stdin, decision on stdout.
const GUARD = path.join(__dirname, 'guard.mjs');
const PROD = 'tvfizfkunkcamrphrknc';
const DEV = 'devprojectref000000';
// A cwd outside any git repo, so no git or gh lookups run.
const CWD = mkdtempSync(path.join(tmpdir(), 'guard-test-'));

type Decision = { decision: string; reason: string } | null;

function hook(toolName: string, toolInput: Record<string, unknown>): Decision {
  const out = execFileSync('node', [GUARD, 'claude'], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      cwd: CWD,
      tool_name: toolName,
      tool_input: toolInput,
    }),
    encoding: 'utf8',
  }).trim();
  if (!out) return null;
  const o = JSON.parse(out).hookSpecificOutput;
  return { decision: o.permissionDecision, reason: o.permissionDecisionReason };
}

const executeSql = (projectId: string, query: string) =>
  hook('mcp__plugin_supabase_supabase__execute_sql', { project_id: projectId, query });

const SIDE_EFFECT_SELECTS = [
  'select pg_terminate_backend(pid) from pg_stat_activity',
  "select setval('leads_id_seq', 1)",
  "select nextval('leads_id_seq')",
  "select set_config('role', 'service_role', false)",
  'select * into leads_copy from leads',
  'select lo_import($$/etc/passwd$$)',
  'select lo_unlink(16400)',
  "select public.approve_vehicle('11111111-1111-4111-8111-111111111111')",
  'select private.recalculate_ledger()',
  "with x as (select 1) select pg_cancel_backend(1), dblink_exec('...') from x",
  'explain analyze select private.reset_counters()',
  'SELECT "pg_terminate_backend"(1)',
  "select E'\\'', pg_terminate_backend(1) --'",
];

const AGGREGATE_QUERIES = [
  'select count(*) from leads',
  'select status, count(*) from leads group by status',
  'select min(created_at), max(created_at), avg(price) from vehicles',
  'select count(*) filter (where deleted_at is null) from customers',
  "select count(*) from leads where created_at > now() - interval '30 days'",
];

describe('guard: execute_sql on production', () => {
  it.each(SIDE_EFFECT_SELECTS)('asks for side-effecting SQL: %s', (q) => {
    expect(executeSql(PROD, q)?.decision).toBe('ask');
  });

  it.each(AGGREGATE_QUERIES)('asks even for aggregate SQL: %s', (q) => {
    expect(executeSql(PROD, q)?.decision).toBe('ask');
  });

  it('asks on every Supabase MCP server name', () => {
    expect(
      hook('mcp__647e5136-1c2c-48da-8378-0310f50856d1__execute_sql', {
        project_id: PROD,
        query: 'select 1',
      })?.decision,
    ).toBe('ask');
  });

  it('points to the read-only psql path in the reason', () => {
    expect(executeSql(PROD, 'select 1')?.reason).toContain('PROD_DB_READONLY_URL');
  });
});

describe('guard: execute_sql off production', () => {
  it.each([...SIDE_EFFECT_SELECTS, ...AGGREGATE_QUERIES])('does not block: %s', (q) => {
    expect(executeSql(DEV, q)).toBeNull();
  });
});

describe('guard: db-inspector aggregate queries', () => {
  it.each(AGGREGATE_QUERIES)('allows psql over PROD_DB_READONLY_URL: %s', (q) => {
    expect(hook('Bash', { command: `psql "$PROD_DB_READONLY_URL" -At -c "${q}"` })).toBeNull();
  });

  it('asks when a psql command names the production project directly', () => {
    expect(
      hook('Bash', {
        command: `psql "postgresql://postgres@db.${PROD}.supabase.co:5432/postgres" -c "select 1"`,
      })?.decision,
    ).toBe('ask');
  });
});

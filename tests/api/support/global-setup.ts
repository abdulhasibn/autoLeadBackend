import { randomBytes } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TestProject } from 'vitest/node';

export interface ApiTestContext {
  readonly runId: string;
  readonly password: string;
  readonly showroomId: string;
  readonly admin: { readonly id: string; readonly email: string };
  readonly salesperson: { readonly id: string; readonly email: string };
  /** A second salesperson, used as "another assignee". */
  readonly otherSalesperson: { readonly id: string; readonly email: string };
}

declare module 'vitest' {
  export interface ProvidedContext {
    apiContext: ApiTestContext;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is required to run the API suite`);
  }
  return value;
}

interface Created {
  userIds: string[];
  showroomId: string | null;
  createdShowroom: boolean;
}

async function createStaff(
  db: SupabaseClient,
  roleIds: Map<string, string>,
  created: Created,
  args: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    showroomId: string;
    role: 'admin' | 'salesperson';
    grantedBy: string | null;
  },
): Promise<string> {
  const auth = await db.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name: args.fullName },
  });
  if (auth.error) throw new Error(`create auth user: ${auth.error.message}`);
  const id = auth.data.user.id;
  created.userIds.push(id);

  const user = await db.from('users').insert({
    id,
    full_name: args.fullName,
    phone: args.phone,
    email: args.email,
    showroom_id: args.showroomId,
  });
  if (user.error) throw new Error(`insert users: ${user.error.message}`);

  const roleId = roleIds.get(args.role);
  if (roleId === undefined) throw new Error(`role ${args.role} missing from roles table`);
  const role = await db
    .from('user_roles')
    .insert({ user_id: id, role_id: roleId, granted_by: args.grantedBy ?? id });
  if (role.error) throw new Error(`insert user_roles: ${role.error.message}`);
  return id;
}

/** Removes every row a test run could have left behind for the given users. */
async function cleanup(db: SupabaseClient, created: Created): Promise<void> {
  const failures: string[] = [];
  const step = async (label: string, run: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await run;
    if (error) failures.push(`${label}: ${error.message}`);
  };
  const ids = created.userIds;

  if (ids.length > 0) {
    const leads = await db.from('leads').select('id, contact_id').in('created_by', ids);
    const leadIds = (leads.data ?? []).map((row) => row.id as string);
    const contactIds = (leads.data ?? [])
      .map((row) => row.contact_id as string | null)
      .filter((id): id is string => id !== null);
    if (leadIds.length > 0) {
      await step('follow_ups', db.from('follow_ups').delete().in('lead_id', leadIds));
      await step(
        'lead_status_history',
        db.from('lead_status_history').delete().in('lead_id', leadIds),
      );
      await step('leads', db.from('leads').delete().in('id', leadIds));
    }
    if (contactIds.length > 0) {
      await step('contacts', db.from('contacts').delete().in('id', contactIds));
    }
    await step('contacts(created_by)', db.from('contacts').delete().in('created_by', ids));
    await step('audit_logs', db.from('audit_logs').delete().in('actor_id', ids));
    await step('user_roles', db.from('user_roles').delete().in('user_id', ids));
    await step('users', db.from('users').delete().in('id', ids));
    for (const id of ids) {
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) failures.push(`auth user: ${error.message}`);
    }
  }
  if (created.createdShowroom && created.showroomId !== null) {
    await step('showrooms', db.from('showrooms').delete().eq('id', created.showroomId));
  }
  if (failures.length > 0) {
    throw new Error(`API test cleanup left data behind:\n${failures.join('\n')}`);
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const runId = `apitest-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const password = `Pw-${randomBytes(9).toString('hex')}`;
  const created: Created = { userIds: [], showroomId: null, createdShowroom: false };
  const teardown = async (): Promise<void> => cleanup(db, created);

  try {
    const roles = await db.from('roles').select('id, name');
    if (roles.error) throw new Error(`read roles: ${roles.error.message}`);
    const roleIds = new Map((roles.data ?? []).map((r) => [r.name as string, r.id as string]));

    const existing = await db.from('showrooms').select('id').eq('is_active', true).limit(1);
    if (existing.error) throw new Error(`read showrooms: ${existing.error.message}`);
    let showroomId = existing.data?.[0]?.id as string | undefined;
    if (showroomId === undefined) {
      const made = await db
        .from('showrooms')
        .insert({ name: `${runId} showroom`, city: 'Testville', is_active: true })
        .select('id')
        .single();
      if (made.error) throw new Error(`create showroom: ${made.error.message}`);
      showroomId = made.data.id as string;
      created.createdShowroom = true;
    }
    created.showroomId = showroomId;

    // Unique, E.164-valid phones per run (leading digit 9, 9 random digits).
    const phoneTail = (): string => String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    const mk = (label: string, role: 'admin' | 'salesperson', grantedBy: string | null) =>
      createStaff(db, roleIds, created, {
        email: `${runId}-${label}@example.test`,
        password,
        fullName: `${runId} ${label}`,
        phone: `+919${phoneTail()}`,
        showroomId: showroomId as string,
        role,
        grantedBy,
      });

    const adminId = await mk('admin', 'admin', null);
    const salesId = await mk('sales', 'salesperson', adminId);
    const otherId = await mk('sales2', 'salesperson', adminId);

    project.provide('apiContext', {
      runId,
      password,
      showroomId,
      admin: { id: adminId, email: `${runId}-admin@example.test` },
      salesperson: { id: salesId, email: `${runId}-sales@example.test` },
      otherSalesperson: { id: otherId, email: `${runId}-sales2@example.test` },
    });
  } catch (err) {
    await teardown();
    throw err;
  }

  return teardown;
}

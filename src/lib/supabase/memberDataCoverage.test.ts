/**
 * @vitest-environment node
 *
 * Guard for the G25 member data export. Every table that links to a person must show up in
 * member_space_data, or be listed below with the reason it is not personal data. A new
 * person-linked table fails this test until the export (or this list) is updated.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => ({ file: f, text: readFileSync(join(DIR, f), 'utf8') }));

/** Columns that point at a person. */
const PERSON_COLUMN = /^(profile_id|author_id|actor_id|recipient_id|reporter_id|blocker_id|blocked_id|client_id|member_id|a_id|b_id|resolved_by|created_by)$/;

/** Not exported on purpose. */
const NOT_PERSONAL: Record<string, string> = {
  payment_credentials: 'client_id is the seller PayPal app id, not a person',
};

function personTables(): Set<string> {
  const found = new Set<string>();
  for (const { text } of sql) {
    for (const m of text.matchAll(/create table (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      const lines = m[2].split('\n').map((l) => l.trim());
      const linked = lines.some((l) => PERSON_COLUMN.test(l.split(/\s+/)[0] ?? '') || /references public\.profiles/i.test(l));
      if (linked) found.add(m[1]);
    }
    for (const m of text.matchAll(/alter table (?:public\.)?(\w+)\s+add column\s+(\w+)[^;]*;/gi)) {
      if (PERSON_COLUMN.test(m[2]) || /references public\.profiles/i.test(m[0])) found.add(m[1]);
    }
  }
  return found;
}

function exportBody(): string {
  const latest = sql.filter((f) => /create (or replace )?function public\.member_space_data/i.test(f.text)).at(-1);
  if (!latest) throw new Error('no migration defines member_space_data');
  const start = latest.text.search(/create (or replace )?function public\.member_space_data/i);
  return latest.text.slice(start, latest.text.indexOf('\n$$;', start));
}

describe('member data export covers every person-linked table', () => {
  const body = exportBody();
  const tables = [...personTables()].sort();

  it('finds the person-linked tables', () => {
    expect(tables).toEqual(expect.arrayContaining(['posts', 'moderation_log', 'push_mutes', 'post_approval_members']));
  });

  it.each(tables)('%s is exported or listed as not personal', (table) => {
    const exported = new RegExp(`public\\.${table}\\b`).test(body);
    expect(exported || table in NOT_PERSONAL, `${table} is missing from member_space_data`).toBe(true);
  });

  it.each(Object.keys(NOT_PERSONAL))('%s exemption is still needed', (table) => {
    expect(tables).toContain(table);
    expect(new RegExp(`public\\.${table}\\b`).test(body)).toBe(false);
  });
});

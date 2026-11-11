// Seeds a test space (spaces.is_test, G21) on the linked project so dev can run with DATA_SOURCE=supabase.
// Creates the space, the owner's account (no password yet), a starter program + community, and prints a
// one-time claim link (G4) the owner opens to sign in and set a password. Refuses if the slug exists.
//
//   node --env-file=.env.local scripts/seed-test-space.ts <owner-email>
//
// Plain Node (type stripping), so only relative imports without the @/ alias.
import { createClient } from '@supabase/supabase-js';
import { newClaimToken } from '../src/lib/auth/claimToken.ts';

const SPACE = { slug: 'fiddle', name: 'Old-Time Fiddle' };
const OWNER_NAME = 'Teacher';
const DEV_PORT = 3000;

type Step = { title: string; text: string };
type Module = { title: string; description: string; steps: Step[] };

const PROGRAM = {
  slug: 'old-time-fiddle',
  title: 'Old-Time Fiddle: First Tunes',
  subtitle: 'From holding the bow to playing Soldier’s Joy at a jam.',
};

const MODULES: Module[] = [
  {
    title: 'Getting started',
    description: 'Set up the fiddle and get a clean sound before any tunes.',
    steps: [
      { title: 'Holding the fiddle and bow', text: 'Old-time players often hold the fiddle low on the chest or arm. Try both, keep the left wrist loose, and hold the bow a little up the stick if that feels freer.' },
      { title: 'Tuning to GDAE', text: 'Tune the A string to a reference first, then tune D, G and E to it in fifths. Listen for the beat between two strings to disappear.' },
      { title: 'Long bows on open strings', text: 'Play slow whole bows on each open string. Aim for an even tone from frog to tip. Then rock between two strings to get a steady drone.' },
    ],
  },
  {
    title: 'First tune: Soldier’s Joy',
    description: 'Learn a jam standard by ear, one phrase at a time.',
    steps: [
      { title: 'The A part by ear', text: 'Listen to the A part a few times, sing it, then find it on the D and A strings. Learn one phrase at a time and loop it.' },
      { title: 'The B part', text: 'The B part climbs higher on the A and E strings. Same method: sing it, then find it, then join it to the A part.' },
      { title: 'Shuffle bowing', text: 'Add the Nashville shuffle: one long note slurred into two short ones. It gives the tune its pulse for dancers.' },
    ],
  },
  {
    title: 'Old-time bowing',
    description: 'The rhythm comes from the right hand.',
    steps: [
      { title: 'Saw strokes and rocking the bow', text: 'Practise single short strokes with a little accent, then rock between strings so the drone string rings under the melody.' },
      { title: 'Double stops and drones', text: 'Let a neighbouring open string ring with the melody note. In A, the open A and E strings make the classic old-time ring.' },
    ],
  },
];

const COMMUNITY = { slug: 'front-porch', title: 'Front Porch', channels: ['General', 'Tune of the week'] };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file=.env.local)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Db = ReturnType<typeof client>;

async function one<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('query returned no data');
  return data as NonNullable<T>;
}

async function ownerProfileId(db: Db, email: string): Promise<string> {
  const existing = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id as string;
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  return created.data.user.id;
}

async function seedProgram(db: Db, spaceId: string, communityId: string): Promise<void> {
  const program = await one(
    db
      .from('products')
      .insert({ space_id: spaceId, kind: 'program', slug: PROGRAM.slug, title: PROGRAM.title, subtitle: PROGRAM.subtitle, status: 'published', position: 0 })
      .select('id')
      .single(),
  );
  await one(db.from('programs').update({ community_product_id: communityId }).eq('product_id', program.id).select('product_id').single());

  for (const [m, mod] of MODULES.entries()) {
    const moduleRow = await one(
      db
        .from('modules')
        .insert({ program_id: program.id, title: mod.title, description: mod.description, position: m, status: 'published' })
        .select('id')
        .single(),
    );
    for (const [s, step] of mod.steps.entries()) {
      const stepRow = await one(
        db.from('steps').insert({ module_id: moduleRow.id, title: step.title, position: s, status: 'published' }).select('id').single(),
      );
      await one(db.from('parts').insert({ step_id: stepRow.id, kind: 'text', position: 0, body: step.text }).select('id').single());
    }
  }
}

async function seedCommunity(db: Db, spaceId: string): Promise<string> {
  const community = await one(
    db
      .from('products')
      .insert({ space_id: spaceId, kind: 'community', slug: COMMUNITY.slug, title: COMMUNITY.title, status: 'published', position: 1 })
      .select('id')
      .single(),
  );
  for (const [i, title] of COMMUNITY.channels.entries()) {
    await one(db.from('channels').insert({ community_id: community.id, title, position: i }).select('id').single());
  }
  return community.id as string;
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('usage: node --env-file=.env.local scripts/seed-test-space.ts <owner-email>');
  const db = client();

  const taken = await db.from('spaces').select('id').eq('slug', SPACE.slug).maybeSingle();
  if (taken.error) throw new Error(taken.error.message);
  if (taken.data) throw new Error(`space "${SPACE.slug}" already exists; delete it first to reseed`);

  const space = await one(db.from('spaces').insert({ ...SPACE, is_test: true }).select('id').single());
  const profileId = await ownerProfileId(db, email);
  await one(db.from('space_members').insert({ space_id: space.id, profile_id: profileId, role: 'owner' }).select('role').single());
  await one(db.from('space_profiles').insert({ space_id: space.id, profile_id: profileId, display_name: OWNER_NAME }).select('profile_id').single());

  const communityId = await seedCommunity(db, space.id);
  await seedProgram(db, space.id, communityId);

  const claim = newClaimToken(new Date());
  await one(
    db
      .from('claim_tokens')
      .insert({ token_hash: claim.hash, space_id: space.id, profile_id: profileId, expires_at: claim.expiresAt.toISOString() })
      .select('token_hash')
      .single(),
  );

  console.log(`Seeded test space "${SPACE.slug}" for ${email}.`);
  console.log(`Open once to sign in and set a password: http://${SPACE.slug}.localhost:${DEV_PORT}/claim/${claim.token}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

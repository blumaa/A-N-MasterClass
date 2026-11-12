// Fills a test space (spaces.is_test) with a demo public site: a published home page that uses
// every section kind and tone, an About page with the split hero, one offer and the header/footer nav.
// Photos are CC0 files from Wikimedia Commons, uploaded to the `site` bucket.
// Re-runnable: replaces the demo pages, offer, photos and nav. Refuses spaces that are not test spaces.
//
//   node --env-file=.env.local scripts/seed-demo-site.ts [space-slug]   (default: fiddle)
//
// Plain Node (type stripping), so only relative imports without the @/ alias.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PROGRAM_SLUG = 'old-time-fiddle';
const OFFER = { slug: 'first-tunes', title: 'Old-Time Fiddle: First Tunes', price_cents: 9900, currency: 'EUR' };

// CC0 photos (Wikimedia Commons). Key = file name in the bucket.
const PHOTOS = {
  'hero.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Outdoors_violinist_in_a_sweater_%28Unsplash%29.jpg/1920px-Outdoors_violinist_in_a_sweater_%28Unsplash%29.jpg',
  'portrait.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Passionate_violinist_%28Unsplash%29.jpg/1280px-Passionate_violinist_%28Unsplash%29.jpg',
  'violin-table.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/%C4%8Celo_and_Violin_with_bow_on_the_small_table_%282019-06-30_13.00.34_by_Marko_Milivojevic_%40PIXNIO_2590929%29.jpg/1920px-%C4%8Celo_and_Violin_with_bow_on_the_small_table_%282019-06-30_13.00.34_by_Marko_Milivojevic_%40PIXNIO_2590929%29.jpg',
  'ensemble.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Tamburica_ensemble_with_fiddle%2C_bas%2C_bra%C4%8D%2C_accordion%2C_etc._%282015-04-25_13.58.29_Marko_Milivojevic_%40PIXNIO_2448480%29.jpg/1280px-Tamburica_ensemble_with_fiddle%2C_bas%2C_bra%C4%8D%2C_accordion%2C_etc._%282015-04-25_13.58.29_Marko_Milivojevic_%40PIXNIO_2448480%29.jpg',
  'player.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Bra%C4%8D_player_%282019-03-31_17.32.08_by_Marko_Milivojevic_%40PIXNIO_2592468%29.jpg/1280px-Bra%C4%8D_player_%282019-03-31_17.32.08_by_Marko_Milivojevic_%40PIXNIO_2592468%29.jpg',
  'instruments.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/%C4%8Celo_and_Violin_on_the_small_table_%282019-06-30_13.01.08_by_Marko_Milivojevic_%40PIXNIO_2590931%29.jpg/1280px-%C4%8Celo_and_Violin_on_the_small_table_%282019-06-30_13.01.08_by_Marko_Milivojevic_%40PIXNIO_2590931%29.jpg',
} as const;
type Photo = keyof typeof PHOTOS;
type Paths = Record<Photo, string>;

type Row = Record<string, string>;
type Section = { id: string; kind: string; hidden: false; fields: Row; items: Row[] };
const section = (kind: string, fields: Row, items: Row[] = []): Section => ({ id: randomUUID(), kind, hidden: false, fields, items });

function homeSections(p: Paths): Section[] {
  const checkout = `/checkout/${OFFER.slug}`;
  return [
    section('hero', {
      eyebrow: 'Old-time fiddle, online',
      heading: 'Learn to play *by ear*',
      subheading: 'Short video lessons, one tune at a time, and a friendly porch to share your playing.',
      image: p['hero.jpg'],
      imageAlt: 'A violinist playing outdoors in a wool sweater',
      layout: 'overlay',
      ctaLabel: 'Start learning',
      ctaHref: checkout,
      tone: 'dark',
    }),
    section('highlights', { heading: 'What you get', tone: 'soft' }, [
      { text: 'Eight bite-size lessons' },
      { text: 'Tunes taught phrase by phrase' },
      { text: 'Bowing that makes people dance' },
      { text: 'A community to play along with' },
    ]),
    section('imageText', {
      eyebrow: 'The method',
      heading: 'Hear it, sing it, *then* play it',
      body: 'Every tune starts with listening. You sing the phrase, find it on the strings, and loop it until it sits in your hands. No sheet music needed.',
      image: p['violin-table.jpg'],
      imageAlt: 'A violin and bow resting on a small wooden table',
      side: 'right',
      ctaLabel: 'See the lessons',
      ctaHref: '#lessons',
      tone: 'plain',
    }),
    section('bio', {
      eyebrow: 'Your teacher',
      heading: 'Hi, I am *glad* you are here',
      body: 'I learned at kitchen-table jams long before I read a note. This course is the path I wish I had: small steps, real tunes, and lots of encouragement.',
      image: p['portrait.jpg'],
      imageAlt: 'Portrait of a violinist playing with eyes closed',
      signature: 'Your teacher',
      tone: 'soft',
    }),
    section('curriculum', { heading: 'Inside the course', programSlug: PROGRAM_SLUG, tone: 'plain' }),
    section('cards', { heading: 'Ways to *play along*', tone: 'plain' }, [
      { image: p['player.jpg'], imageAlt: 'A musician playing a string instrument', title: 'The course', body: 'Step by step lessons you can repeat as often as you like.', href: checkout },
      { image: p['ensemble.jpg'], imageAlt: 'A folk ensemble with fiddle, bass and accordion', title: 'The front porch', body: 'Post a recording, get kind feedback, join the tune of the week.', href: '/library' },
      { image: p['instruments.jpg'], imageAlt: 'A violin and a cello on a small table', title: 'About the teacher', body: 'How I teach and why playing by ear works.', href: '/about' },
    ]),
    section('testimonials', { heading: 'From the porch', tone: 'dark' }, [
      { quote: 'I played Soldier’s Joy at my first jam after three weeks. I did not think that was possible.', name: 'A happy student' },
      { quote: 'The bowing lessons changed everything. My tunes finally have a pulse.', name: 'Another student' },
    ]),
    section('offer', { heading: 'Start today', offerSlug: OFFER.slug, tone: 'soft' }),
    section('faq', { heading: 'Questions', tone: 'plain' }, [
      { question: 'Do I need to read music?', answer: 'No. Every tune is taught by ear, one short phrase at a time.' },
      { question: 'How long do I have access?', answer: 'For life, including new lessons added later.' },
      { question: 'What fiddle do I need?', answer: 'Any full-size violin with a working bow. A rented one is fine.' },
    ]),
    section('cta', { heading: 'Your first tune is *one week* away', body: 'Pick up the fiddle and start with lesson one.', ctaLabel: 'Join the course', ctaHref: checkout, tone: 'dark' }),
  ];
}

function aboutSections(p: Paths): Section[] {
  return [
    section('hero', {
      eyebrow: 'About',
      heading: 'Music learned *the old way*',
      subheading: 'At jams, on porches, by ear. Now online, at your own pace.',
      image: p['portrait.jpg'],
      imageAlt: 'Portrait of a violinist playing with eyes closed',
      layout: 'split',
      ctaLabel: 'See the course',
      ctaHref: `/checkout/${OFFER.slug}`,
      tone: 'soft',
    }),
    section('text', {
      heading: 'Why by ear',
      body: 'Old-time music was passed on by playing together. Learning by ear trains the skill you need at a jam: hearing a tune and joining in.',
      tone: 'plain',
    }),
  ];
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file=.env.local)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
type Db = ReturnType<typeof client>;

function check(res: { error: { message: string } | null }, what: string): void {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wikimedia rate-limits bursts (HTTP 429): wait and try again a few times. */
async function download(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'masterclass-demo-seed/0.1' } });
    if (res.status !== 429 || attempt === 5) return res;
    await wait(attempt * 5000);
  }
}

async function uploadPhotos(db: Db, spaceId: string): Promise<Paths> {
  const out = {} as Paths;
  for (const [name, url] of Object.entries(PHOTOS) as [Photo, string][]) {
    const res = await download(url);
    if (!res.ok) throw new Error(`download ${name}: HTTP ${res.status}`);
    const path = `${spaceId}/site/demo-${name}`;
    check(await db.storage.from('site').upload(path, await res.arrayBuffer(), { contentType: 'image/jpeg', upsert: true }), `upload ${name}`);
    out[name] = path;
  }
  return out;
}

async function seedOffer(db: Db, spaceId: string): Promise<void> {
  const program = await db.from('products').select('id').eq('space_id', spaceId).eq('slug', PROGRAM_SLUG).single();
  check(program, 'program');
  check(await db.from('offers').delete().eq('space_id', spaceId).eq('slug', OFFER.slug), 'delete offer');
  const offer = await db
    .from('offers')
    .insert({ ...OFFER, space_id: spaceId, status: 'published', description: 'All lessons, lifetime access, and the community.' })
    .select('id')
    .single();
  check(offer, 'offer');
  check(await db.from('offer_products').insert({ offer_id: offer.data!.id, product_id: program.data!.id }), 'offer product');
}

async function seedPage(db: Db, spaceId: string, slug: string, title: string, isHome: boolean, sections: Section[]): Promise<void> {
  check(await db.from('pages').delete().eq('space_id', spaceId).eq('kind', 'page').eq('slug', slug), `delete page ${slug}`);
  const now = new Date().toISOString();
  check(
    await db.from('pages').insert({ space_id: spaceId, slug, title, is_home: isHome, draft: sections, published: sections, published_at: now }),
    `page ${slug}`,
  );
}

async function main(): Promise<void> {
  const slug = process.argv[2]?.trim() || 'fiddle';
  const db = client();
  const space = await db.from('spaces').select('id, is_test').eq('slug', slug).maybeSingle();
  check(space, 'space');
  if (!space.data) throw new Error(`space "${slug}" not found`);
  if (!space.data.is_test) throw new Error(`space "${slug}" is not a test space; refusing`);
  const spaceId = space.data.id as string;

  const photos = await uploadPhotos(db, spaceId);
  await seedOffer(db, spaceId);
  await seedPage(db, spaceId, 'home', 'Home', true, homeSections(photos));
  await seedPage(db, spaceId, 'about', 'About', false, aboutSections(photos));
  const nav = {
    space_id: spaceId,
    header: [
      { label: 'Course', href: `/checkout/${OFFER.slug}` },
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
    ],
    footer: [{ label: 'About', href: '/about' }],
  };
  check(await db.from('site_nav').upsert(nav), 'nav');
  console.log(`Demo site seeded in "${slug}": http://${slug}.localhost:3000/`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

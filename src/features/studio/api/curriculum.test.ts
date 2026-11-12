import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { fromPlainText } from '@/lib/doc/doc';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { uploadPath } from '@/lib/storage/uploadPath';
import { QUIZ_QUESTION_OPTIONS } from '@/lib/data/errors';
import { curriculum, editCurriculum, quizEditor, studioPrograms } from './curriculum';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let files: ReturnType<typeof createFakeFileStore>;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  files = createFakeFileStore();
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('studio reads', () => {
  it('lists programs to editors only', async () => {
    expect((await studioPrograms(repo, await as(SEED_IDS.assistant)))?.map((p) => p.slug)).toEqual(['shibari-101']);
    expect(await studioPrograms(repo, await as(SEED_IDS.student))).toBeNull();
  });

  it('returns the full tree with parts for an editor', async () => {
    const tree = (await curriculum(repo, await as(SEED_IDS.alexanderOwner), 'shibari-101'))!;
    expect(tree.modules.map((m) => m.steps.length)).toEqual([2, 2, 1, 1]);
    expect(tree.modules[0]?.steps[0]?.parts.map((p) => p.kind)).toEqual(['video', 'text']);
  });

  it('hides another space’s program', async () => {
    expect(await curriculum(repo, await as(SEED_IDS.natashaOwner, 'natasha'), 'shibari-101')).toBeNull();
  });
});

describe('editCurriculum', () => {
  it('creates a program as draft', async () => {
    const r = await editCurriculum(repo, files, await as(SEED_IDS.alexanderOwner), {
      op: 'createProgram',
      title: 'Advanced',
      slug: 'advanced',
    });
    expect(r).toMatchObject({ ok: true });
    expect((await repo.productBySlug(SEED_IDS.alexander, 'advanced'))?.status).toBe('draft');
  });

  it('turns repo constraint errors into a result', async () => {
    const r = await editCurriculum(repo, files, await as(SEED_IDS.alexanderOwner), {
      op: 'createProgram',
      title: 'Dup',
      slug: 'shibari-101',
    });
    expect(r).toEqual({ ok: false, error: 'invalid', message: 'slug taken: shibari-101' });
  });

  it('refuses a student', async () => {
    const r = await editCurriculum(repo, files, await as(SEED_IDS.student), { op: 'deleteStep', stepId: 'step-intro' });
    expect(r).toEqual({ ok: false, error: 'forbidden' });
    expect(await repo.step('step-intro')).not.toBeNull();
  });

  it('refuses staff of another space (tenant check)', async () => {
    const r = await editCurriculum(repo, files, await as(SEED_IDS.natashaOwner, 'natasha'), {
      op: 'updatePart',
      partId: 'part-intro-text',
      patch: { text: fromPlainText('hacked') },
    });
    expect(r).toEqual({ ok: false, error: 'not_found' });
    expect((await repo.part('part-intro-text'))?.text).not.toEqual(fromPlainText('hacked'));
  });

  it('adds a module, step and part', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const m = await editCurriculum(repo, files, owner, { op: 'createModule', programId: SEED_IDS.program, title: 'Extra' });
    if (!m.ok || !m.id) throw new Error('module');
    const s = await editCurriculum(repo, files, owner, { op: 'createStep', moduleId: m.id, title: 'Lesson' });
    if (!s.ok || !s.id) throw new Error('step');
    const p = await editCurriculum(repo, files, owner, { op: 'createPart', stepId: s.id, kind: 'text' });
    expect(p).toMatchObject({ ok: true });
    expect(await repo.parts(s.id)).toHaveLength(1);
  });

  it('refuses a module gate step from another program', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const other = await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'program', slug: 'other', title: 'O' });
    const om = await repo.createModule({ programId: other.id, title: 'M' });
    const os = await repo.createStep({ moduleId: om.id, title: 'S' });
    const r = await editCurriculum(repo, files, owner, {
      op: 'updateModule',
      moduleId: 'mod-basics',
      patch: { unlockAfterStepId: os.id },
    });
    expect(r).toEqual({ ok: false, error: 'invalid', message: 'gate step must belong to this program' });
  });

  it('moves a step', async () => {
    await editCurriculum(repo, files, await as(SEED_IDS.assistant), { op: 'move', table: 'steps', id: 'step-safety', direction: 'up' });
    expect((await repo.steps(['mod-welcome'])).map((s) => s.id)).toEqual(['step-safety', 'step-intro']);
  });
});

describe('download parts', () => {
  const LEGACY = 'shibari-101/safety.pdf';
  const inFolder = (id: string) => uploadPath({ spaceId: SEED_IDS.alexander, productId: SEED_IDS.program, id, fileName: 'Guide.pdf' });
  const setFile = async (filePath: string | null, fileSize: number | null = 10, partId = 'part-safety-pdf') =>
    editCurriculum(repo, files, await as(SEED_IDS.assistant), { op: 'updatePart', partId, patch: { filePath, fileSize } });

  it('saves an uploaded file in the program folder and removes the replaced one after the write', async () => {
    expect(await setFile(inFolder('a'), 1200)).toMatchObject({ ok: true });
    expect(await repo.part('part-safety-pdf')).toMatchObject({ filePath: inFolder('a'), fileSize: 1200 });
    expect(files.removed).toEqual([LEGACY]);
    expect(await setFile(inFolder('b'))).toMatchObject({ ok: true });
    expect(files.removed).toEqual([LEGACY, inFolder('a')]);
  });

  it('keeps an unchanged path without removing it', async () => {
    expect(await setFile(LEGACY)).toMatchObject({ ok: true });
    expect(files.removed).toEqual([]);
  });

  it('refuses a path outside the program folder', async () => {
    const other = uploadPath({ spaceId: SEED_IDS.alexander, productId: SEED_IDS.downloads, id: 'x', fileName: 'a.pdf' });
    expect(await setFile(other)).toEqual({ ok: false, error: 'not_found' });
    expect(await setFile(`${SEED_IDS.natasha}/${SEED_IDS.program}/x-a.pdf`)).toEqual({ ok: false, error: 'not_found' });
    expect((await repo.part('part-safety-pdf'))?.filePath).toBe(LEGACY);
    expect(files.removed).toEqual([]);
  });

  it('removes the file when the part, its step or its module is deleted', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    expect(await editCurriculum(repo, files, owner, { op: 'deletePart', partId: 'part-safety-pdf' })).toMatchObject({ ok: true });
    expect(files.removed).toEqual([LEGACY]);

    await repo.updatePart('part-safety-text', { filePath: inFolder('s') });
    await editCurriculum(repo, files, owner, { op: 'deleteStep', stepId: 'step-safety' });
    expect(files.removed).toEqual([LEGACY, inFolder('s')]);

    await repo.updatePart('part-intro-text', { filePath: inFolder('m') });
    await editCurriculum(repo, files, owner, { op: 'deleteModule', moduleId: 'mod-welcome' });
    expect(files.removed).toEqual([LEGACY, inFolder('s'), inFolder('m')]);
  });

  it('throws a storage error after the DB write (never swallowed)', async () => {
    files.remove = async () => {
      throw new Error('storage down');
    };
    await expect(editCurriculum(repo, files, await as(SEED_IDS.assistant), { op: 'deletePart', partId: 'part-safety-pdf' })).rejects.toThrow('storage down');
    expect(await repo.part('part-safety-pdf')).toBeNull();
  });

  it('removes nothing when the part had no file', async () => {
    await editCurriculum(repo, files, await as(SEED_IDS.alexanderOwner), { op: 'deletePart', partId: 'part-intro-text' });
    expect(files.removed).toEqual([]);
  });
});

describe('quizzes (G26)', () => {
  const quizPart = async () => (await repo.createPart({ stepId: 'step-safety', kind: 'quiz' })).id;
  const options = [
    { label: 'Shears', correct: true },
    { label: 'Glue', correct: false },
  ];

  it('adds, edits and deletes a question; the editor reads the key', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const partId = await quizPart();
    const added = await editCurriculum(repo, files, owner, { op: 'saveQuestion', partId, questionId: null, prompt: 'Tool?', options });
    if (!added.ok || !added.id) throw new Error('question');
    await editCurriculum(repo, files, owner, {
      op: 'saveQuestion',
      partId,
      questionId: added.id,
      prompt: 'Which tool?',
      options: [...options, { label: 'Rope', correct: true }],
    });
    const editor = await quizEditor(repo, owner, await repo.parts('step-safety'));
    expect(editor?.[partId]).toEqual([
      expect.objectContaining({
        prompt: 'Which tool?',
        options: [
          expect.objectContaining({ label: 'Shears', correct: true }),
          expect.objectContaining({ label: 'Glue', correct: false }),
          expect.objectContaining({ label: 'Rope', correct: true }),
        ],
      }),
    ]);
    expect(await editCurriculum(repo, files, owner, { op: 'deleteQuestion', questionId: added.id })).toMatchObject({ ok: true });
    expect(await repo.quizQuestions([partId])).toEqual([]);
  });

  it('refuses questions on a non-quiz part or a question of another quiz', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const text = await editCurriculum(repo, files, owner, { op: 'saveQuestion', partId: 'part-safety-text', questionId: null, prompt: 'Q', options });
    expect(text).toEqual({ ok: false, error: 'not_found' });
    const a = await quizPart();
    const b = await quizPart();
    const q = await repo.saveQuizQuestion({ partId: a, questionId: null, prompt: 'Q', options });
    const moved = await editCurriculum(repo, files, owner, { op: 'saveQuestion', partId: b, questionId: q, prompt: 'Q', options });
    expect(moved).toEqual({ ok: false, error: 'not_found' });
  });

  it('turns a bad question into an invalid result', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const r = await editCurriculum(repo, files, owner, {
      op: 'saveQuestion',
      partId: await quizPart(),
      questionId: null,
      prompt: 'Q',
      options: [{ label: 'Only', correct: true }],
    });
    expect(r).toEqual({ ok: false, error: 'invalid', message: QUIZ_QUESTION_OPTIONS });
  });

  it('locks a module on a quiz of this program only', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const partId = await quizPart();
    const ok = await editCurriculum(repo, files, owner, { op: 'updateModule', moduleId: 'mod-week2', patch: { unlockQuizPartId: partId } });
    expect(ok).toMatchObject({ ok: true });
    expect((await repo.module('mod-week2'))?.unlockQuizPartId).toBe(partId);
    const notQuiz = await editCurriculum(repo, files, owner, {
      op: 'updateModule',
      moduleId: 'mod-week2',
      patch: { unlockQuizPartId: 'part-safety-text' },
    });
    expect(notQuiz).toEqual({ ok: false, error: 'invalid', message: 'gate quiz must be a quiz in this program' });
  });

  it('shows the key to editors only', async () => {
    const student = await as(SEED_IDS.student);
    expect(await quizEditor(repo, student, [])).toBeNull();
  });
});

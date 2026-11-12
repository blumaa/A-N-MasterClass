import { describe, expect, it } from 'vitest';
import { commandFromForm } from './commandFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('commandFromForm', () => {
  it('derives the program slug from the title when blank', () => {
    expect(commandFromForm(form({ op: 'createProgram', title: 'Floor Work', slug: '' }))).toEqual({
      ok: true,
      command: { op: 'createProgram', title: 'Floor Work', slug: 'floor-work' },
    });
  });

  it('reads the program certificate toggle (G26)', () => {
    expect(commandFromForm(form({ op: 'updateProgram', programId: 'p', title: 'Floor', certificates: 'true' }))).toEqual({
      ok: true,
      command: { op: 'updateProgram', programId: 'p', patch: { title: 'Floor', certificates: true } },
    });
  });

  it('patches only fields the form sent, blanks become null', () => {
    const r = commandFromForm(
      form({ op: 'updateModule', moduleId: 'm', title: 'Week 2', unlockAfterStepId: '', releaseAfterDays: '7', releaseAt: '' }),
    );
    expect(r).toEqual({
      ok: true,
      command: { op: 'updateModule', moduleId: 'm', patch: { title: 'Week 2', unlockAfterStepId: null, releaseAfterDays: 7, releaseAt: null } },
    });
  });

  it('reads a fixed release date as UTC midnight', () => {
    const r = commandFromForm(form({ op: 'updateModule', moduleId: 'm', releaseAt: '2026-12-01' }));
    expect(r.ok && r.command.op === 'updateModule' && r.command.patch.releaseAt).toEqual(new Date('2026-12-01T00:00:00Z'));
  });

  it('turns a pasted Vimeo link into an id and refuses other links', () => {
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', video: 'https://vimeo.com/76979871' }))).toEqual({
      ok: true,
      command: { op: 'updatePart', partId: 'p', patch: { vimeoId: '76979871' } },
    });
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', video: 'https://youtube.com/x' }))).toEqual({
      ok: false,
      message: 'Paste a Vimeo link or video id.',
    });
  });

  it('reads an uploaded file path + size; blank path clears both', () => {
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', filePath: 's/p/a.pdf', fileSize: '1200' }))).toEqual({
      ok: true,
      command: { op: 'updatePart', partId: 'p', patch: { filePath: 's/p/a.pdf', fileSize: 1200 } },
    });
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', filePath: '', fileSize: '' }))).toEqual({
      ok: true,
      command: { op: 'updatePart', partId: 'p', patch: { filePath: null, fileSize: null } },
    });
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', filePath: 's/p/a.pdf', fileSize: '-1' })).ok).toBe(false);
  });

  it('refuses unknown ops, kinds, statuses and bad numbers', () => {
    expect(commandFromForm(form({ op: 'dropTable' })).ok).toBe(false);
    expect(commandFromForm(form({ op: 'createPart', stepId: 's', kind: 'poll' })).ok).toBe(false);
    expect(commandFromForm(form({ op: 'updateStep', stepId: 's', status: 'live' })).ok).toBe(false);
    expect(commandFromForm(form({ op: 'updateModule', moduleId: 'm', releaseAfterDays: 'soon' })).ok).toBe(false);
    expect(commandFromForm(form({ op: 'createModule', programId: '' , title: 'x'})).ok).toBe(false);
  });

  it('parses moves', () => {
    expect(commandFromForm(form({ op: 'move', table: 'steps', id: 's', direction: 'up' }))).toEqual({
      ok: true,
      command: { op: 'move', table: 'steps', id: 's', direction: 'up' },
    });
  });

  it('reads a quiz question: rows keep their index, blank rows drop, ticked rows are correct', () => {
    const f = form({ op: 'saveQuestion', partId: 'p1', questionId: '', prompt: ' Which? ' });
    for (const label of ['Shears', '', 'Rope', '']) f.append('option', label);
    f.append('correct', '2');
    expect(commandFromForm(f)).toEqual({
      ok: true,
      command: {
        op: 'saveQuestion',
        partId: 'p1',
        questionId: null,
        prompt: 'Which?',
        options: [
          { label: 'Shears', correct: false },
          { label: 'Rope', correct: true },
        ],
      },
    });
    expect(commandFromForm(form({ op: 'deleteQuestion', questionId: 'q1' }))).toEqual({
      ok: true,
      command: { op: 'deleteQuestion', questionId: 'q1' },
    });
  });

  it('reads a pass mark and a quiz lock; blank clears them', () => {
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', passPercent: '80' }))).toMatchObject({
      command: { patch: { passPercent: 80 } },
    });
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', passPercent: '' }))).toMatchObject({
      command: { patch: { passPercent: null } },
    });
    expect(commandFromForm(form({ op: 'updatePart', partId: 'p', passPercent: 'most' })).ok).toBe(false);
    expect(commandFromForm(form({ op: 'updateModule', moduleId: 'm', unlockQuizPartId: 'qz' }))).toMatchObject({
      command: { patch: { unlockQuizPartId: 'qz' } },
    });
  });
});

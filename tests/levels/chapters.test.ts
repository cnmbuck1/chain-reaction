import { describe, expect, it } from 'vitest';
import { CHAPTERS, chaptersFor } from '../../src/levels/chapters';
import { levels } from '../../src/levels';

describe('chapters', () => {
  it('place every level in exactly one chapter, in play order', () => {
    const views = chaptersFor(levels);
    const all = views.flatMap((v) => v.indexes);
    expect(all).toEqual(levels.map((_, i) => i));
  });

  it('name only levels that exist', () => {
    const ids = new Set(levels.map((l) => l.id));
    for (const chapter of CHAPTERS)
      for (const id of chapter.levelIds) expect(ids.has(id), id).toBe(true);
  });

  it('put levels no chapter lists under "More machines", so new levels always show', () => {
    const extra = { ...levels[0]!, id: 'level-99', name: 'Extra' };
    const views = chaptersFor([...levels, extra]);
    expect(views.at(-1)!.chapter.name).toBe('More machines');
    expect(views.at(-1)!.indexes).toEqual([levels.length]);
  });
});

import type { LevelDef } from '../engine/types';

// Chapters group the level list. Each names the idea it introduces, which the level
// select shows as a preview before the chapter opens. Levels are matched by id, so a
// level added after the last chapter still shows, under "More machines".

export interface Chapter {
  id: string;
  name: string;
  /** The new part or idea, as the preview of a chapter not yet open shows it. */
  intro: string;
  /** Level ids in play order. */
  levelIds: readonly string[];
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `level-${String(from + i).padStart(2, '0')}`);

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'basics',
    name: 'Basics',
    intro: 'Switches, chains, and ALL and ANY gates',
    levelIds: range(1, 10),
  },
  {
    id: 'forks',
    name: 'Forks',
    intro: 'A fork picks which lane the ball takes',
    levelIds: range(11, 15),
  },
  {
    id: 'two-parts',
    name: 'Two Parts',
    intro: 'Clear part A, and the ball drops into part B',
    levelIds: range(16, 20),
  },
  {
    id: 'inversions',
    name: 'Inversions',
    intro: 'A NOT wire carries power while its switch is off',
    levelIds: range(21, 30),
  },
  {
    id: 'gears',
    name: 'Gears',
    intro: 'Meshed switches: turning one turns its partner too',
    levelIds: range(31, 35),
  },
  {
    id: 'keys',
    name: 'Keys',
    intro: 'Pick up the key on the way, or the lock stops the ball',
    levelIds: range(36, 40),
  },
  {
    id: 'trips',
    name: 'Trip plates',
    intro: 'The ball flips a switch as it rolls over a plate',
    levelIds: range(41, 45),
  },
];

export interface ChapterView {
  chapter: Chapter;
  /** Indexes into the full level list, in play order. */
  indexes: number[];
}

/** The chapters that have levels, plus a catch-all for levels no chapter lists. */
export function chaptersFor(levels: readonly LevelDef[]): ChapterView[] {
  const indexOf = new Map(levels.map((l, i) => [l.id, i]));
  const placed = new Set<number>();
  const views: ChapterView[] = [];
  for (const chapter of CHAPTERS) {
    const indexes = chapter.levelIds.flatMap((id) => {
      const i = indexOf.get(id);
      return i === undefined ? [] : [i];
    });
    indexes.forEach((i) => placed.add(i));
    if (indexes.length > 0) views.push({ chapter, indexes });
  }
  const rest = levels.map((_, i) => i).filter((i) => !placed.has(i));
  if (rest.length > 0) {
    views.push({
      chapter: { id: 'more', name: 'More machines', intro: 'New machines', levelIds: [] },
      indexes: rest,
    });
  }
  return views;
}

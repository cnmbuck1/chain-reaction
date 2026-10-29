import type { DailyResult } from '../storage/daily';

// The text a player shares after a daily: how it went, never the answer. One block per
// Run (red for a miss, green for the win) and a bulb per hint, like Wordle's grid.

export function shareText(number: number, result: DailyResult, streakDays: number): string {
  const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  const runs = result.runs === 1 ? 'first Run' : `${result.runs} Runs`;
  const par = result.changes <= result.par ? 'par' : `par +${result.changes - result.par}`;
  const blocks = '💡'.repeat(result.hintsUsed) + '🟥'.repeat(result.runs - 1) + '🟩';
  const lines = [`Chain Reaction Daily #${number}`, `${stars} ${runs}, ${par}`, blocks];
  if (streakDays > 1) lines.push(`🔥 ${streakDays}-day streak`);
  return lines.join('\n');
}

/**
 * Opens the system share sheet where there is one, else copies the text. Resolves to what
 * happened, so the page can say so; never throws.
 */
export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    // The player closed the share sheet: nothing to report.
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

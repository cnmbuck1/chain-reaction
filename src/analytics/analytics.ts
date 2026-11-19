// Level events for Firebase Analytics, so progress across all players shows in the Firebase
// console: how far players get, where they quit, and how much help each level needs.
// Only the phone apps send them, and only once ANALYTICS_READY is set; the web build and
// unconfigured apps send nothing. No player ID or advertising ID is attached.

import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { statsKey, type MetricEvent } from '../storage/metrics';
import { ANALYTICS_READY } from './config';

export interface AnalyticsEvent {
  name: string;
  params: Record<string, string | number>;
}

/** The user property that holds the furthest campaign level a player has solved. */
export const FURTHEST_LEVEL = 'furthest_level';

/**
 * The Firebase event for a play stat, or null for stats Firebase already counts itself
 * (sessions) or that only matter on the device. `level` is the campaign number, 1 to 60;
 * every daily puzzle is level 0, named "daily".
 */
export function toAnalytics(
  event: MetricEvent,
  levelIds: readonly string[],
): AnalyticsEvent | null {
  const at = (id: string) => ({
    level_name: statsKey(id),
    level: levelIds.indexOf(id) + 1,
  });
  switch (event.type) {
    case 'start':
      return { name: 'level_start', params: at(event.level) };
    case 'run':
      return { name: 'level_run', params: { ...at(event.level), success: event.won ? 1 : 0 } };
    case 'solve':
      return {
        name: 'level_end',
        params: {
          ...at(event.level),
          success: 1,
          stars: event.stars,
          runs: event.runs,
          hints: event.hints,
        },
      };
    case 'quit':
      return { name: 'level_quit', params: at(event.level) };
    case 'hint':
      return { name: 'hint_used', params: { ...at(event.level), paid: event.paid } };
    case 'retry':
      return { name: 'retry_used', params: { ...at(event.level), paid: event.paid } };
    case 'adWatched':
      return { name: 'rewarded_ad', params: { placement: event.placement } };
    case 'purchase':
      return { name: 'shop_purchase', params: { item: event.item } };
    default:
      return null;
  }
}

/** The highest campaign number solved, counting `alsoSolved` too; 0 before the first solve. */
export function furthestLevel(
  levelIds: readonly string[],
  completed: Readonly<Record<string, unknown>>,
  alsoSolved?: string,
): number {
  let furthest = 0;
  levelIds.forEach((id, i) => {
    if (id in completed || id === alsoSolved) furthest = i + 1;
  });
  return furthest;
}

const enabled = () => ANALYTICS_READY && Capacitor.isNativePlatform();

/** Sends one event. Never throws: analytics must not get in the way of play. */
export function logEvent(event: AnalyticsEvent | null) {
  if (!event || !enabled()) return;
  FirebaseAnalytics.logEvent({ name: event.name, params: event.params }).catch(() => {});
}

/** Records how far this player has got, for splitting every report by progress. */
export function setFurthestLevel(level: number) {
  if (!enabled()) return;
  FirebaseAnalytics.setUserProperty({ key: FURTHEST_LEVEL, value: String(level) }).catch(() => {});
}

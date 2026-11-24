import { useCallback, useEffect, useState } from 'react';
import type { IconName } from '@flurry/art';
import type { Snapshot } from '../lib/progress';

export type Route = 'egg' | 'yetis' | 'play' | 'earn' | 'shop' | 'how' | 'merge' | 'admin';

/** Tabs appear only once their feature ships (UX spec §4). */
export const TABS: { route: Route; label: string; icon: IconName; available: boolean }[] = [
  { route: 'egg', label: 'Egg', icon: 'egg', available: true },
  { route: 'yetis', label: 'Yetis', icon: 'den', available: true },
  { route: 'play', label: 'Play', icon: 'play', available: true },
  { route: 'earn', label: 'Earn', icon: 'market', available: true },
  { route: 'shop', label: 'Shop', icon: 'shop', available: true },
];

export const visibleTabs = () => TABS.filter((t) => t.available);

/** Older links (Den and Train were merged into Yetis). */
const ALIASES: Record<string, Route> = { den: 'yetis', train: 'yetis' };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '').split('/')[0];
  const r = ALIASES[raw] ?? raw;
  if (r === 'how' || r === 'merge' || r === 'admin') return r; // pages, not tabs
  return visibleTabs().some((t) => t.route === r) ? (r as Route) : 'egg';
}

/** The part after the slash, e.g. a yeti id in #yetis/0x… */
export function routeParam(hash: string): string | null {
  const p = hash.replace(/^#/, '').split('/')[1];
  return p ? decodeURIComponent(p) : null;
}

export function navigate(r: Route, param?: string | null) {
  location.hash = param ? `${r}/${encodeURIComponent(param)}` : r;
}

/** Hash-based route so links are shareable and the back button works. */
export function useRoute(): [Route, (r: Route, param?: string | null) => void, string | null] {
  const [state, setState] = useState(() => ({ route: parseRoute(location.hash), param: routeParam(location.hash) }));
  useEffect(() => {
    const on = () => setState({ route: parseRoute(location.hash), param: routeParam(location.hash) });
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  // Update state synchronously too, so a View Transition can capture the new screen.
  const go = useCallback((r: Route, param: string | null = null) => { setState({ route: r, param }); navigate(r, param); }, []);
  return [state.route, go, state.param];
}

export type Sky = { mood: 'dawn' | 'day' | 'dusk' | 'night'; top: string; bottom: string; ink: string; peaks: string; far: string };

/** The base camp sky follows the player's local time of day. */
export function skyFor(hour: number): Sky {
  if (hour >= 5 && hour < 9) return { mood: 'dawn', top: '#9EC5EC', bottom: '#FBD7C4', ink: '#14213D', peaks: '#C9D9EC', far: '#E3ECF7' };
  if (hour >= 9 && hour < 17) return { mood: 'day', top: '#6FB6E6', bottom: '#BFE2F6', ink: '#14213D', peaks: '#D7E7F5', far: '#EAF3FB' };
  if (hour >= 17 && hour < 20) return { mood: 'dusk', top: '#5B6FB8', bottom: '#F2A98B', ink: '#FFFFFF', peaks: '#8E9BD0', far: '#B9B8DE' };
  return { mood: 'night', top: '#14213D', bottom: '#2F4A7A', ink: '#FFFFFF', peaks: '#2A3E66', far: '#3A5385' };
}

import type { Snapshot } from '../lib/progress';
import type { Route } from '../shell/nav';
import { Den } from './Den';
import { YetiDetail } from './YetiDetail';

/** The Yetis tab: your collection as cards; tap one for its page (traits, training, card). */
export function Yetis({ snap, refresh, yetiId, go, avatarYetiId, onSetAvatar }: {
  snap: Snapshot; refresh: (until?: (s: Snapshot) => boolean) => Promise<void>;
  yetiId: string | null; go: (r: Route, param?: string | null) => void;
  avatarYetiId?: string; onSetAvatar: (yetiId: string) => Promise<void>;
}) {
  const yeti = yetiId ? snap.yetis.find((y) => y.id === yetiId) : undefined;
  if (yeti) {
    return (
      <YetiDetail snap={snap} yeti={yeti} refresh={refresh} avatarYetiId={avatarYetiId} onSetAvatar={onSetAvatar}
        onBack={() => go('yetis')} onPick={(id) => go('yetis', id)} onPlay={() => go('play')} />
    );
  }
  return <Den yetis={snap.yetis} held={snap.held} onOpenHeld={() => go('earn')} title="Your yetis" onOpen={(id) => go('yetis', id)} address={snap.address} refresh={refresh} avatarYetiId={avatarYetiId} onSetAvatar={onSetAvatar} />;
}

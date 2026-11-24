import { useEffect, useRef } from 'react';
import { avatarSvg, yetiFaceAvatar } from '@flurry/art';
import { bringToLife } from '../motion/life';
import type { ShownAvatar } from '../lib/keeper';

/** The player's chosen avatar (preset or den yeti), always round with an ink ring. */
export function Avatar({ avatar, size = 40, label }: { avatar: ShownAvatar; size?: number; label?: string }) {
  const svg = avatar.kind === 'preset'
    ? avatarSvg(avatar.preset, size)
    : yetiFaceAvatar({ level: avatar.yeti.level, elements: avatar.yeti.elements, variants: avatar.yeti.variants }, size, avatar.yeti.name);
  const ref = useRef<HTMLSpanElement>(null);
  // Bigger avatars blink and breathe too; tiny chips stay still.
  useEffect(() => (ref.current && size >= 64 ? bringToLife(ref.current, {}) : undefined), [svg, size]);
  return <span ref={ref} className="avatar" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} dangerouslySetInnerHTML={{ __html: svg }} />;
}

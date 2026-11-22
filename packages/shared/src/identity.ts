import { bcs } from '@mysten/sui/bcs';

/** Shared deny list: lore names/stories and player nicknames. */
export const DENY = /\b(damn|hell|shit|fuck|bitch|ass|crap|kill|dead|die|blood|sex|drug|hate|stupid|idiot|nazi|hating|dying)(s|es|ed|d|er|ing)?\b/i;

export type NicknameCheck = { ok: true } | { ok: false; reason: 'length' | 'chars' | 'blocked' };

/** Mirrors `flurry::identity::set_nickname` (bytes, charset, no edge spaces) plus the deny list. */
export function validateNickname(s: string): NicknameCheck {
  const n = new TextEncoder().encode(s).length;
  if (n < 2 || n > 20) return { ok: false, reason: 'length' };
  if (!/^[A-Za-z0-9_-][A-Za-z0-9 _-]*[A-Za-z0-9_-]$/.test(s)) return { ok: false, reason: 'chars' };
  if (DENY.test(s)) return { ok: false, reason: 'blocked' };
  return { ok: true };
}

/** `flurry::identity::Avatar` */
export const AvatarBcs = bcs.struct('Avatar', {
  kind: bcs.u8(),
  preset: bcs.u8(),
  yeti: bcs.option(bcs.Address),
});

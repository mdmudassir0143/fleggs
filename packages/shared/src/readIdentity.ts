import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { TESTNET } from './deployments';
import { AvatarBcs } from './identity';

export type PlayerAvatar = { kind: 'preset'; preset: number } | { kind: 'yeti'; yetiId: string };
export type PlayerIdentity = { nickname: string | null; avatar: PlayerAvatar | null };

// Move gives empty structs one hidden bool field, so a key like `NickKey {}` serialises as [0].
const EMPTY_KEY = new Uint8Array([0]);

async function field(client: ClientWithCoreApi, parentId: string, key: string): Promise<Uint8Array | null> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId,
      name: { type: `${TESTNET.identityTypesId}::identity::${key}`, bcs: EMPTY_KEY },
    });
    return dynamicField.value.bcs;
  } catch {
    return null; // not set yet
  }
}

/** Nickname and avatar from the Profile's dynamic fields (on-chain, so they follow the player across devices). */
export async function readIdentity(client: ClientWithCoreApi, profileId: string): Promise<PlayerIdentity> {
  const [nick, av] = await Promise.all([field(client, profileId, 'NickKey'), field(client, profileId, 'AvatarKey')]);
  const a = av ? AvatarBcs.parse(av) : null;
  return {
    nickname: nick ? bcs.string().parse(nick) : null,
    avatar: !a ? null : a.kind === 1 && a.yeti ? { kind: 'yeti', yetiId: a.yeti } : { kind: 'preset', preset: a.preset },
  };
}

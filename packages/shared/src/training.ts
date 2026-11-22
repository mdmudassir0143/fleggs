import { bcs } from '@mysten/sui/bcs';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { TESTNET } from './deployments';

export const TrainingBcs = bcs.struct('Training', { slot: bcs.u8(), ready_at_ms: bcs.u64() });
export type TrainingState = { slot: number; readyAt: number };

const EMPTY_KEY = new Uint8Array([0]);

/** The training in progress on a yeti (dynamic field `TrainingKey`), or null. */
export async function readTraining(client: ClientWithCoreApi, yetiId: string): Promise<TrainingState | null> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId: yetiId,
      name: { type: `${TESTNET.trainingTypesId}::training::TrainingKey`, bcs: EMPTY_KEY },
    });
    const t = TrainingBcs.parse(dynamicField.value.bcs);
    return { slot: t.slot, readyAt: Number(t.ready_at_ms) };
  } catch {
    return null;
  }
}

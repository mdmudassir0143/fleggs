import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';
import { validateNickname } from '@flurry/shared';

export type Verdict = { ok: true } | { ok: false; reason: string };

// The player may split/merge their OWN coins to pay the shop; the gas coin is never allowed.
const ALLOWED = new Set(['MoveCall', 'MakeMoveVec', 'SplitCoins', 'MergeCoins']);

function usesGasCoin(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  if ((v as { $kind?: string }).$kind === 'GasCoin') return true;
  return Object.values(v).some(usesGasCoin);
}

/**
 * The sponsor only pays for calls into the flurry package. It never lets a transaction
 * touch its gas coin or move objects, so a player can't drain or redirect sponsor funds.
 */
const SUI_TYPE = normalizeStructTag('0x2::sui::SUI');
/** The only framework calls allowed: moving the player's own SUI between their address balance and a coin. */
const FRAMEWORK_OK = new Set(['coin::redeem_funds', 'coin::send_funds']);

function normalizeStructTag(t: string) {
  const [addr, ...rest] = t.split('::');
  return [normalizeSuiAddress(addr), ...rest].join('::');
}

/** Address-balance withdrawals must come from the sender — never from the sponsor. */
export function withdrawalsFromSender(inputs: unknown[]): boolean {
  return inputs.every((i) => {
    const w = (i as { $kind?: string; FundsWithdrawal?: { withdrawFrom?: { $kind?: string } } });
    return w.$kind !== 'FundsWithdrawal' || w.FundsWithdrawal?.withdrawFrom?.$kind === 'Sender';
  });
}

export function validateKind(kindBytes: Uint8Array, packageIds: string[], sender?: string): Verdict {
  type Arg = { $kind: string; Input?: number };
  let commands: { $kind: string; MoveCall?: { package: string; module: string; function: string; typeArguments: string[]; arguments: Arg[] } }[];
  let inputs: { Pure?: { bytes: string }; $kind?: string }[];
  try {
    const data = Transaction.fromKind(kindBytes).getData();
    commands = data.commands as typeof commands;
    inputs = data.inputs as typeof inputs;
  } catch {
    return { ok: false, reason: 'not a transaction' };
  }
  const allowed = new Set(packageIds.map((p) => normalizeSuiAddress(p.toLowerCase())));
  const isFlurry = (c: (typeof commands)[number]) => !!c.MoveCall && allowed.has(normalizeSuiAddress(c.MoveCall.package));
  // Something must call Flurry — the sponsor never pays for coin shuffling on its own.
  if (!commands.some(isFlurry)) return { ok: false, reason: 'only Flurry Eggs calls are sponsored' };
  if (!withdrawalsFromSender(inputs)) return { ok: false, reason: 'funds may only come from the player' };
  for (const cmd of commands) {
    if (!ALLOWED.has(cmd.$kind)) return { ok: false, reason: `${cmd.$kind} is not allowed` };
    if (usesGasCoin(cmd)) return { ok: false, reason: 'gas coin may not be used' };
    if (cmd.MoveCall && !allowed.has(normalizeSuiAddress(cmd.MoveCall.package))) {
      const m = cmd.MoveCall;
      const framework = normalizeSuiAddress(m.package) === normalizeSuiAddress('0x2') && FRAMEWORK_OK.has(`${m.module}::${m.function}`);
      if (!framework) return { ok: false, reason: 'only Flurry Eggs calls are sponsored' };
      if (m.typeArguments.length !== 1 || normalizeStructTag(m.typeArguments[0]) !== SUI_TYPE) return { ok: false, reason: 'only SUI payments are allowed' };
      if (m.function === 'send_funds') {
        const to = m.arguments[1];
        const pure = to?.$kind === 'Input' ? inputs[to.Input!]?.Pure : undefined;
        let addr = '';
        try { addr = pure ? normalizeSuiAddress(bcs.Address.parse(fromBase64(pure.bytes))) : ''; } catch { /* unreadable → refused */ }
        if (!sender || addr !== normalizeSuiAddress(sender)) return { ok: false, reason: 'change must go back to the player' };
      }
    }
    if (cmd.MoveCall?.module === 'identity' && cmd.MoveCall.function === 'set_nickname') {
      const arg = cmd.MoveCall.arguments[1];
      const pure = arg?.$kind === 'Input' ? inputs[arg.Input!]?.Pure : undefined;
      let name = '';
      try { name = pure ? bcs.string().parse(fromBase64(pure.bytes)) : ''; } catch { /* unreadable → rejected below */ }
      if (!validateNickname(name).ok) return { ok: false, reason: 'nickname not allowed' };
    }
  }
  return { ok: true };
}

import { useEffect, useState } from 'react';
import { adminMessage, type SiteMode } from '@flurry/shared';
import { WORKER_URL } from '../config';

/** 'open' (the big button signs you in) or 'waitlist' (it goes to the waitlist page). Open if unsure. */
export async function fetchSiteMode(): Promise<SiteMode> {
  try {
    const r = await fetch(`${WORKER_URL}/site`);
    const j = (await r.json()) as { mode?: string };
    return j.mode === 'waitlist' ? 'waitlist' : 'open';
  } catch { return 'open'; }
}

let cached: SiteMode | null = null;
/** The site mode for buttons; remembers it for the visit so the button doesn't flicker. */
export function useSiteMode(): SiteMode | null {
  const [mode, setMode] = useState<SiteMode | null>(cached);
  useEffect(() => { if (!cached) fetchSiteMode().then((m) => { cached = m; setMode(m); }); }, []);
  return mode;
}

export async function joinWaitlist(email: string): Promise<{ ok: boolean; already: boolean }> {
  const r = await fetch(`${WORKER_URL}/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Could not join right now. Try again.');
  return j;
}

type Signer = (message: Uint8Array) => Promise<{ signature: string }>;
/** Approve an admin action by signing a short, timestamped message with the admin's wallet. */
async function approve(sign: Signer, address: string, action: string) {
  const ts = Date.now();
  const { signature } = await sign(new TextEncoder().encode(adminMessage(action, ts)));
  return { address, ts, signature };
}

export async function setSiteMode(sign: Signer, address: string, mode: SiteMode) {
  const r = await fetch(`${WORKER_URL}/admin/site`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, ...(await approve(sign, address, `site-mode:${mode}`)) }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Could not change the mode.');
  cached = mode;
  return j as { mode: SiteMode };
}

export async function fetchWaitlist(sign: Signer, address: string) {
  const r = await fetch(`${WORKER_URL}/admin/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await approve(sign, address, 'waitlist')) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Could not load the waitlist.');
  return j as { count: number; list: WaitEntry[] };
}

export type WaitEntry = { email: string; at: number; status?: 'pending' | 'approved' };

/** Approve (or revoke) an email; approved emails can play once they sign in with that Google account. */
export async function setApproval(sign: Signer, address: string, email: string, approved: boolean) {
  const r = await fetch(`${WORKER_URL}/admin/waitlist/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, approved, ...(await approve(sign, address, `approve:${email}:${approved}`)) }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Could not update that email.');
  return j as { email: string; status: 'pending' | 'approved'; emailed?: boolean; emailError?: string };
}

export async function fetchWaitlistCount(): Promise<number> {
  try { return ((await (await fetch(`${WORKER_URL}/admin/waitlist/count`)).json()) as { count: number }).count; } catch { return 0; }
}

const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export function waitlistCsv(list: WaitEntry[]): string {
  return ['email,joined,status', ...list.map((e) => `${cell(e.email)},${new Date(e.at).toISOString()},${e.status ?? 'pending'}`)].join('\n');
}

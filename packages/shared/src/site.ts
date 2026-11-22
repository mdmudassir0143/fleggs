/** The exact text the admin signs to approve an action (the app and the Worker must agree). */
export const adminMessage = (action: string, ts: number) => `Flurry Eggs admin: ${action} at ${ts}`;
export type SiteMode = 'open' | 'waitlist';

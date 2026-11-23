/** Transactional email via Resend, and the "you're in" message sent when the admin approves someone. */
const SITE = 'https://www.fleggs.online/';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function approvalEmail({ email }: { email: string }) {
  const e = esc(email);
  const subject = 'You’re in! Your Flurry Eggs egg is waiting';
  const font = "font-family:'Fredoka','Trebuchet MS',Arial,sans-serif";
  const body = "font-family:'Figtree','Segoe UI',Arial,sans-serif";
  const step = (n: string, title: string, line: string) => `
    <tr><td style="padding:6px 0;vertical-align:top;width:34px"><div style="width:26px;height:26px;border-radius:13px;background:#FFE8D6;border:2px solid #14213D;text-align:center;line-height:26px;${font};font-weight:700;font-size:14px;color:#14213D">${n}</div></td>
    <td style="padding:6px 0;${body};font-size:15px;line-height:1.45;color:#3A4766"><b style="color:#14213D">${title}</b><br>${line}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#DCEEFB">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">You’re approved. Sign in with this Google account and start warming your egg.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#DCEEFB"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:3px solid #14213D;border-radius:24px;overflow:hidden">
    <tr><td><a href="${SITE}"><img src="https://www.fleggs.online/email-hero.jpg" width="560" alt="Flurry Eggs: your egg is ready to hatch" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
    <tr><td style="padding:28px 28px 8px">
      <h1 style="margin:0 0 10px;${font};font-weight:700;font-size:30px;line-height:1.15;color:#14213D">You’re in!</h1>
      <p style="margin:0 0 20px;${body};font-size:16px;line-height:1.55;color:#3A4766">Good news: <b style="color:#14213D">${e}</b> is approved for Flurry Eggs. Sign in with this Google account and your first egg will be waiting.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#E8642C;border:3px solid #14213D">
        <a href="${SITE}" style="display:inline-block;padding:13px 34px;${font};font-weight:700;font-size:18px;color:#ffffff;text-decoration:none">Play now</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:18px 28px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${step('1', 'Warm your egg', 'Three 30-second stages: calm, wind, then a blizzard.')}
        ${step('2', 'Hatch your yeti', 'A one-of-a-kind yeti on Sui, with its own name and story.')}
        ${step('3', 'Train, merge and earn', 'Level it up, then sell, list or stake it for real SUI.')}
      </table>
    </td></tr>
    <tr><td style="padding:18px 28px 26px;${body};font-size:12px;line-height:1.5;color:#5A6480;border-top:2px solid #EEF3FA">
      You’re getting this because you joined the Flurry Eggs waitlist. A fan-made game inspired by Lofi the Yeti.<br>
      <a href="https://x.com/Flurry_eggs" style="color:#1F4FA0">@Flurry_eggs on X</a> · <a href="https://www.fleggs.online/privacy.html" style="color:#1F4FA0">Privacy</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = `You're in!

Good news: ${email} is approved for Flurry Eggs. Sign in with this Google account and your first egg will be waiting.

Play now: ${SITE}

1. Warm your egg: three 30-second stages (calm, wind, blizzard).
2. Hatch your yeti: one of a kind, on Sui.
3. Train, merge and earn real SUI.

You're getting this because you joined the Flurry Eggs waitlist. A fan-made game inspired by Lofi the Yeti.
X: https://x.com/Flurry_eggs · Privacy: https://www.fleggs.online/privacy.html`;
  return { subject, html, text };
}

export async function sendEmail(
  cfg: { apiKey: string; from: string; fetch?: typeof fetch },
  msg: { to: string; subject: string; html: string; text: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const r = await (cfg.fetch ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    const j = (await r.json()) as { id?: string; message?: string };
    return r.ok && j.id ? { ok: true, id: j.id } : { ok: false, error: j.message ?? `Resend error ${r.status}` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

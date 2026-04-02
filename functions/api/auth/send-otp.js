/**
 * POST /api/auth/send-otp
 * Sends a 6-digit sign-in code via Resend. Rate-limited to 1/60s per email.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Valid email required.' }, 400);
  }

  // Rate limit: 1 OTP per 60s per email
  const rateKey = `otp_rate:${email}`;
  const recentlySent = await env.DEMO_SESSIONS.get(rateKey);
  if (recentlySent) {
    return json({ error: 'Code already sent. Wait 60 seconds before trying again.' }, 429);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpKey = `otp:${email}`;

  await Promise.all([
    env.DEMO_SESSIONS.put(otpKey, code, { expirationTtl: 600 }),       // 10 min
    env.DEMO_SESSIONS.put(rateKey, '1', { expirationTtl: 60 }),        // 60s rate limit
  ]);

  const sent = await sendEmail(env, email, code);
  if (!sent) return json({ error: 'Failed to send email. Please try again.' }, 500);

  return json({ ok: true });
}

async function sendEmail(env, email, code) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@2nth.ai',
        to: email,
        subject: `${code} — your 2nth demo access code`,
        html: `
          <div style="font-family:'Courier New',monospace;background:#0a0a0a;color:#fafafa;padding:40px;max-width:480px;margin:0 auto;border-radius:6px">
            <div style="font-size:24px;font-weight:700;letter-spacing:2px;margin-bottom:8px;color:#06b6d4">2NTH DEMOS</div>
            <div style="font-size:12px;color:#52525b;letter-spacing:1px;margin-bottom:32px">AI DEMONSTRATION SUITE</div>
            <div style="font-size:13px;color:#a1a1aa;margin-bottom:16px">Your sign-in code:</div>
            <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#fafafa;margin-bottom:32px">${code}</div>
            <div style="font-size:12px;color:#52525b">Expires in 10 minutes. If you didn't request this, ignore this email.</div>
          </div>`,
      }),
    });
    return res.ok;
  } catch { return false; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

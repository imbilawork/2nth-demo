/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit code, creates/loads user, sets session cookie.
 * New users get role:'registered' with no demo access by default.
 * craig@2nth.ai is auto-promoted to admin.
 */

const SESSION_COOKIE = 'demo_session';
const SESSION_TTL    = 60 * 60 * 24 * 7;   // 7 days
const ADMIN_EMAILS   = ['craig@2nth.ai', 'craig@imbila.ai'];

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function randomToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return hex(buf.buffer);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const code  = (body.code  || '').trim();

  if (!email || !code) return json({ error: 'Email and code required.' }, 400);

  const otpKey    = `otp:${email}`;
  const stored    = await env.DEMO_SESSIONS.get(otpKey);

  if (!stored || stored !== code) {
    return json({ error: 'Invalid or expired code.' }, 401);
  }

  // Consume OTP
  await env.DEMO_SESSIONS.delete(otpKey);

  // Load or create user
  const userKey = `user:${email}`;
  let user;
  const existing = await env.DEMO_SESSIONS.get(userKey);

  if (existing) {
    user = JSON.parse(existing);
  } else {
    user = {
      email,
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'registered',
      demos: [],
      created_at: new Date().toISOString(),
    };
    await env.DEMO_SESSIONS.put(userKey, JSON.stringify(user));
  }

  // Create session
  const token = await randomToken();
  await env.DEMO_SESSIONS.put(
    `session:${token}`,
    JSON.stringify(user),
    { expirationTtl: SESSION_TTL }
  );

  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL}`,
  ].join('; ');

  return json({ ok: true, user: { email: user.email, role: user.role, demos: user.demos } }, 200, {
    'Set-Cookie': cookie,
  });
}

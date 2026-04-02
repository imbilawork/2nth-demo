/**
 * POST /api/auth/request-access
 * Body: { demo: 'erica', message?: 'optional note' }
 * Stores request in KV and sends notification email to admin.
 */

const SESSION_COOKIE = 'demo_session';

function getCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const token = getCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  if (!token) return json({ error: 'Not authenticated.' }, 401);

  let user;
  try {
    const raw = await env.DEMO_SESSIONS.get(`session:${token}`);
    if (!raw) return json({ error: 'Session expired.' }, 401);
    user = JSON.parse(raw);
  } catch {
    return json({ error: 'Session error.' }, 500);
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const demo    = (body.demo    || '').trim().toLowerCase();
  const message = (body.message || '').trim().slice(0, 500);

  if (!demo) return json({ error: 'Demo slug required.' }, 400);

  // Store request
  const reqKey = `access_request:${user.email}:${demo}`;
  await env.DEMO_SESSIONS.put(reqKey, JSON.stringify({
    email: user.email,
    demo,
    message,
    requested_at: new Date().toISOString(),
  }), { expirationTtl: 60 * 60 * 24 * 30 }); // 30 days

  // Notify admin
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@2nth.ai',
      to: 'craig@2nth.ai',
      subject: `Demo access request: ${demo} — ${user.email}`,
      html: `
        <div style="font-family:monospace;padding:24px">
          <h2>Demo Access Request</h2>
          <p><strong>User:</strong> ${user.email}</p>
          <p><strong>Demo:</strong> ${demo}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p>To grant access, add "${demo}" to the user's demos array in KV:<br>
          Key: <code>user:${user.email}</code></p>
        </div>`,
    }),
  }).catch(() => {});

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

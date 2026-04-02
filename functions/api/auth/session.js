/**
 * GET /api/auth/session
 * Returns current user from session cookie, or { user: null }.
 */

const SESSION_COOKIE = 'demo_session';

function getCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = getCookie(request.headers.get('Cookie'), SESSION_COOKIE);

  if (!token) return json({ user: null });

  try {
    const raw = await env.DEMO_SESSIONS.get(`session:${token}`);
    if (!raw) return json({ user: null });
    const user = JSON.parse(raw);
    return json({ user: { email: user.email, role: user.role, demos: user.demos } });
  } catch {
    return json({ user: null });
  }
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

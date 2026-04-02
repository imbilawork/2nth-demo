/**
 * POST /api/auth/logout
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
  if (token) await env.DEMO_SESSIONS.delete(`session:${token}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    },
  });
}

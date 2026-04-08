/**
 * 2nth Demo — auth middleware
 * Gates every page except /signin.html and /api/*
 * Per-demo access: checks user.demos array or user.role === 'admin'
 */

const SESSION_COOKIE = 'demo_session';

// Demos open to any signed-in user (null = open)
// Demos with an array = restricted to those email domains or explicit emails
const DEMO_ACCESS = {
  '/wellness.html':                 null,
  '/meeting-agent.html':            null,
  '/erica.html':                    'client',
  '/silvergro.html':                'client',
  '/silvergro-architecture.html':   'client',
  '/silvergro-feedstock.html':      'client',
  '/karan-beef.html':               'client',
};

function getCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Always allow: sign-in page, API routes, static assets, and public demos
  const PUBLIC_PAGES = ['/spinscience.html'];
  if (
    path === '/signin.html' || path === '/signin' ||
    path.startsWith('/api/') ||
    path.match(/\.(css|js|svg|png|jpg|ico|woff2?|ttf)$/) ||
    PUBLIC_PAGES.includes(path)
  ) {
    return next();
  }

  // Check session
  const token = getCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  let user = null;

  if (token) {
    try {
      const raw = await env.DEMO_SESSIONS.get(`session:${token}`);
      if (raw) user = JSON.parse(raw);
    } catch {}
  }

  // No session → redirect to sign-in
  if (!user) {
    const returnUrl = encodeURIComponent(path + url.search);
    return Response.redirect(`${url.origin}/signin?return=${returnUrl}`, 302);
  }

  // Per-demo access check
  const accessRule = DEMO_ACCESS[path];
  if (accessRule !== undefined && accessRule !== null) {
    // 'client' rule: user must have this demo explicitly granted or be admin
    const slug = path.replace('/', '').replace('.html', '');
    const hasAccess =
      user.role === 'admin' ||
      (Array.isArray(user.demos) && user.demos.includes(slug));

    if (!hasAccess) {
      return Response.redirect(`${url.origin}/?denied=${encodeURIComponent(slug)}`, 302);
    }
  }

  return next();
}

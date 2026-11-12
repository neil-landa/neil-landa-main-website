// Admin check for /api/manage/*.
// Static Web Apps signs the visitor in (GitHub) and passes who they are in x-ms-client-principal.
// Only the accounts listed in the ADMIN_USERS app setting (comma-separated GitHub usernames) are allowed.

function getPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return principal && Array.isArray(principal.userRoles) ? principal : null;
  } catch {
    return null;
  }
}

function adminList() {
  return (process.env.ADMIN_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Returns { user } when allowed, or { response } to send back.
function requireAdmin(request) {
  const deny = (status, error, extra) => ({ response: { status, jsonBody: { error, ...extra }, headers: { 'Cache-Control': 'no-store' } } });

  // Custom header blocks cross-site form posts (browsers will not send it without CORS approval).
  if (request.headers.get('x-requested-with') !== 'admin') return deny(400, 'Bad request.');

  const principal = getPrincipal(request);
  if (!principal || !principal.userRoles.includes('authenticated')) return deny(401, 'Please sign in.');

  const user = String(principal.userDetails || '').toLowerCase();
  if (principal.identityProvider !== 'github' || !user || !adminList().includes(user)) {
    return deny(403, 'This account is not allowed to edit the site.', { user: principal.userDetails || '' });
  }
  return { user: principal.userDetails };
}

module.exports = { requireAdmin };

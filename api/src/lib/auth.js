// Admin check for /api/manage/*.
// The visitor signs in with Microsoft (Static Web Apps built-in "aad" provider). Every admin call then
// checks that the signed-in account is a member of the Entra group in the ADMIN_GROUP_ID app setting.
// The Free plan cannot read group claims at sign-in, so membership is read from Microsoft Graph using
// the app registration "neillanda-admin-check" (ADMIN_TENANT_ID / ADMIN_CLIENT_ID / ADMIN_CLIENT_SECRET,
// application permissions GroupMember.Read.All and User.ReadBasic.All).

const CACHE_MS = 5 * 60 * 1000;
let token = { value: '', expires: 0 };
let members = { set: null, expires: 0 };

const config = () => ({
  groupId: (process.env.ADMIN_GROUP_ID || '').trim(),
  tenantId: (process.env.ADMIN_TENANT_ID || '').trim(),
  clientId: (process.env.ADMIN_CLIENT_ID || '').trim(),
  clientSecret: (process.env.ADMIN_CLIENT_SECRET || '').trim()
});

// Static Web Apps passes the signed-in user as base64 JSON. It cannot be forged from outside.
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

// fresh = true skips the cache, so permissions granted a moment ago take effect at once.
async function graphToken(c, fresh) {
  if (!fresh && token.value && Date.now() < token.expires) return token.value;
  const res = await fetch(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Graph token HTTP ${res.status}`);
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + (data.expires_in - 120) * 1000 };
  return token.value;
}

// Every sign-in name a group member can show up as.
// A personal Microsoft account (e.g. a Gmail address) is stored in the directory as
// "name_gmail.com#EXT#@tenant.onmicrosoft.com", so that form is turned back into the email address.
function namesFor(user) {
  const names = [];
  const add = (v) => { if (v) names.push(String(v).toLowerCase()); };
  add(user.id);
  add(user.userPrincipalName);
  add(user.mail);
  const ext = /^(.+)#EXT#@/i.exec(user.userPrincipalName || '');
  if (ext) {
    const at = ext[1].lastIndexOf('_');
    if (at > 0) add(`${ext[1].slice(0, at)}@${ext[1].slice(at + 1)}`);
  }
  return names;
}

// Everyone in the group, nested groups included.
async function groupMembers(c, fresh) {
  if (!fresh && members.set && Date.now() < members.expires) return members.set;
  const bearer = await graphToken(c, fresh);
  const set = new Set();
  let total = 0;
  let named = 0;
  let url = `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(c.groupId)}/transitiveMembers/microsoft.graph.user?$select=id,userPrincipalName,mail&$top=999`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Graph members HTTP ${res.status}`);
    const data = await res.json();
    for (const user of data.value || []) {
      total++;
      if (user.userPrincipalName) named++;
      for (const name of namesFor(user)) set.add(name);
    }
    url = data['@odata.nextLink'] || '';
  }
  set.total = total;
  set.named = named;
  members = { set, expires: Date.now() + CACHE_MS };
  return set;
}

const claim = (principal, ...types) => {
  for (const c of principal.claims || []) if (types.includes(c.typ)) return String(c.val || '').toLowerCase();
  return '';
};

// Returns { user } when allowed, or { response } to send back. Fails closed.
async function requireAdmin(request, context) {
  const deny = (status, error, extra) => ({ response: { status, jsonBody: { error, ...extra }, headers: { 'Cache-Control': 'no-store' } } });

  // Custom header blocks cross-site form posts (browsers will not send it without CORS approval).
  if (request.headers.get('x-requested-with') !== 'admin') return deny(400, 'Bad request.');

  const principal = getPrincipal(request);
  if (!principal || !principal.userRoles.includes('authenticated') || principal.identityProvider !== 'aad' || !principal.userDetails) {
    return deny(401, 'Please sign in with your Microsoft account.');
  }

  const c = config();
  if (!c.groupId || !c.tenantId || !c.clientId || !c.clientSecret) {
    context.error('Admin check is not configured (ADMIN_* settings missing)');
    return deny(503, 'Admin access is not set up yet. The ADMIN_* settings are missing in Azure.');
  }

  const keys = [String(principal.userDetails).toLowerCase()];
  // A directory object id only counts when the sign-in came from this tenant.
  const oid = claim(principal, 'http://schemas.microsoft.com/identity/claims/objectidentifier', 'oid');
  const tid = claim(principal, 'http://schemas.microsoft.com/identity/claims/tenantid', 'tid');
  if (oid && tid === c.tenantId.toLowerCase()) keys.push(oid);

  try {
    const hit = (set) => keys.some((k) => set.has(k));
    let set = await groupMembers(c, false);
    // Not in the cached list: read the group once more, so someone just added gets in right away.
    if (!hit(set)) set = await groupMembers(c, true);
    if (!hit(set)) {
      return deny(403, 'This account is not in the Website Admins group.', {
        user: principal.userDetails,
        detail: `Group has ${set.total} member(s); sign-in names readable for ${set.named}.`
      });
    }
  } catch (err) {
    context.error('Admin group check failed: ' + err.message);
    const notConsented = /HTTP 403/.test(err.message);
    return deny(503, notConsented
      ? 'The admin check app has not been granted its Microsoft Graph permissions yet (admin consent).'
      : 'Could not verify admin access. Please try again.');
  }
  return { user: principal.userDetails };
}

module.exports = { requireAdmin, namesFor };

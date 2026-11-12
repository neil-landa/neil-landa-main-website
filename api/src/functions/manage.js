// /api/manage/* — admin-only endpoints behind the /admin/ panel.
const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { requireAdmin } = require('../lib/auth');
const { defaults, imageContainer, loadContent, saveContent, settings } = require('../lib/store');

const json = (status, body) => ({ status, jsonBody: body, headers: { 'Cache-Control': 'no-store' } });

function guarded(handler) {
  return async (request, context) => {
    const auth = requireAdmin(request);
    if (auth.response) return auth.response;
    try {
      return await handler(request, context, auth.user);
    } catch (err) {
      context.error('manage failed', err.message);
      return json(err.statusCode && err.statusCode < 500 ? err.statusCode : 500, { error: err.statusCode ? err.message : 'Something went wrong. Please try again.' });
    }
  };
}

/* ---------- Content ---------- */
app.http('manageContent', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'manage/content',
  handler: guarded(async (request, context, user) => {
    if (request.method === 'GET') {
      return json(200, { content: await loadContent({ fresh: true }), defaults, settings: settings(), user });
    }
    let body;
    try { body = JSON.parse(await request.text()); } catch { return json(400, { error: 'Invalid request.' }); }
    if (!body || typeof body.content !== 'object' || Array.isArray(body.content)) return json(400, { error: 'Invalid content.' });
    const saved = await saveContent(body.content, user);
    context.log(`content saved by ${user}`);
    return json(200, { ok: true, content: saved });
  })
});

/* ---------- Image uploads ---------- */
const KINDS = { work: 'work', logo: 'brand', portrait: 'profile' };
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function sniff(buffer) {
  if (buffer.length > 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer.toString('latin1', 1, 4) === 'PNG') return { ext: 'png', type: 'image/png' };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  const head = buffer.toString('utf8', 0, Math.min(buffer.length, 2000)).trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(head)) return { ext: 'svg', type: 'image/svg+xml' };
  return null;
}

const UNSAFE_SVG = /<script|<foreignObject|<iframe|<embed|<object|\son\w+\s*=|javascript:|data:text\/html/i;

app.http('manageUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/upload',
  handler: guarded(async (request) => {
    let body;
    try { body = JSON.parse(await request.text()); } catch { return json(400, { error: 'Invalid request.' }); }
    const folder = KINDS[body && body.kind];
    if (!folder || !Array.isArray(body.files) || !body.files.length || body.files.length > 3) return json(400, { error: 'Invalid upload.' });

    const slug = String(body.name || folder).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || folder;
    const stamp = Date.now().toString(36);
    const container = imageContainer();
    const urls = {};

    for (const file of body.files) {
      const suffix = String(file.suffix || 'full').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'full';
      const buffer = Buffer.from(String(file.data || ''), 'base64');
      if (!buffer.length || buffer.length > MAX_FILE_BYTES) return json(400, { error: 'That image is too large (3 MB max).' });
      const kind = sniff(buffer);
      if (!kind) return json(400, { error: 'Use a PNG, JPG, WebP, or SVG image.' });
      if (kind.ext === 'svg' && (body.kind !== 'logo' || UNSAFE_SVG.test(buffer.toString('utf8')))) {
        return json(400, { error: 'That SVG contains scripts or embedded content and cannot be used.' });
      }
      const path = `${folder}/${slug}-${stamp}-${suffix}.${kind.ext}`;
      await container.getBlockBlobClient(path).uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: kind.type, blobCacheControl: 'public, max-age=31536000, immutable' }
      });
      urls[suffix] = `/api/img/${path}`;
    }
    return json(200, { ok: true, urls });
  })
});

/* ---------- Contact form messages ---------- */
app.http('manageMessages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/messages',
  handler: guarded(async () => {
    const table = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, process.env.CONTACT_TABLE_NAME || 'ContactMessages');
    const messages = [];
    try {
      for await (const e of table.listEntities()) {
        messages.push({ submittedAt: e.submittedAt, name: e.name, business: e.business, email: e.email, phone: e.phone, service: e.service, budget: e.budget, message: e.message });
        if (messages.length >= 500) break;
      }
    } catch (err) {
      if (err.statusCode !== 404) throw err; // No table yet means no messages yet.
    }
    messages.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    return json(200, { messages: messages.slice(0, 200) });
  })
});

// POST /api/contact — validates a contact form submission and stores it in Table Storage.
const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const crypto = require('node:crypto');

const SERVICES = ['website', 'azure', 'it', 'other'];
const BUDGETS = ['2500-5000', '5000-10000', '10000+', 'unsure'];
const LIMITS = { name: 100, business: 120, email: 200, phone: 40, message: 2000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

let tablePromise;
function getTable() {
  if (!tablePromise) {
    const client = TableClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
      process.env.CONTACT_TABLE_NAME || 'ContactMessages'
    );
    tablePromise = client.createTable().then(() => client).catch((err) => { tablePromise = null; throw err; });
  }
  return tablePromise;
}

const json = (status, body) => ({ status, jsonBody: body, headers: { 'Cache-Control': 'no-store' } });
const clean = (value) => (typeof value === 'string' ? value.replace(CONTROL_CHARS, '').trim() : '');

app.http('contact', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: async (request, context) => {
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 10000) return json(413, { error: 'That message is too long.' });
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: 'Invalid request.' });
    }
    if (!body || typeof body !== 'object') return json(400, { error: 'Invalid request.' });

    // Bots fill the hidden field or submit instantly. Report success, store nothing.
    if (clean(body.website) || !(Number(body.elapsedMs) > 2500)) return json(200, { ok: true });

    const entry = {
      name: clean(body.name), business: clean(body.business), email: clean(body.email),
      phone: clean(body.phone), service: clean(body.service), budget: clean(body.budget), message: clean(body.message)
    };

    for (const [field, max] of Object.entries(LIMITS)) {
      if (entry[field].length > max) return json(400, { error: `The ${field} field is too long.` });
    }
    if (!entry.name || !entry.business) return json(400, { error: 'Please enter your name and business name.' });
    if (!EMAIL.test(entry.email)) return json(400, { error: 'Please enter a valid email address.' });
    if (!SERVICES.includes(entry.service)) return json(400, { error: 'Please choose what you need.' });
    if (!BUDGETS.includes(entry.budget)) return json(400, { error: 'Please choose a budget.' });
    if (entry.message.length < 10) return json(400, { error: 'Please tell me a little about your project.' });

    const now = new Date();
    try {
      const table = await getTable();
      await table.createEntity({
        partitionKey: now.toISOString().slice(0, 7),
        // Reverse-chronological so the newest messages list first.
        rowKey: `${String(9999999999999 - now.getTime()).padStart(13, '0')}-${crypto.randomBytes(4).toString('hex')}`,
        submittedAt: now.toISOString(),
        status: 'new',
        ...entry
      });
    } catch (err) {
      context.error('contact save failed', err.message);
      return json(500, { error: 'Your message could not be sent. Please try again in a moment.' });
    }
    return json(200, { ok: true });
  }
});

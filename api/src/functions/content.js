// GET /api/content — the public site content plus display settings.
const { app } = require('@azure/functions');
const { loadContent, settings, etagOf } = require('../lib/store');

app.http('content', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'content',
  handler: async (request, context) => {
    try {
      const body = JSON.stringify({ content: await loadContent(), settings: settings() });
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etagOf(body) };
      if (request.headers.get('if-none-match') === headers.ETag) return { status: 304, headers };
      return { status: 200, headers, body };
    } catch (err) {
      context.error('content load failed', err.message);
      return { status: 503, jsonBody: { error: 'Content is unavailable.' }, headers: { 'Cache-Control': 'no-store' } };
    }
  }
});

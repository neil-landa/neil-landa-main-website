// GET /api/img/{path} — serves images from the private blob container.
// The container is derived from BLOB_BASE_URL; access uses AZURE_STORAGE_CONNECTION_STRING.
const { app } = require('@azure/functions');
const { imageContainer } = require('../lib/store');

const SAFE_PATH = /^[a-z0-9][a-z0-9/_-]*\.(webp|png|jpe?g|svg|avif)$/;

app.http('img', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  route: 'img/{*path}',
  handler: async (request, context) => {
    const path = (request.params.path || '').toLowerCase();
    if (!SAFE_PATH.test(path) || path.includes('//')) return { status: 404 };

    try {
      const blob = imageContainer().getBlobClient(path);
      const props = await blob.getProperties();
      const headers = {
        'Content-Type': props.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': props.etag,
        'X-Content-Type-Options': 'nosniff'
      };
      // An SVG opened directly must never run scripts on this site's origin.
      if (path.endsWith('.svg')) headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      if (request.headers.get('if-none-match') === props.etag) return { status: 304, headers };
      if (request.method === 'HEAD') return { status: 200, headers };
      return { status: 200, headers, body: await blob.downloadToBuffer() };
    } catch (err) {
      if (err.statusCode === 404) return { status: 404 };
      context.error('img failed', err.message);
      return { status: 502 };
    }
  }
});

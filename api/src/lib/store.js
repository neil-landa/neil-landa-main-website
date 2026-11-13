// Shared storage helpers: site content (JSON blob), images, and settings from app settings.
const crypto = require('node:crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const defaults = require('./default-content.json');

const CONTENT_BLOB = 'content.json';
const MAX_BACKUPS = 40;
const CACHE_MS = 5000;

let service;
function getService() {
  if (!service) service = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  return service;
}

// Images live in the container named by BLOB_BASE_URL (mainimgs).
function imageContainer() {
  const name = new URL(process.env.BLOB_BASE_URL).pathname.split('/').filter(Boolean)[0];
  return getService().getContainerClient(name);
}

// Site content lives in its own private container.
function dataContainer() {
  return getService().getContainerClient(process.env.CONTENT_CONTAINER || 'sitedata');
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Saved content wins; defaults fill any key that is missing. Arrays are replaced whole.
function merge(base, over) {
  if (over === undefined || over === null) return base;
  if (isObject(base) && isObject(over)) {
    const out = { ...base };
    for (const key of Object.keys(over)) out[key] = key in base ? merge(base[key], over[key]) : over[key];
    return out;
  }
  if (Array.isArray(base) !== Array.isArray(over) || isObject(base) !== isObject(over)) return base;
  return over;
}

// Keep only plain JSON with sane limits.
function sanitize(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === 'string') return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 6000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((v) => sanitize(v, depth + 1)).filter((v) => v !== null && v !== undefined);
  if (isObject(value)) {
    const out = {};
    for (const key of Object.keys(value).slice(0, 80)) {
      if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key)) continue;
      const v = sanitize(value[key], depth + 1);
      if (v !== null && v !== undefined) out[key] = v;
    }
    return out;
  }
  return null;
}

let cache = { at: 0, value: null };

async function loadContent({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value;
  try {
    const buffer = await dataContainer().getBlockBlobClient(CONTENT_BLOB).downloadToBuffer();
    value = merge(defaults, JSON.parse(buffer.toString('utf8')));
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    value = defaults; // Nothing saved yet.
  }
  cache = { at: Date.now(), value };
  return value;
}

async function saveContent(content, savedBy) {
  const clean = merge(defaults, sanitize(content));
  const body = JSON.stringify(clean, null, 2);
  if (Buffer.byteLength(body) > 400000) throw Object.assign(new Error('Content is too large.'), { statusCode: 413 });

  const container = dataContainer();
  await container.createIfNotExists();
  const options = { blobHTTPHeaders: { blobContentType: 'application/json' }, metadata: { savedby: encodeURIComponent(savedBy || '') } };
  await container.getBlockBlobClient(CONTENT_BLOB).upload(body, Buffer.byteLength(body), options);

  // Keep a dated copy of every save, and trim old ones.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await container.getBlockBlobClient(`backups/content-${stamp}.json`).upload(body, Buffer.byteLength(body), options);
  try {
    const names = [];
    for await (const blob of container.listBlobsFlat({ prefix: 'backups/' })) names.push(blob.name);
    names.sort();
    for (const name of names.slice(0, Math.max(0, names.length - MAX_BACKUPS))) await container.deleteBlob(name);
  } catch { /* trimming is best-effort */ }

  cache = { at: Date.now(), value: clean };
  return clean;
}

function settings() {
  return {
    showPortrait: /^(1|true|yes|on)$/i.test((process.env.SHOW_PORTRAIT || '').trim()),
    // The Turnstile site key is public; the form only shows the check when both keys are set.
    turnstileSiteKey: process.env.CF_TURNSTILE_SECRET_KEY ? (process.env.CF_TURNSTILE_SITEKEY || '').trim() : ''
  };
}

const etagOf = (text) => `"${crypto.createHash('sha1').update(text).digest('hex')}"`;

module.exports = { defaults, imageContainer, loadContent, saveContent, settings, etagOf };

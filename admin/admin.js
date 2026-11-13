/* Site admin: edits the content JSON behind the public page. */
(function () {
  'use strict';

  var state = { content: null, defaults: null, settings: {}, user: '', dirty: false, section: 'brand' };
  var $ = function (s, el) { return (el || document).querySelector(s); };

  /* ---------- Section definitions (what can be edited, and how) ---------- */
  var T = function (key, label, extra) { return Object.assign({ key: key, label: label, type: 'text' }, extra || {}); };
  var A = function (key, label, extra) { return Object.assign({ key: key, label: label, type: 'textarea', full: true }, extra || {}); };
  var heading = function (prefix) {
    return [T(prefix + '.eyebrow', 'Small label above the heading'), T(prefix + '.title', 'Heading (white part)'), T(prefix + '.titleDim', 'Heading (grey part)')];
  };

  var SECTIONS = [
    {
      id: 'brand', title: 'Brand & logo', keys: ['brand', 'seo', 'footer'],
      intro: 'Your logo, name, and the details shared across the whole site.',
      groups: [
        { title: 'Logo', fields: [{ key: 'brand.logo', type: 'image', kind: 'logo', label: 'Logo', full: true, help: 'SVG (best) or a PNG with a transparent background. Used in the header, footer, and browser tab.' }] },
        { title: 'Name and buttons', fields: [T('brand.name', 'Name shown next to the logo'), T('brand.ctaLabel', 'Main button label'), T('brand.portalLabel', 'Client portal link label'), T('brand.portalUrl', 'Client portal link', { type: 'url' })] },
        { title: 'Search engines', fields: [T('seo.title', 'Page title', { full: true }), A('seo.description', 'Page description')] },
        { title: 'Footer', fields: [T('footer.giant', 'Giant footer text'), T('footer.copyright', 'Copyright line')] }
      ]
    },
    {
      id: 'hero', title: 'Hero', keys: ['hero'],
      intro: 'The first screen visitors see.',
      groups: [
        { title: 'Headline', fields: [T('hero.pill', 'Small label above the headline', { full: true }), { key: 'hero.lines', type: 'strings', label: 'Headline lines (white)', full: true, itemName: 'line' }, T('hero.dimLine', 'Last headline line (grey)', { full: true }), A('hero.lede', 'Intro paragraph'), T('hero.primaryLabel', 'Blue button label'), T('hero.secondaryLabel', 'Second button label')] },
        { title: 'Portrait', portraitNote: true, fields: [{ key: 'hero.portrait', type: 'image', kind: 'portrait', label: 'Your photo', full: true, help: 'Any portrait photo. It is cropped to 4:5 automatically.' }, T('hero.plateName', 'Name on the photo'), T('hero.plateRole', 'Title under the name'), { key: 'hero.chips', type: 'strings', label: 'Floating labels around the photo (up to 4)', full: true, itemName: 'label', max: 4 }] }
      ]
    },
    {
      id: 'stats', title: 'Stats & banner', keys: ['stats', 'marquee', 'statement'],
      intro: 'The numbers under the hero, the scrolling banner, and the large statement below it.',
      groups: [
        { title: 'Stats', fields: [{ key: 'stats', type: 'list', label: 'Stats', full: true, itemName: 'stat', titleKey: 'label', max: 4, fields: [T('value', 'Number'), T('suffix', 'After the number (e.g. +)'), T('label', 'Caption', { full: true })] }] },
        { title: 'Scrolling banner', fields: [{ key: 'marquee', type: 'strings', label: 'Words', full: true, itemName: 'word' }] },
        { title: 'Statement', fields: [T('statement.eyebrow', 'Small label', { full: true }), A('statement.text', 'Statement text')] }
      ]
    },
    {
      id: 'services', title: 'Services', keys: ['services'],
      intro: 'The 01 / 02 / 03 cards: numbers, titles, text, and bullet points.',
      groups: [
        { title: 'Heading', fields: heading('services') },
        { title: 'Service cards', fields: [{ key: 'services.cards', type: 'list', label: 'Cards', full: true, itemName: 'service', titleKey: 'title', numKey: 'num', fields: [T('num', 'Number (e.g. 01)'), T('title', 'Title'), A('text', 'Short description'), { key: 'bullets', type: 'strings', label: 'Bullet points', full: true, itemName: 'bullet' }, T('badge', 'Badge at the bottom', { help: 'Wrap text in **two asterisks** to make it bold.' }), { key: 'highlight', type: 'check', label: 'Highlight this card in blue' }] }] }
      ]
    },
    {
      id: 'work', title: 'Websites', keys: ['work'],
      intro: 'Your portfolio. Add a site, upload a screenshot, and it appears in the gallery in the same style as the rest.',
      groups: [
        { title: 'Heading', fields: heading('work').concat([T('work.ctaTitle', 'Text on the last card', { full: true })]) },
        { title: 'Websites', fields: [{ key: 'work.sites', type: 'list', label: 'Websites', full: true, itemName: 'website', titleKey: 'name', thumbKey: 'imageSmall', fields: [T('name', 'Business name'), T('url', 'Website address', { type: 'url', placeholder: 'https://example.com/' }), T('meta', 'Industry and location', { placeholder: 'HVAC · Dallas–Fort Worth, TX' }), T('tag', 'Badge (optional)', { placeholder: 'Built on Azure' }), A('text', 'One-sentence description'), { key: 'image', type: 'shot', label: 'Screenshot', full: true, help: 'Upload a screenshot of the homepage. It is cropped to 16:10 from the top and resized for you.' }] }] }
      ]
    },
    {
      id: 'about', title: 'About', keys: ['about'],
      intro: 'Your story, buttons, and certifications.',
      groups: [
        { title: 'Heading', fields: heading('about') },
        { title: 'Text', fields: [{ key: 'about.paragraphs', type: 'strings', label: 'Paragraphs', full: true, itemName: 'paragraph', multiline: true }, { key: 'about.buttons', type: 'list', label: 'Buttons', full: true, itemName: 'button', titleKey: 'label', max: 3, fields: [T('label', 'Label'), T('url', 'Link', { type: 'url' })] }] },
        { title: 'Certifications', fields: [T('about.certsTitle', 'Card title', { full: true }), { key: 'about.certs', type: 'list', label: 'Certifications', full: true, itemName: 'certification', titleKey: 'name', fields: [T('issuer', 'Issuer'), T('name', 'Certification')] }] }
      ]
    },
    {
      id: 'process', title: 'How it works', keys: ['process'],
      intro: 'The numbered steps.',
      groups: [
        { title: 'Heading', fields: heading('process') },
        { title: 'Steps', fields: [{ key: 'process.steps', type: 'list', label: 'Steps', full: true, itemName: 'step', titleKey: 'title', numKey: 'num', max: 4, fields: [T('num', 'Number'), T('title', 'Title'), A('text', 'Description')] }] }
      ]
    },
    {
      id: 'faq', title: 'FAQ', keys: ['faq'],
      intro: 'Questions and answers. Wrap text in **two asterisks** to make it bold.',
      groups: [
        { title: 'Heading', fields: heading('faq').concat([T('faq.intro', 'Line under the heading'), T('faq.introLink', 'Link text')]) },
        { title: 'Questions', fields: [{ key: 'faq.items', type: 'list', label: 'Questions', full: true, itemName: 'question', titleKey: 'q', fields: [T('q', 'Question', { full: true }), A('a', 'Answer')] }] }
      ]
    },
    {
      id: 'contact', title: 'Contact', keys: ['contact'],
      intro: 'The text beside the contact form.',
      groups: [
        { title: 'Heading', fields: [T('contact.eyebrow', 'Small label', { full: true }), { key: 'contact.lines', type: 'strings', label: 'Heading lines (white)', full: true, itemName: 'line' }, T('contact.dimLine', 'Last heading line (grey)', { full: true })] },
        { title: 'Text', fields: [A('contact.text', 'Paragraph'), { key: 'contact.points', type: 'strings', label: 'Bullet points', full: true, itemName: 'bullet' }, T('contact.portalText', 'Text before the portal link'), T('contact.portalLinkLabel', 'Portal link text'), T('contact.submitLabel', 'Form button label')] }
      ]
    },
    { id: 'messages', title: 'Messages', custom: true, intro: 'Everything sent through the contact form, newest first.' }
  ];

  /* ---------- Small helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function resolve(path) {
    var keys = path.split('.');
    var last = keys.pop();
    var obj = keys.reduce(function (o, k) { if (o[k] === null || typeof o[k] !== 'object') o[k] = {}; return o[k]; }, state.content);
    return { obj: obj, key: last };
  }
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var uid = 0;

  var toastTimer;
  function toast(text, kind) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, kind === 'err' ? 6000 : 3200);
  }

  function markDirty() {
    state.dirty = true;
    var save = $('#save');
    save.disabled = false;
    save.textContent = 'Save changes';
  }

  async function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'X-Requested-With': 'admin' }, options.headers || {});
    options.credentials = 'same-origin';
    var res;
    try { res = await fetch('/api/manage/' + path, options); }
    catch (e) { throw new Error('Could not reach the server. If your session expired, reload the page to sign in again.'); }
    var data = {};
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) { var err = new Error(data.error || 'Request failed (' + res.status + ').'); err.status = res.status; err.data = data; throw err; }
    return data;
  }

  /* ---------- Image processing (in the browser, so every image matches the design) ---------- */
  function loadImage(file) {
    return new Promise(function (resolveImg, reject) {
      var img = new Image();
      img.onload = function () { resolveImg(img); };
      img.onerror = function () { reject(new Error('That file could not be read as an image.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function cover(img, w, h, anchorY) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / s, sh = h / s;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * anchorY, sw, sh, 0, 0, w, h);
    return c;
  }
  function contain(img, max) {
    var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function encode(canvas, type, quality) {
    return new Promise(function (done) { canvas.toBlob(done, type, quality); });
  }
  async function photo(canvas) {
    var blob = await encode(canvas, 'image/webp', 0.84);
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.86); // Safari
    return blob;
  }
  function base64(blob) {
    return new Promise(function (done, reject) {
      var r = new FileReader();
      r.onload = function () { done(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(new Error('Could not read that file.')); };
      r.readAsDataURL(blob);
    });
  }
  async function upload(kind, name, blobs) {
    var files = [];
    for (var suffix in blobs) files.push({ suffix: suffix, data: await base64(blobs[suffix]) });
    var out = await api('upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kind, name: name, files: files }) });
    return out.urls;
  }

  /* ---------- Field renderers ---------- */
  function wrap(def, control, labelFor) {
    var f = el('div', 'field' + (def.full ? ' full' : ''));
    if (def.label) {
      var l = el(labelFor ? 'label' : 'div', labelFor ? '' : 'label', def.label);
      if (labelFor) l.setAttribute('for', labelFor);
      f.appendChild(l);
    }
    f.appendChild(control);
    if (def.help) f.appendChild(el('p', 'help', def.help));
    return f;
  }

  function textField(def, obj, key) {
    var id = 'f' + (++uid);
    var input = el(def.type === 'textarea' ? 'textarea' : 'input');
    if (def.type !== 'textarea') input.type = 'text';
    if (def.type === 'url') input.inputMode = 'url';
    input.id = id;
    input.value = obj[key] === undefined || obj[key] === null ? '' : String(obj[key]);
    if (def.placeholder) input.placeholder = def.placeholder;
    input.addEventListener('input', function () { obj[key] = input.value; markDirty(); });
    return wrap(def, input, id);
  }

  function checkField(def, obj, key) {
    var id = 'f' + (++uid);
    var f = el('div', 'field check' + (def.full ? ' full' : ''));
    var input = el('input');
    input.type = 'checkbox'; input.id = id; input.checked = !!obj[key];
    input.addEventListener('change', function () { obj[key] = input.checked; markDirty(); });
    var l = el('label', '', def.label);
    l.setAttribute('for', id);
    f.appendChild(input); f.appendChild(l);
    return f;
  }

  function tools(arr, i, redraw, noun) {
    var box = el('div', 'item-tools');
    var mk = function (label, glyph, cls, disabled, fn) {
      var b = el('button', 'icon-btn' + (cls ? ' ' + cls : ''), glyph);
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); b.disabled = !!disabled;
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
      box.appendChild(b);
    };
    mk('Move up', '↑', '', i === 0, function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); markDirty(); redraw(i - 1); });
    mk('Move down', '↓', '', i === arr.length - 1, function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); markDirty(); redraw(i + 1); });
    mk('Remove this ' + noun, '✕', 'del', false, function () {
      if (!confirm('Remove this ' + noun + '?')) return;
      arr.splice(i, 1); markDirty(); redraw(-1);
    });
    return box;
  }

  function stringsField(def, obj, key) {
    if (!Array.isArray(obj[key])) obj[key] = [];
    var arr = obj[key];
    var box = el('div', 'strings');
    var noun = def.itemName || 'item';
    function draw(focusIndex) {
      box.textContent = '';
      arr.forEach(function (value, i) {
        var row = el('div', 'string-row');
        var input = el(def.multiline ? 'textarea' : 'input');
        if (!def.multiline) input.type = 'text';
        input.value = value;
        input.setAttribute('aria-label', noun + ' ' + (i + 1));
        input.addEventListener('input', function () { arr[i] = input.value; markDirty(); });
        row.appendChild(input);
        var t = tools(arr, i, draw, noun);
        while (t.firstChild) row.appendChild(t.firstChild);
        box.appendChild(row);
        if (i === focusIndex) setTimeout(function () { input.focus(); }, 0);
      });
      var add = el('button', 'btn btn-ghost btn-sm', '+ Add ' + noun);
      add.type = 'button';
      add.disabled = !!def.max && arr.length >= def.max;
      add.addEventListener('click', function () { arr.push(''); markDirty(); draw(arr.length - 1); });
      var row = el('div', 'add-row'); row.appendChild(add); box.appendChild(row);
    }
    draw(-1);
    return wrap(def, box);
  }

  function listField(def, obj, key) {
    if (!Array.isArray(obj[key])) obj[key] = [];
    var arr = obj[key];
    var box = el('div', 'items');
    var noun = def.itemName || 'item';
    function draw(openIndex) {
      box.textContent = '';
      arr.forEach(function (item, i) {
        var d = el('details', 'item');
        if (i === openIndex) d.open = true;
        var s = el('summary');
        var thumb = null;
        if (def.thumbKey) { thumb = el('img', 'item-thumb'); thumb.alt = ''; if (item[def.thumbKey]) thumb.src = item[def.thumbKey]; s.appendChild(thumb); }
        var title = el('span', 'item-title');
        var setTitle = function () {
          title.textContent = '';
          if (def.numKey && item[def.numKey]) title.appendChild(el('em', '', item[def.numKey] + '  '));
          title.appendChild(document.createTextNode(item[def.titleKey] || 'New ' + noun));
        };
        setTitle();
        s.appendChild(title);
        s.appendChild(tools(arr, i, draw, noun));
        d.appendChild(s);
        var body = el('div', 'item-body grid');
        def.fields.forEach(function (f) { body.appendChild(field(f, item, f.key, { thumb: thumb, noun: item[def.titleKey] })); });
        body.addEventListener('input', setTitle);
        d.appendChild(body);
        box.appendChild(d);
      });
      var add = el('button', 'btn btn-ghost btn-sm', '+ Add ' + noun);
      add.type = 'button';
      add.disabled = !!def.max && arr.length >= def.max;
      add.addEventListener('click', function () {
        var fresh = {};
        def.fields.forEach(function (f) { fresh[f.key] = f.type === 'strings' ? [] : f.type === 'check' ? false : ''; });
        arr.push(fresh); markDirty(); draw(arr.length - 1);
      });
      var row = el('div', 'add-row'); row.appendChild(add); box.appendChild(row);
    }
    draw(-1);
    return wrap(def, box);
  }

  // Logo, portrait, and website screenshots.
  function imageField(def, obj, key, ctx) {
    var kind = def.type === 'shot' ? 'shot' : def.kind;
    var box = el('div', 'image-field');
    var preview = el('div', 'image-preview ' + kind);
    function show(url) {
      preview.textContent = '';
      if (url) { var img = el('img'); img.alt = ''; img.src = url; preview.appendChild(img); }
      else preview.textContent = 'No image';
    }
    show(def.type === 'shot' ? (obj.imageSmall || obj.image) : obj[key]);

    var actions = el('div', 'image-actions');
    var input = el('input');
    input.type = 'file';
    input.accept = kind === 'logo' ? 'image/svg+xml,image/png,image/webp,image/jpeg' : 'image/png,image/jpeg,image/webp';
    var pick = el('button', 'btn btn-ghost btn-sm', kind === 'logo' ? 'Upload new logo' : kind === 'portrait' ? 'Upload photo' : 'Upload screenshot');
    pick.type = 'button';
    pick.addEventListener('click', function () { input.click(); });
    actions.appendChild(pick);
    actions.appendChild(input);

    if (kind === 'logo') {
      var reset = el('button', 'btn btn-ghost btn-sm', 'Use the original lion');
      reset.type = 'button';
      reset.addEventListener('click', function () { obj[key] = '/assets/lion.svg'; show(obj[key]); markDirty(); });
      actions.appendChild(reset);
    }
    if (kind === 'portrait') {
      var clear = el('button', 'btn btn-ghost btn-sm', 'Remove photo');
      clear.type = 'button';
      clear.addEventListener('click', function () { obj[key] = ''; show(''); markDirty(); });
      actions.appendChild(clear);
    }

    input.addEventListener('change', async function () {
      var file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      pick.disabled = true;
      var label = pick.textContent;
      pick.textContent = 'Uploading…';
      try {
        if (kind === 'logo') {
          var blob;
          if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
            if (file.size > 300000) throw new Error('That SVG is larger than 300 KB.');
            blob = file;
          } else {
            blob = await encode(contain(await loadImage(file), 512), 'image/png');
          }
          obj[key] = (await upload('logo', 'logo', { full: blob })).full;
          show(obj[key]);
          $('#top-logo').src = obj[key];
        } else if (kind === 'portrait') {
          var p = await loadImage(file);
          obj[key] = (await upload('portrait', 'portrait', { full: await photo(cover(p, 1000, 1250, 0.2)) })).full;
          show(obj[key]);
        } else {
          var shot = await loadImage(file);
          var urls = await upload('work', obj.name || (ctx && ctx.noun) || 'site', { 1280: await photo(cover(shot, 1280, 800, 0)), 640: await photo(cover(shot, 640, 400, 0)) });
          obj.image = urls['1280'];
          obj.imageSmall = urls['640'];
          show(obj.imageSmall);
          if (ctx && ctx.thumb) ctx.thumb.src = obj.imageSmall;
        }
        markDirty();
        toast('Image uploaded. Save changes to publish it.', 'ok');
      } catch (err) {
        toast(err.message || 'Upload failed.', 'err');
      } finally {
        pick.disabled = false;
        pick.textContent = label;
      }
    });

    box.appendChild(preview);
    box.appendChild(actions);
    return wrap(def, box);
  }

  function field(def, obj, key, ctx) {
    switch (def.type) {
      case 'check': return checkField(def, obj, key);
      case 'strings': return stringsField(def, obj, key);
      case 'list': return listField(def, obj, key);
      case 'image': case 'shot': return imageField(def, obj, key, ctx);
      default: return textField(def, obj, key);
    }
  }

  /* ---------- Screens ---------- */
  function renderSide() {
    var side = $('#side');
    side.textContent = '';
    SECTIONS.forEach(function (sec) {
      if (sec.custom) side.appendChild(el('div', 'sep'));
      var b = el('button', sec.id === state.section ? 'active' : '', sec.title);
      b.type = 'button';
      b.addEventListener('click', function () { state.section = sec.id; history.replaceState(null, '', '#' + sec.id); renderSide(); renderMain(); window.scrollTo(0, 0); });
      side.appendChild(b);
    });
  }

  function head(sec) {
    var h = el('div', 'sec-head');
    h.appendChild(el('p', 'eyebrow', 'Editing'));
    h.appendChild(el('h1', '', sec.title));
    if (sec.intro) h.appendChild(el('p', '', sec.intro));
    return h;
  }

  function renderMain() {
    var main = $('#main');
    var sec = SECTIONS.filter(function (s) { return s.id === state.section; })[0] || SECTIONS[0];
    main.textContent = '';
    main.appendChild(head(sec));
    if (sec.custom) return renderMessages(main);

    sec.groups.forEach(function (group) {
      var card = el('section', 'card');
      card.appendChild(el('h2', '', group.title));
      if (group.portraitNote) {
        var note = el('p', 'note');
        var on = !!state.settings.showPortrait;
        note.appendChild(document.createTextNode('The photo spot on the homepage is currently '));
        note.appendChild(el('span', on ? 'status-on' : 'status-off', on ? 'ON' : 'OFF'));
        note.appendChild(document.createTextNode('. It is controlled by the '));
        note.appendChild(el('code', '', 'SHOW_PORTRAIT'));
        note.appendChild(document.createTextNode(' setting in Azure (Static Web App → Environment variables). Set it to '));
        note.appendChild(el('code', '', on ? 'false' : 'true'));
        note.appendChild(document.createTextNode(on ? ' to hide it.' : ' once your photo is uploaded here.'));
        card.appendChild(note);
      }
      var grid = el('div', 'grid');
      group.fields.forEach(function (def) {
        var ref = resolve(def.key);
        grid.appendChild(field(def, ref.obj, ref.key));
      });
      card.appendChild(grid);
      main.appendChild(card);
    });

    var restore = el('button', 'btn btn-danger btn-sm', 'Restore the original text for this section');
    restore.type = 'button';
    restore.addEventListener('click', function () {
      if (!confirm('Replace everything in "' + sec.title + '" with the original content? Nothing is published until you save.')) return;
      sec.keys.forEach(function (k) { state.content[k] = clone(state.defaults[k]); });
      markDirty();
      renderMain();
    });
    main.appendChild(restore);
  }

  async function renderMessages(main) {
    var box = el('div');
    box.appendChild(el('p', 'loading', 'Loading messages…'));
    main.appendChild(box);
    try {
      var data = await api('messages');
      box.textContent = '';
      if (!data.messages.length) { box.appendChild(el('p', 'empty', 'No messages yet.')); return; }
      data.messages.forEach(function (m) {
        var card = el('article', 'msg');
        var h = el('div', 'msg-head');
        h.appendChild(el('strong', '', (m.name || 'Unknown') + (m.business ? ' · ' + m.business : '')));
        if (m.email) { var a = el('a', '', m.email); a.href = 'mailto:' + m.email; h.appendChild(a); }
        if (m.phone) h.appendChild(el('span', '', m.phone));
        card.appendChild(h);
        var when = m.submittedAt ? new Date(m.submittedAt).toLocaleString() : '';
        card.appendChild(el('p', 'msg-meta', [when, m.service, m.budget].filter(Boolean).join('  ·  ')));
        card.appendChild(el('p', '', m.message || ''));
        box.appendChild(card);
      });
    } catch (err) {
      box.textContent = '';
      box.appendChild(el('p', 'empty', err.message));
    }
  }

  function gate(title, text, showSignOut) {
    $('#side').textContent = '';
    $('#save').hidden = true;
    var main = $('#main');
    main.textContent = '';
    var g = el('div', 'gate');
    g.appendChild(el('h1', '', title));
    g.appendChild(el('p', '', text));
    if (showSignOut) { var a = el('a', 'btn btn-ghost', 'Sign out and try another account'); a.href = '/logout'; g.appendChild(a); }
    main.appendChild(g);
  }

  /* ---------- Save ---------- */
  $('#save').addEventListener('click', async function () {
    var save = $('#save');
    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      var out = await api('content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: state.content }) });
      state.content = out.content;
      state.dirty = false;
      save.textContent = 'Saved';
      renderMain();
      toast('Saved. The site is updated.', 'ok');
    } catch (err) {
      save.disabled = false;
      save.textContent = 'Save changes';
      toast(err.message, 'err');
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Start ---------- */
  (async function start() {
    try {
      var data = await api('content');
      state.content = data.content;
      state.defaults = data.defaults;
      state.settings = data.settings || {};
      state.user = data.user || '';
      $('#who').textContent = state.user ? 'Signed in as ' + state.user : '';
      if (state.content.brand && state.content.brand.logo) $('#top-logo').src = state.content.brand.logo;
      var wanted = location.hash.replace('#', '');
      if (SECTIONS.some(function (s) { return s.id === wanted; })) state.section = wanted;
      renderSide();
      renderMain();
    } catch (err) {
      if (err.status === 401) { location.href = '/login'; return; }
      if (err.status === 403) return gate('Not allowed', 'The Microsoft account "' + ((err.data && err.data.user) || 'unknown') + '" is not in the Website Admins group. ' + ((err.data && err.data.detail) || ''), true);
      if (err.status === 503) return gate('Admin access is not ready', err.message, true);
      gate('Something went wrong', err.message, false);
    }
  })();
})();

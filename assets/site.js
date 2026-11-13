(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* =====================================================================
     1. Content rendering — fills the page from what was saved in /admin/
     ===================================================================== */
  function make(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = String(txt);
    return n;
  }
  function fill(container, nodes) {
    if (!container) return;
    container.textContent = '';
    nodes.forEach(function (n) { if (n) container.appendChild(n); });
  }
  // Plain text with **bold** support.
  function rich(node, value) {
    node.textContent = '';
    String(value || '').split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) node.appendChild(make('strong', '', part.slice(2, -2)));
      else if (part) node.appendChild(document.createTextNode(part));
    });
    return node;
  }
  function safeUrl(u, fallback) {
    u = String(u || '').trim();
    return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(u) ? u : (fallback || '#');
  }
  var isExternal = function (u) { return /^https?:\/\//i.test(u); };
  function link(a, url) {
    a.setAttribute('href', safeUrl(url));
    if (isExternal(url)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function getAt(obj, path) {
    return path.split('.').reduce(function (o, k) { return o === null || o === undefined ? undefined : o[k]; }, obj);
  }
  function line(value, dim) {
    var l = make('span', 'line');
    l.appendChild(make('span', dim ? 'dim' : '', value));
    return l;
  }
  function arrow(ch) { var s = make('span', 'arrow', ch || '→'); s.setAttribute('aria-hidden', 'true'); return s; }
  var list = function (v) { return Array.isArray(v) ? v : []; };

  function render(c, settings) {
    if (!c) return;
    var brand = c.brand || {}, hero = c.hero || {}, work = c.work || {}, about = c.about || {};

    root.classList.toggle('has-portrait', !!(settings && settings.showPortrait));
    turnstileKey = (settings && settings.turnstileSiteKey) || '';

    // Simple text and link bindings.
    $$('[data-c]').forEach(function (node) {
      var v = getAt(c, node.getAttribute('data-c'));
      if (typeof v === 'string') node.textContent = v;
    });
    $$('[data-href]').forEach(function (node) {
      var v = getAt(c, node.getAttribute('data-href'));
      if (typeof v === 'string' && v) link(node, v);
    });

    // SEO.
    if (c.seo) {
      if (c.seo.title) document.title = c.seo.title;
      var desc = $('meta[name="description"]');
      if (desc && c.seo.description) desc.setAttribute('content', c.seo.description);
    }

    // Section headings: one white line and one grey line (or both on one line).
    $$('[data-title]').forEach(function (h) {
      var sec = c[h.getAttribute('data-title')];
      if (!sec) return;
      if (h.hasAttribute('data-inline')) {
        var l = make('span', 'line');
        var s = make('span', '', (sec.title || '') + ' ');
        if (sec.titleDim) s.appendChild(make('span', 'dim', sec.titleDim));
        l.appendChild(s);
        fill(h, [l]);
      } else {
        fill(h, [sec.title ? line(sec.title) : null, sec.titleDim ? line(sec.titleDim, true) : null]);
      }
    });

    // Hero.
    fill($('#hero-title'), list(hero.lines).map(function (t) { return line(t); }).concat(hero.dimLine ? [line(hero.dimLine, true)] : []));
    $$('.chip').forEach(function (chip, i) {
      var t = list(hero.chips)[i];
      chip.hidden = !t;
      if (t) $('span', chip).textContent = t;
    });
    var pimg = $('.portrait-img');
    if (pimg && settings && settings.showPortrait) {
      var src = hero.portrait ? safeUrl(hero.portrait, '') : '';
      $('#portrait').classList.toggle('no-photo', !src);
      if (src && pimg.getAttribute('src') !== src) pimg.setAttribute('src', src);
      pimg.alt = hero.plateName || '';
    }

    // Stats.
    fill($('#stats'), list(c.stats).map(function (s) {
      var d = make('div');
      var dt = make('dt');
      var n = make('span', '', s.value);
      n.setAttribute('data-count', '');
      dt.appendChild(n);
      if (s.suffix) dt.appendChild(document.createTextNode(s.suffix));
      d.appendChild(dt);
      d.appendChild(make('dd', '', s.label));
      return d;
    }));

    // Marquee (two copies for a seamless loop).
    var mq = [];
    for (var copy = 0; copy < 2; copy++) list(c.marquee).forEach(function (t) { mq.push(make('span', '', t)); mq.push(make('i')); });
    fill($('#marquee-track'), mq);

    // Statement.
    if (c.statement && $('#statement')) $('#statement').textContent = c.statement.text || '';

    // Services.
    fill($('#services-list'), list(c.services && c.services.cards).map(function (card) {
      var a = make('article', 'glass service' + (card.highlight ? ' service-web' : ''));
      a.setAttribute('data-reveal', '');
      a.appendChild(make('span', 'big-num', card.num));
      a.appendChild(make('h3', '', card.title));
      a.appendChild(rich(make('p'), card.text));
      var ul = make('ul');
      list(card.bullets).forEach(function (b) { ul.appendChild(rich(make('li'), b)); });
      a.appendChild(ul);
      if (card.badge) {
        var foot = make('p', 'service-foot');
        foot.appendChild(rich(make('span', 'pill' + (card.highlight ? ' pill-gold' : '')), card.badge));
        a.appendChild(foot);
      }
      return a;
    }));

    // Work.
    var cases = list(work.sites).map(function (site) {
      var a = link(make('a', 'case'), site.url);
      var win = make('div', 'window');
      var bar = make('div', 'window-bar');
      bar.appendChild(make('i')); bar.appendChild(make('i')); bar.appendChild(make('i'));
      var host = '';
      try { host = new URL(site.url).hostname.replace(/^www\./, ''); } catch (e) { host = site.name || ''; }
      bar.appendChild(make('span', '', host));
      win.appendChild(bar);
      if (site.image) {
        var img = make('img');
        img.src = safeUrl(site.image, '');
        if (site.imageSmall) {
          img.srcset = safeUrl(site.imageSmall, '') + ' 640w, ' + safeUrl(site.image, '') + ' 1280w';
          img.sizes = '(min-width: 900px) 640px, 86vw';
        }
        img.alt = 'Homepage of ' + (site.name || host);
        img.width = 1280; img.height = 800; img.loading = 'lazy';
        win.appendChild(img);
      }
      a.appendChild(win);
      var body = make('div', 'case-body');
      var meta = make('p', 'case-meta', (site.meta || '') + ' ');
      if (site.tag) meta.appendChild(make('span', 'pill pill-blue', site.tag));
      body.appendChild(meta);
      body.appendChild(make('h3', '', site.name));
      if (site.text) body.appendChild(make('p', '', site.text));
      a.appendChild(body);
      return a;
    });
    var cta = make('a', 'case case-cta');
    cta.setAttribute('href', '#contact');
    var ctaLogo = make('img', 'js-logo');
    ctaLogo.alt = ''; ctaLogo.width = 72; ctaLogo.height = 72;
    cta.appendChild(ctaLogo);
    cta.appendChild(make('h3', '', work.ctaTitle));
    var ctaBtn = make('span', 'btn btn-blue', (brand.ctaLabel || 'Contact now') + ' ');
    ctaBtn.appendChild(arrow());
    cta.appendChild(ctaBtn);
    fill($('#work-track'), cases.concat([cta]));
    var total = $('#work-total');
    if (total) total.textContent = (cases.length < 10 ? '0' : '') + cases.length;

    // About.
    fill($('#about-paras'), list(about.paragraphs).map(function (t) {
      var p = rich(make('p'), t);
      p.setAttribute('data-reveal', '');
      return p;
    }));
    fill($('#about-buttons'), list(about.buttons).map(function (b, i) {
      var a = link(make('a', 'btn magnetic ' + (i === 0 ? 'btn-light' : 'btn-ghost'), (b.label || '') + ' '), b.url);
      if (isExternal(b.url)) a.appendChild(arrow('↗'));
      return a;
    }));
    fill($('#certs-list'), list(about.certs).map(function (cert) {
      var li = make('li');
      li.appendChild(make('span', '', cert.issuer));
      li.appendChild(document.createTextNode(cert.name || ''));
      return li;
    }));

    // Process.
    fill($('#steps-list'), list(c.process && c.process.steps).map(function (s) {
      var li = make('li');
      li.setAttribute('data-reveal', '');
      li.appendChild(make('span', 'big-num', s.num));
      li.appendChild(make('h3', '', s.title));
      li.appendChild(rich(make('p'), s.text));
      return li;
    }));

    // FAQ.
    fill($('#faq-list'), list(c.faq && c.faq.items).map(function (item, i) {
      var d = make('details', 'glass');
      if (i === 0) d.open = true;
      d.appendChild(make('summary', '', item.q));
      d.appendChild(rich(make('p'), item.a));
      return d;
    }));

    // Contact.
    if (c.contact) {
      fill($('#contact-title'), list(c.contact.lines).map(function (t) { return line(t); }).concat(c.contact.dimLine ? [line(c.contact.dimLine, true)] : []));
      fill($('#contact-points'), list(c.contact.points).map(function (t) { return make('li', '', t); }));
    }

    // Logo everywhere, including the browser tab when a custom one is set.
    var logo = safeUrl(brand.logo, '/assets/lion.svg');
    $$('.js-logo').forEach(function (img) { if (img.getAttribute('src') !== logo) img.setAttribute('src', logo); });
    if (logo !== '/assets/lion.svg') {
      var icon = $('link[rel="icon"]');
      if (icon) { icon.removeAttribute('type'); icon.setAttribute('href', logo); }
    }
  }

  /* =====================================================================
     2. Behaviour that must be (re)attached after each render
     ===================================================================== */
  var io = null;
  var turnstileKey = '';
  var words = [];
  var statement = null;
  var caseCount = 0;
  var countedUp = false;

  function setup(instant) {
    var year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    // Reveal on scroll, with a small stagger between siblings.
    $$('[data-reveal]').forEach(function (el) {
      var sibs = $$(':scope > [data-reveal]', el.parentNode);
      var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', (i * 0.09).toFixed(2) + 's');
    });
    var revealables = $$('[data-reveal], [data-lines]');
    if (io) io.disconnect();
    if ('IntersectionObserver' in window && !reduced && !instant) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
      revealables.forEach(function (el) { if (!el.classList.contains('in')) io.observe(el); });
    } else {
      revealables.forEach(function (el) { el.classList.add('in'); });
    }

    // Count-up stats (whole numbers only, first time only).
    if (!reduced && !instant && !countedUp) {
      countedUp = true;
      $$('[data-count]').forEach(function (el) {
        var raw = el.textContent.trim();
        if (!/^\d{1,6}$/.test(raw)) return;
        var end = parseInt(raw, 10);
        var start = end > 1000 ? end - 30 : 0;
        var t0 = null;
        el.textContent = String(start);
        setTimeout(function () {
          requestAnimationFrame(function step(t) {
            if (!el.isConnected) return;
            if (t0 === null) t0 = t;
            var p = clamp((t - t0) / 1600, 0, 1);
            el.textContent = String(Math.round(start + (end - start) * (1 - Math.pow(1 - p, 4))));
            if (p < 1) requestAnimationFrame(step);
          });
        }, 1100);
      });
    }

    // Statement: words light up as you scroll.
    statement = $('#statement');
    words = [];
    if (statement && !reduced) {
      var parts = statement.textContent.trim().split(/\s+/);
      statement.textContent = '';
      parts.forEach(function (word, i) {
        var s = make('span', 'w', word);
        statement.appendChild(s);
        if (i < parts.length - 1) statement.appendChild(document.createTextNode(' '));
        words.push(s);
      });
    }

    // Magnetic buttons (mouse only).
    if (finePointer && !reduced) {
      $$('.magnetic').forEach(function (btn) {
        if (btn.hasAttribute('data-mag')) return;
        btn.setAttribute('data-mag', '');
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          btn.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.4).toFixed(1) + 'px)';
        });
        btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
      });
    }

    caseCount = $$('.case:not(.case-cta)').length;
    measure();
    update();
    watchTurnstile();
  }

  /* Cloudflare Turnstile on the contact form. The script loads only when the form comes near the screen. */
  var turnstileId = null;
  var turnstileToken = '';
  var turnstileWatch = null;
  function mountTurnstile() {
    var slot = $('#cf-turnstile');
    if (!slot || !turnstileKey || turnstileId !== null || !window.turnstile) return;
    slot.hidden = false;
    turnstileId = window.turnstile.render(slot, {
      sitekey: turnstileKey, theme: 'dark', size: 'flexible',
      callback: function (t) { turnstileToken = t; },
      'expired-callback': function () { turnstileToken = ''; },
      'error-callback': function () { turnstileToken = ''; }
    });
  }
  function loadTurnstile() {
    if (!turnstileKey || $('script[data-turnstile]')) return mountTurnstile();
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.setAttribute('data-turnstile', '');
    s.addEventListener('load', mountTurnstile);
    document.head.appendChild(s);
  }
  function watchTurnstile() {
    var slot = $('#cf-turnstile');
    if (!slot || !turnstileKey || turnstileId !== null || turnstileWatch) return;
    if (!('IntersectionObserver' in window)) return loadTurnstile();
    turnstileWatch = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { turnstileWatch.disconnect(); loadTurnstile(); }
    }, { rootMargin: '900px 0px' });
    turnstileWatch.observe($('#contact-form') || slot.parentNode); // the slot itself is hidden until the widget mounts
  }

  /* =====================================================================
     3. One-time wiring
     ===================================================================== */
  // Portrait placeholder when the photo is missing.
  var portrait = $('#portrait');
  if (portrait) {
    var portraitImg = $('.portrait-img', portrait);
    portrait.classList.add('no-photo');
    portraitImg.addEventListener('load', function () { portrait.classList.remove('no-photo'); });
    portraitImg.addEventListener('error', function () { portrait.classList.add('no-photo'); });
  }

  // Smooth scrolling.
  var lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  var getY = function () { return window.scrollY || window.pageYOffset; };

  var nav = $('.nav');
  var toggle = $('.nav-toggle');
  var links = $('#site-nav');
  function closeNav() {
    if (!links) return;
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = !links.classList.contains('open');
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    var target = hash === '#top' || hash === '#' ? document.body : $(hash);
    if (!target) return;
    e.preventDefault();
    closeNav();
    if (lenis) lenis.scrollTo(target === document.body ? 0 : target, { offset: -80, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    if (target.id) history.replaceState(null, '', '#' + target.id);
  });

  // Pinned horizontal work gallery.
  var work = $('.work');
  var track = $('#work-track');
  var viewport = $('.work-viewport');
  var workBar = $('#work-bar');
  var workIndex = $('#work-index');
  var pinMq = window.matchMedia('(min-width: 901px) and (min-height: 620px)');
  var pinned = false;
  var workDist = 0;

  function setWorkProgress(p) {
    if (workBar) workBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (workIndex && caseCount) {
      var n = clamp(Math.round(p * caseCount) + 1, 1, caseCount);
      workIndex.textContent = (n < 10 ? '0' : '') + n;
    }
  }

  function measure() {
    if (!work || !track) return;
    var shouldPin = pinMq.matches && !reduced;
    if (shouldPin !== pinned) {
      pinned = shouldPin;
      root.classList.toggle('pin', pinned);
      if (!pinned) { track.style.transform = ''; work.style.removeProperty('--work-h'); }
    }
    if (pinned) {
      workDist = Math.max(0, track.scrollWidth - window.innerWidth);
      work.style.setProperty('--work-h', (window.innerHeight + workDist) + 'px');
    }
  }

  if (viewport) {
    viewport.addEventListener('scroll', function () {
      if (pinned) return;
      var max = viewport.scrollWidth - viewport.clientWidth;
      setWorkProgress(max > 0 ? viewport.scrollLeft / max : 0);
    }, { passive: true });
  }

  // Scroll-driven updates.
  var progressBar = $('.progress span');
  var stepsLine = $('#steps-line');
  var steps = $('.steps');
  var giant = $('#giant');
  var lastY = 0;
  var ticking = false;

  function update() {
    ticking = false;
    var y = getY();
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;

    if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';

    if (nav && !(links && links.classList.contains('open'))) {
      if (y > lastY + 4 && y > 500) nav.classList.add('hide');
      else if (y < lastY - 4 || y < 500) nav.classList.remove('hide');
    }
    lastY = y;

    if (words.length && statement) {
      var r = statement.getBoundingClientRect();
      var lit = Math.round(clamp((vh * 0.82 - r.top) / (r.height + vh * 0.42), 0, 1) * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < lit);
    }

    if (pinned && workDist > 0) {
      var wp = clamp((y - work.offsetTop) / workDist, 0, 1);
      track.style.transform = 'translate3d(' + (-wp * workDist).toFixed(1) + 'px,0,0)';
      setWorkProgress(wp);
    }

    if (stepsLine && steps) {
      var sr = steps.getBoundingClientRect();
      stepsLine.style.transform = 'scaleX(' + clamp((vh * 0.85 - sr.top) / (vh * 0.5), 0, 1).toFixed(4) + ')';
    }

    if (giant && !reduced) {
      var gr = giant.getBoundingClientRect();
      var gp = clamp((vh - gr.top) / (vh * 0.9), 0, 1);
      giant.style.transform = 'translate3d(0,' + ((1 - gp) * 38).toFixed(1) + '%,0) scale(' + (0.9 + gp * 0.1).toFixed(3) + ')';
    }
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', function () { measure(); requestUpdate(); });
  window.addEventListener('load', function () { measure(); requestUpdate(); });
  if (pinMq.addEventListener) pinMq.addEventListener('change', function () { measure(); requestUpdate(); });

  // Pointer effects (mouse only).
  if (finePointer && !reduced) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.glass');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    var heroEl = $('.hero');
    var chips = $$('.chip');
    if (heroEl && portrait) {
      heroEl.addEventListener('pointermove', function (e) {
        var x = e.clientX / window.innerWidth - 0.5;
        var yy = e.clientY / window.innerHeight - 0.5;
        portrait.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
        portrait.style.setProperty('--rx', (-yy * 10).toFixed(2) + 'deg');
        chips.forEach(function (chip) {
          var d = parseFloat(chip.getAttribute('data-depth')) || 0;
          chip.style.setProperty('--px', (x * d).toFixed(1) + 'px');
          chip.style.setProperty('--py', (yy * d).toFixed(1) + 'px');
        });
      }, { passive: true });
      heroEl.addEventListener('pointerleave', function () {
        portrait.style.setProperty('--ry', '0deg');
        portrait.style.setProperty('--rx', '0deg');
      });
    }
  }

  /* =====================================================================
     4. Start: wait briefly for the saved content, then show the page
     ===================================================================== */
  var CACHE_KEY = 'nl-site-v1';
  var shown = null; // JSON of what is on screen, to skip needless re-renders
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; } }
  function writeCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ } }

  function show(data, later) {
    var key = data && data.content ? JSON.stringify(data) : null;
    if (later && key === shown) return;
    if (key) {
      if (later) root.classList.add('settled'); // no intro replay on a late update
      try { render(data.content, data.settings || {}); shown = key; } catch (e) { /* keep the built-in page */ }
    }
    setup(!!later);
    root.classList.remove('pending');
    root.classList.add('ready');
  }

  var pendingFetch = window.__site && typeof window.__site.then === 'function' ? window.__site : Promise.resolve(null);
  var started = false;
  var timer = setTimeout(function () {
    // The API is slow (cold start): show the last known content, update when it arrives.
    if (started) return;
    started = true;
    show(readCache(), false);
    pendingFetch.then(function (data) { if (data && data.content) { writeCache(data); show(data, true); } });
  }, 1300);

  pendingFetch.then(function (data) {
    if (started) return;
    started = true;
    clearTimeout(timer);
    if (data && data.content) { writeCache(data); show(data, false); }
    else show(readCache(), false);
  });

  /* =====================================================================
     5. Contact form
     ===================================================================== */
  var form = $('#contact-form');
  if (!form) return;
  var status = $('#cf-status');
  var message = $('#cf-message');
  var count = $('#cf-count');
  var button = $('button[type="submit"]', form);
  var loadedAt = Date.now();

  if (message && count) {
    message.addEventListener('input', function () { count.textContent = String(message.value.length); });
  }

  var MESSAGES = {
    name: 'Please enter your name.',
    business: 'Please enter your business name.',
    email: 'Please enter a valid email address.',
    service: 'Please choose what you need.',
    budget: 'Please choose a budget.',
    message: 'Please tell me a little about your project.'
  };

  function clearError(input) {
    input.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
    var err = $('.error', input.parentNode);
    if (err) err.remove();
  }

  function showError(input, text) {
    clearError(input);
    input.classList.add('invalid');
    input.setAttribute('aria-invalid', 'true');
    input.parentNode.appendChild(make('p', 'error', text));
  }

  function validate() {
    var firstBad = null;
    Object.keys(MESSAGES).forEach(function (name) {
      var input = form.elements[name];
      var value = input.value.trim();
      var bad = !value || (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) || (name === 'message' && value.length < 10);
      if (bad) { showError(input, MESSAGES[name]); firstBad = firstBad || input; }
      else clearError(input);
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  form.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('invalid')) clearError(e.target);
  });

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { setStatus('Please fix the highlighted fields.', 'err'); return; }
    if (turnstileKey && !turnstileToken) { loadTurnstile(); setStatus('Please complete the verification check above, then send again.', 'err'); return; }

    var payload = { elapsedMs: Date.now() - loadedAt, turnstileToken: turnstileToken };
    ['name', 'business', 'email', 'phone', 'service', 'budget', 'message', 'website'].forEach(function (name) {
      payload[name] = form.elements[name].value.trim();
    });

    button.disabled = true;
    setStatus('Sending…');

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (result) {
      if (!result.ok) throw new Error(result.data.error || 'Something went wrong.');
      var done = make('div', 'form-done');
      done.setAttribute('role', 'status');
      done.tabIndex = -1;
      done.appendChild(make('h3', '', 'Message received.'));
      done.appendChild(make('p', '', 'Thanks, ' + payload.name.split(' ')[0] + '. I’ll review your project and reply to ' + payload.email + ' soon.'));
      form.replaceChildren(done);
      done.focus({ preventScroll: true });
    }).catch(function (err) {
      button.disabled = false;
      // A Turnstile token works once, so get a new one before the next try.
      if (turnstileId !== null && window.turnstile) { turnstileToken = ''; window.turnstile.reset(turnstileId); }
      setStatus(err.message || 'Something went wrong. Please try again.', 'err');
    });
  });
})();

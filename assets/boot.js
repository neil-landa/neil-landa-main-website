// Runs in <head>: hides the page for a moment and starts fetching the editable content,
// so the page can appear with the latest saved text instead of flashing the defaults.
(function () {
  var root = document.documentElement;
  root.classList.add('js', 'pending');
  try {
    window.__site = fetch('/api/content', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; });
  } catch (e) {
    window.__site = null;
  }
  // Safety net: never leave the page hidden if something else fails.
  setTimeout(function () { root.classList.remove('pending'); root.classList.add('ready'); }, 4000);
})();

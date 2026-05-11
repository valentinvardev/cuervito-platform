/* panel-anim.js — stagger reveal al cargar + fallback fade-out al navegar */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== Stagger reveal on load =====
  function applyStagger() {
    if (reduce) return;
    const main = document.querySelector('main');
    if (!main) return;

    let i = 0;

    // top-level blocks inside <main>
    Array.from(main.children).forEach((el) => {
      if (el.classList.contains('appear')) return;
      el.style.setProperty('--i', i++);
      el.classList.add('appear');
    });

    // children inside common containers (cards / list items)
    const containers = main.querySelectorAll(
      '.action-grid, .event-list, .photo-grid, .help-list, .stats-grid, .toggle-cards, .filters, .form-grid-2'
    );
    containers.forEach((c) => {
      Array.from(c.children).forEach((child, idx) => {
        if (child.classList.contains('appear')) return;
        child.style.setProperty('--i', i + idx * 0.6);
        child.classList.add('appear');
      });
      i += c.children.length * 0.6;
    });

    // sales list rows (uses div.sale-row inside .sales-card)
    const sales = main.querySelector('#salesList');
    if (sales) {
      Array.from(sales.children).forEach((row, idx) => {
        if (row.classList.contains('appear')) return;
        row.style.setProperty('--i', i + idx * 0.5);
        row.classList.add('appear');
      });
    }
  }

  // Run after the DOM (and inline scripts that populate lists) finish.
  function scheduleReveal() {
    // If we arrived through a cross-document view transition, the browser
    // is already animating the snapshot. Defer the stagger until that finishes
    // so we don't double-animate.
    document.addEventListener('pagereveal', (e) => {
      if (e.viewTransition) {
        e.viewTransition.finished.finally(applyStagger);
      } else {
        applyStagger();
      }
    }, { once: true });

    // Browsers without pagereveal (no view transitions): run normally.
    if (typeof window.PageRevealEvent === 'undefined') {
      applyStagger();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleReveal);
  } else {
    scheduleReveal();
  }

  // Re-run when navigating back via bfcache
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) applyStagger();
  });

  // ===== JS fallback: body fade-out on link click =====
  // Only used when the browser does NOT support cross-doc view transitions.
  const supportsCrossDocVT =
    'startViewTransition' in document &&
    CSS.supports && CSS.supports('selector(::view-transition-old(root))');

  if (supportsCrossDocVT || reduce) return;

  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && (url.hash || url.search === location.search)) return;

    ev.preventDefault();
    document.body.classList.add('panel-leaving');
    setTimeout(() => { location.assign(a.href); }, 200);
  });
})();

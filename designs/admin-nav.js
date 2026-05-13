/* admin-nav.js
   Shared admin header: hamburger drawer · centered logo · profile dropdown.
   Also: sale notification with stacking coins + coin-clink sound.

   Usage: include <script src="admin-nav.js" defer></script> in any admin page.
   Auto-detects current page from <body data-screen-label="..."> or filename. */
(function () {
  'use strict';

  /* ---------- Navigation entries (single source of truth) ---------- */
  const NAV = [
    { href: 'dashboard.html', label: 'Panel',          icon: 'ti-layout-dashboard' },
    { href: 'events.html',    label: 'Eventos',        icon: 'ti-calendar-event' },
    { href: 'ventas.html',    label: 'Ventas',         icon: 'ti-chart-bar' },
    { href: 'tienda.html',    label: 'Página de venta',icon: 'ti-template' },
    { href: 'cobros.html',    label: 'Método de pago', icon: 'ti-credit-card' },
    { href: 'perfil.html',    label: 'Perfil',         icon: 'ti-user' },
    { href: 'ayuda.html',     label: 'Ayuda',          icon: 'ti-help-circle' },
  ];

  const PROFILE = { name: 'Ana Liotta', email: 'ana.liotta@gmail.com', initials: 'AL' };

  function currentPage() {
    let path = location.pathname.split('/').pop() || '';
    if (!path || path === '') path = 'index.html';
    // Normalize: strip query/hash already removed, ensure .html suffix
    if (!path.includes('.')) path += '.html';
    return path;
  }

  /* Set the body class as early as possible so the icon renders correct on
     first paint (no flicker from arrow → hamburger). */
  if (document.body) {
    document.body.classList.toggle('is-dashboard', currentPage() === 'dashboard.html');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.toggle('is-dashboard', currentPage() === 'dashboard.html');
    }, { once: true });
  }

  /* ---------- Build header ---------- */
  function buildHeader() {
    const existing = document.querySelector('header.top, header.adm-top');
    if (!existing) return;

    const isDashboard = currentPage() === 'dashboard.html';
    document.body.classList.toggle('is-dashboard', isDashboard);

    const header = document.createElement('header');
    header.className = 'adm-top';
    header.innerHTML = `
      <div class="adm-top-left">
        <button class="adm-nav-btn" id="admNavBtn" aria-label="${isDashboard ? 'Abrir menú' : 'Volver al panel'}">
          <span class="adm-nav-icons">
            <i class="ti ti-menu-2 adm-icon-menu"></i>
            <i class="ti ti-arrow-left adm-icon-back"></i>
          </span>
          <span class="adm-nav-label">Volver</span>
        </button>
      </div>
      <div class="adm-top-center">
        <a href="dashboard.html" class="logo">cuerv<span class="logo-dot"></span>to</a>
      </div>
      <div class="adm-top-right">
        <div class="adm-profile-wrap">
          <div class="adm-avatar" id="admAvatar" title="Cuenta">${PROFILE.initials}</div>
          <div class="adm-dropdown" id="admDropdown" role="menu">
            <div class="adm-dropdown-user">
              <span class="name">${PROFILE.name}</span>
              <span class="mail">${PROFILE.email}</span>
            </div>
            <a href="perfil.html" class="adm-dropdown-item" role="menuitem">
              <i class="ti ti-user-edit"></i><span>Editar perfil</span>
            </a>
            <div class="adm-dropdown-sep"></div>
            <button class="adm-dropdown-item danger" id="admLogout" role="menuitem">
              <i class="ti ti-logout"></i><span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    `;
    existing.replaceWith(header);
  }

  /* ---------- Build drawer ---------- */
  function buildDrawer() {
    if (document.getElementById('admDrawer')) return;
    const here = currentPage();

    const backdrop = document.createElement('div');
    backdrop.className = 'adm-drawer-backdrop';
    backdrop.id = 'admDrawerBackdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'adm-drawer';
    drawer.id = 'admDrawer';
    drawer.innerHTML = `
      <div class="adm-drawer-head">
        <a href="dashboard.html" class="logo">cuerv<span class="logo-dot"></span>to</a>
        <button class="adm-drawer-close" id="admDrawerClose" aria-label="Cerrar menú">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <nav class="adm-drawer-nav">
        ${NAV.map(n => `
          <a href="${n.href}" class="adm-drawer-link ${n.href === here ? 'active' : ''}">
            <i class="ti ${n.icon}"></i><span>${n.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="adm-drawer-foot">
        cuervito.app · v0.1<br />
        <a href="index.html" style="color: var(--accent);">Volver al sitio</a>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  /* ---------- Wire interactions ---------- */
  function wireInteractions() {
    const navBtn   = document.getElementById('admNavBtn');
    const drawer   = document.getElementById('admDrawer');
    const backdrop = document.getElementById('admDrawerBackdrop');
    const closeBtn = document.getElementById('admDrawerClose');
    const avatar   = document.getElementById('admAvatar');
    const dropdown = document.getElementById('admDropdown');
    const logoutBtn = document.getElementById('admLogout');

    const isDashboard = document.body.classList.contains('is-dashboard');

    function openDrawer() {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }

    navBtn?.addEventListener('click', () => {
      if (isDashboard) openDrawer();
      else location.href = 'dashboard.html';
    });
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (drawer.classList.contains('open')) closeDrawer();
        if (dropdown.classList.contains('open')) dropdown.classList.remove('open');
      }
    });

    // Profile dropdown
    avatar?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== avatar) {
        dropdown.classList.remove('open');
      }
    });
    logoutBtn?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      // Demo: redirect to landing
      location.href = 'index.html';
    });
  }

  /* ---------- Sale notification ---------- */
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    return audioCtx;
  }

  /* Minimalist digital chime: 3 short sine pulses ascending on a C major triad
     (E5 · G5 · C6), fast attack, short clean decay. Synced to coin drops. */
  function playCoinSound() {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const NOTES = [
      { f: 659.25, t: 0.00 }, // E5
      { f: 783.99, t: 0.14 }, // G5
      { f: 1046.5, t: 0.28 }, // C6
    ];

    NOTES.forEach(({ f, t }) => {
      const start = now + t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  function buildToast() {
    if (document.getElementById('admSaleToast')) return;
    const toast = document.createElement('div');
    toast.className = 'adm-sale-toast';
    toast.id = 'admSaleToast';
    toast.innerHTML = `
      <button class="adm-sale-close" id="admSaleClose" aria-label="Cerrar">
        <i class="ti ti-x"></i>
      </button>
      <div class="adm-coin-stack" aria-hidden="true">
        <div class="adm-coin">$</div>
        <div class="adm-coin">$</div>
        <div class="adm-coin">$</div>
      </div>
      <div class="adm-sale-body">
        <div class="label">Venta nueva</div>
        <div class="ttl"><span class="amt" id="admSaleAmt">$2.400</span></div>
        <div class="sub" id="admSaleSub">1 foto · Maratón BA</div>
      </div>
    `;
    document.body.appendChild(toast);
    document.getElementById('admSaleClose').addEventListener('click', hideSaleToast);
  }

  let hideTimer = null;
  function showSaleToast(opts) {
    buildToast();
    const toast = document.getElementById('admSaleToast');
    const amt = document.getElementById('admSaleAmt');
    const sub = document.getElementById('admSaleSub');
    if (opts && opts.amount) amt.textContent = opts.amount;
    if (opts && opts.detail) sub.textContent = opts.detail;

    // Replay coin-drop animation by re-mounting the stack
    const stack = toast.querySelector('.adm-coin-stack');
    const fresh = stack.cloneNode(true);
    stack.replaceWith(fresh);

    toast.classList.add('show');
    playCoinSound();

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideSaleToast, 5500);
  }
  function hideSaleToast() {
    const toast = document.getElementById('admSaleToast');
    if (toast) toast.classList.remove('show');
    clearTimeout(hideTimer);
  }

  /* Expose for demos / testing */
  window.adminNotifySale = showSaleToast;

  /* ---------- Init ---------- */
  function init() {
    buildHeader();
    buildDrawer();
    wireInteractions();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

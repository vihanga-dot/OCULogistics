/* ===========================
   INTERACTIVE EFFECTS LAYER
   Drop-in, zero dependency on main.js/admin.js/auth.js.
   Respects prefers-reduced-motion. No-ops on touch devices
   for cursor/tilt effects (they don't apply there).
   =========================== */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---------- 1. Custom cursor (signal dot + wayfind ring) ---------- */
  function initCursor() {
    if (reduceMotion || isTouch) return;

    const ring = document.createElement('div');
    ring.className = 'oc-cursor-ring';
    const dot = document.createElement('div');
    dot.className = 'oc-cursor-dot';
    document.body.append(ring, dot);
    document.body.classList.add('oc-cursor-active');

    let ringX = window.innerWidth / 2, ringY = window.innerHeight / 2;
    let targetX = ringX, targetY = ringY;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      dot.style.transform = `translate(${targetX}px, ${targetY}px)`;
    }, { passive: true });

    (function loop() {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      requestAnimationFrame(loop);
    })();

    const interactiveSel = 'a, button, .btn, .card, .feature-card, .admin-card, .article-card, input, select, textarea, .nav-link, .hamburger';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSel)) document.body.classList.add('oc-cursor-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSel)) document.body.classList.remove('oc-cursor-hover');
    });
    document.addEventListener('mousedown', () => document.body.classList.add('oc-cursor-down'));
    document.addEventListener('mouseup', () => document.body.classList.remove('oc-cursor-down'));
  }

  /* ---------- 2. Hero typing effect ---------- */
  function initHeroTyping() {
    const el = document.querySelector('.hero-subtitle[data-typing]');
    if (!el) return;
    const full = el.getAttribute('data-typing') || el.textContent.trim();
    el.textContent = '';
    el.classList.add('oc-typing-active');

    if (reduceMotion) {
      el.textContent = full;
      return;
    }

    let i = 0;
    const speed = 32;
    (function type() {
      if (i <= full.length) {
        el.textContent = full.slice(0, i);
        i++;
        setTimeout(type, speed);
      } else {
        el.classList.add('oc-typing-done');
      }
    })();
  }

  /* ---------- 3. Magnetic buttons ---------- */
  function initMagnetic() {
    if (reduceMotion || isTouch) return;
    document.querySelectorAll('.btn, .btn-icon').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- 4. Ripple on click for .btn ---------- */
  function initRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const span = document.createElement('span');
      span.className = 'oc-ripple';
      span.style.left = `${e.clientX - r.left}px`;
      span.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });
  }

  /* ---------- 5. Card tilt (3D pointer-follow) ---------- */
  function initTilt() {
    if (reduceMotion || isTouch) return;
    const cards = document.querySelectorAll('.card, .feature-card, .admin-card, .article-card');
    cards.forEach((card) => {
      card.classList.add('oc-tilt');
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * 8;
        const ry = (px - 0.5) * 10;
        card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        card.style.setProperty('--oc-glow-x', `${px * 100}%`);
        card.style.setProperty('--oc-glow-y', `${py * 100}%`);
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- 6. Scroll reveal ---------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      '.feature-card, .card, .article-card, .admin-card, .section-title, .page-title, .section-description, .page-description'
    );
    if (!targets.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('oc-revealed'));
      return;
    }

    targets.forEach((t, i) => {
      t.classList.add('oc-reveal');
      t.style.setProperty('--oc-delay', `${Math.min(i % 6, 5) * 70}ms`);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('oc-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    targets.forEach((t) => io.observe(t));
  }

  /* ---------- 7. Navbar scrolled state (visual only, class already styled) ---------- */
  function initNavbarScroll() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function init() {
    initCursor();
    initHeroTyping();
    initMagnetic();
    initRipple();
    initTilt();
    initScrollReveal();
    initNavbarScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

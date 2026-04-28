/* ═══════════════════════════════════════════════════════
   PORTFOLIO — Gadhiya Kathan — Futuristic AI Agent Engine
   Particles, animations, 3D tilt, carousel, perf-first
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.innerWidth > 768 && !isTouchDevice;

  // ── Floating Particle System ─────────────────────────
  if (!prefersReducedMotion) {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.color = Math.random() > 0.5 ? '0,212,255' : '123,45,255';
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
        ctx.fill();
      }
    }

    const count = Math.min(80, Math.floor(w * h / 15000));
    for (let i = 0; i < count; i++) particles.push(new Particle());

    function drawLines() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => { p.update(); p.draw(); });
      drawLines();
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ── Navbar Scroll ────────────────────────────────────
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section, .hero');
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      navbar.classList.toggle('scrolled', scrollY > 40);

      let current = '';
      sections.forEach(s => {
        if (scrollY >= s.offsetTop - 150) current = s.id;
      });
      navLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === '#' + current);
      });
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Mobile Nav ───────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinksContainer = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinksContainer.classList.toggle('open');
    document.body.classList.toggle('no-scroll');
  });
  navLinksContainer.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinksContainer.classList.remove('open');
      document.body.classList.remove('no-scroll');
    });
  });

  // ── Hero Text Rotator ────────────────────────────────
  const heroEyebrow = document.querySelector('.hero-eyebrow span:last-child');
  const heroTitle = document.querySelector('.hero-title');
  const heroTagline = document.querySelector('.hero-tagline');

  if (heroEyebrow && heroTitle && heroTagline) {
    const vars = [
      { eyebrow: "Open to Opportunities", title: "AI Engineer &<br><span class='text-highlight'>Data Scientist</span>", tagline: "A passionate developer building impactful data-driven solutions." },
      { eyebrow: "Available for Hire", title: "ML & Deep Learning<br><span class='text-highlight'>Developer</span>", tagline: "Turning complex data into actionable business intelligence." },
      { eyebrow: "Creative Mind", title: "Data Visualizer &<br><span class='text-highlight'>Analyst</span>", tagline: "Bridging the gap between raw numbers and visual stories." },
      { eyebrow: "Impact Driven", title: "Python & Machine<br><span class='text-highlight'>Learning</span>", tagline: "Architecting intelligent systems for real-world challenges." },
      { eyebrow: "Detail Oriented", title: "Business<br><span class='text-highlight'>Intelligence</span>", tagline: "Empowering organizations with data-backed strategic decisions." }
    ];

    let cur = 0;
    const els = [heroEyebrow, heroTitle, heroTagline];
    els.forEach(el => { el.style.transition = 'all 0.7s cubic-bezier(0.15,1,0.3,1)'; el.style.willChange = 'transform,opacity,filter'; });

    setInterval(() => {
      cur = (cur + 1) % vars.length;
      const v = vars[cur];
      els.forEach(el => { el.style.opacity = 0; el.style.transform = 'translateY(12px)'; el.style.filter = 'blur(6px)'; });
      setTimeout(() => {
        heroEyebrow.textContent = v.eyebrow;
        heroTitle.innerHTML = v.title;
        heroTagline.textContent = v.tagline;
        els.forEach(el => { el.style.opacity = 1; el.style.transform = 'translateY(0)'; el.style.filter = 'blur(0)'; });
      }, 500);
    }, 3500);
  }

  // ── Scroll Animations ────────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.getAttribute('data-delay') || 0;
        setTimeout(() => entry.target.classList.add('visible'), parseInt(delay));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

  // ── Skill Bar Animation ──────────────────────────────
  const skillObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        setTimeout(() => { e.target.style.width = e.target.getAttribute('data-width') + '%'; }, 200);
        skillObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.tile-fill').forEach(f => skillObs.observe(f));

  // ── Counter Animation ────────────────────────────────
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const target = parseInt(e.target.getAttribute('data-count'));
        const start = performance.now();
        const dur = 1400;
        function update(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          e.target.textContent = Math.floor(eased * target);
          if (p < 1) requestAnimationFrame(update);
          else e.target.textContent = target;
        }
        requestAnimationFrame(update);
        counterObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.metric-value[data-count]').forEach(c => counterObs.observe(c));

  // ── 3D Tilt Effect ───────────────────────────────────
  if (isDesktop && !prefersReducedMotion) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      const max = parseFloat(card.getAttribute('data-tilt-max')) || 6;
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -max;
        const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * max;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02,1.02,1.02)`;
        card.style.transition = 'transform 0.1s ease';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
        card.style.transition = 'transform 0.5s cubic-bezier(0.15,1,0.3,1)';
      });
    });

    // Skill tile micro-tilt
    document.querySelectorAll('.skill-tile').forEach(t => {
      t.addEventListener('mousemove', e => {
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        t.style.transform = `translateY(-4px) rotateX(${y*-4}deg) rotateY(${x*4}deg)`;
        t.style.transition = 'transform 0.15s ease';
      });
      t.addEventListener('mouseleave', () => { t.style.transform = ''; t.style.transition = 'all .4s cubic-bezier(.15,1,.3,1)'; });
    });

    // Info chip micro-tilt
    document.querySelectorAll('.info-chip').forEach(c => {
      c.addEventListener('mousemove', e => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = `translateY(-3px) rotateX(${y*-3}deg) rotateY(${x*3}deg)`;
      });
      c.addEventListener('mouseleave', () => { c.style.transform = ''; });
    });
  }

  // ── Carousel ─────────────────────────────────────────
  const track = document.getElementById('carouselTrack');
  const slides = track ? track.querySelectorAll('.chart-slide') : [];
  const dotsC = document.getElementById('carouselDots');
  let cs = 0, autoplay;

  if (slides.length > 0) {
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.classList.add('chart-dot');
      if (i === 0) d.classList.add('active');
      d.addEventListener('click', () => go(i));
      if (dotsC) dotsC.appendChild(d);
    });
    const prev = document.getElementById('carouselPrev');
    const next = document.getElementById('carouselNext');
    if (prev) prev.addEventListener('click', () => go((cs - 1 + slides.length) % slides.length));
    if (next) next.addEventListener('click', () => go((cs + 1) % slides.length));
    autoplay = setInterval(() => go((cs + 1) % slides.length), 5000);
  }
  function go(i) {
    cs = i;
    if (track) track.style.transform = `translateX(-${cs * 100}%)`;
    if (dotsC) dotsC.querySelectorAll('.chart-dot').forEach((d, j) => d.classList.toggle('active', j === cs));
    clearInterval(autoplay);
    autoplay = setInterval(() => go((cs + 1) % slides.length), 5000);
  }

  // ── Contact Form (Web3Forms) ─────────────────────────
  const form = document.getElementById('contactForm');
  const btn = document.getElementById('formSubmit');
  if (form && btn) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const key = form.querySelector('input[name="access_key"]').value;
      if (key === 'YOUR_ACCESS_KEY_HERE') { alert('Config in progress. Use email link.'); return; }
      const orig = btn.innerHTML;
      btn.innerHTML = '<span>⏳ Sending…</span>';
      btn.disabled = true;
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
      .then(async r => {
        const res = await r.json();
        if (r.status === 200) { btn.innerHTML = '<span>🚀 Sent!</span>'; btn.style.background = 'linear-gradient(135deg,#00ff88,#00d4ff)'; form.reset(); }
        else { btn.innerHTML = '<span>❌ Error</span>'; btn.style.background = '#e74c3c'; }
      })
      .catch(() => { btn.innerHTML = '<span>❌ Error</span>'; })
      .then(() => { setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; }, 4000); });
    });
  }

  // ── Smooth Scroll ────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ── Custom Cursor Glow ───────────────────────────────
  if (isDesktop && !prefersReducedMotion) {
    const cursor = document.createElement('div');
    cursor.style.cssText = `position:fixed;width:280px;height:280px;border-radius:50%;
      background:radial-gradient(circle,rgba(0,212,255,0.06) 0%,rgba(123,45,255,0.03) 40%,transparent 70%);
      pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:opacity .3s`;
    document.body.appendChild(cursor);
    let cx = 0, cy = 0, mx = 0, my = 0;
    document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });
    (function loop() {
      mx += (cx - mx) * 0.08; my += (cy - my) * 0.08;
      cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
      requestAnimationFrame(loop);
    })();
  }

});

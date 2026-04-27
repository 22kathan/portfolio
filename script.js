/* ═══════════════════════════════════════════════════════════
   PORTFOLIO — Gadhiya Kathan — Handcrafted 3D UI Engine
   Smooth animations, 3D tilt, parallax, carousel, perf-first
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── Detect capabilities ────────────────────────────────
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.innerWidth > 768 && !isTouchDevice;

    // ── Navbar Scroll ───────────────────────────────────────
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section, .hero');

    let ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;

            if (scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 150;
                if (scrollY >= sectionTop) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + current) {
                    link.classList.add('active');
                }
            });

            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // ── Mobile Navigation ───────────────────────────────────
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

    // ── Hero Text Rotator ───────────────────────────────────
    const heroEyebrow = document.querySelector('.hero-eyebrow span:last-child');
    const heroTitle = document.querySelector('.hero-title');
    const heroTagline = document.querySelector('.hero-tagline');

    if (heroEyebrow && heroTitle && heroTagline) {
        const heroVariations = [
            {
                eyebrow: "Open to Opportunities",
                title: "AI Engineer &<br><span class='text-highlight'>Data Scientist</span>",
                tagline: "A passionate developer building impactful data-driven solutions."
            },
            {
                eyebrow: "Available for Hire",
                title: "ML & Deep Learning<br><span class='text-highlight'>Developer</span>",
                tagline: "Turning complex data into actionable business intelligence."
            },
            {
                eyebrow: "Creative Mind",
                title: "Data Visualizer &<br><span class='text-highlight'>Analyst</span>",
                tagline: "Bridging the gap between raw numbers and visual stories."
            },
            {
                eyebrow: "Impact Driven",
                title: "Python & Machine<br><span class='text-highlight'>Learning</span>",
                tagline: "Architecting intelligent systems for real-world challenges."
            },
            {
                eyebrow: "Detail Oriented",
                title: "Business<br><span class='text-highlight'>Intelligence</span>",
                tagline: "Empowering organizations with data-backed strategic decisions."
            }
        ];

        let currentVar = 0;

        function rotateHeroText() {
            currentVar = (currentVar + 1) % heroVariations.length;
            const v = heroVariations[currentVar];

            [heroEyebrow, heroTitle, heroTagline].forEach(el => {
                el.style.opacity = 0;
                el.style.transform = 'translateY(12px)';
                el.style.filter = 'blur(6px)';
            });

            setTimeout(() => {
                heroEyebrow.textContent = v.eyebrow;
                heroTitle.innerHTML = v.title;
                heroTagline.textContent = v.tagline;

                [heroEyebrow, heroTitle, heroTagline].forEach(el => {
                    el.style.opacity = 1;
                    el.style.transform = 'translateY(0)';
                    el.style.filter = 'blur(0)';
                });
            }, 500);
        }

        [heroEyebrow, heroTitle, heroTagline].forEach(el => {
            el.style.transition = 'all 0.7s cubic-bezier(0.15, 1, 0.3, 1)';
            el.style.willChange = 'transform, opacity, filter';
        });

        setInterval(rotateHeroText, 3500);
    }

    // ── Scroll Animations (Intersection Observer) ───────────
    const animatedElements = document.querySelectorAll('[data-animate]');

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay') || 0;
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, parseInt(delay));
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));

    // ── Skill Bar Animation ─────────────────────────────────
    const tileFills = document.querySelectorAll('.tile-fill');

    const skillObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const width = entry.target.getAttribute('data-width');
                setTimeout(() => {
                    entry.target.style.width = width + '%';
                }, 200);
                skillObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    tileFills.forEach(fill => skillObserver.observe(fill));

    // ── Counter Animation ───────────────────────────────────
    const counters = document.querySelectorAll('.metric-value[data-count]');

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-count'));
                animateCounter(entry.target, target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));

    function animateCounter(element, target) {
        let current = 0;
        const duration = 1400;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            current = Math.floor(eased * target);
            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }

        requestAnimationFrame(update);
    }

    // ── 3D Card Tilt Effect ─────────────────────────────────
    if (isDesktop && !prefersReducedMotion) {
        const tiltCards = document.querySelectorAll('[data-tilt]');
        
        tiltCards.forEach(card => {
            const maxTilt = parseFloat(card.getAttribute('data-tilt-max')) || 6;
            
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -maxTilt;
                const rotateY = ((x - centerX) / centerX) * maxTilt;
                
                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                card.style.transition = 'transform 0.1s ease';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
                card.style.transition = 'transform 0.5s cubic-bezier(0.15, 1, 0.3, 1)';
            });
        });

        // Subtle parallax on skill tiles
        const skillTiles = document.querySelectorAll('.skill-tile');
        skillTiles.forEach(tile => {
            tile.addEventListener('mousemove', (e) => {
                const rect = tile.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                tile.style.transform = `translateY(-4px) rotateX(${y * -4}deg) rotateY(${x * 4}deg)`;
                tile.style.transition = 'transform 0.15s ease';
            });
            tile.addEventListener('mouseleave', () => {
                tile.style.transform = '';
                tile.style.transition = 'all 0.4s cubic-bezier(0.15,1,0.3,1)';
            });
        });

        // Info chips micro-tilt
        const infoChips = document.querySelectorAll('.info-chip');
        infoChips.forEach(chip => {
            chip.addEventListener('mousemove', (e) => {
                const rect = chip.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                chip.style.transform = `translateY(-3px) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
            });
            chip.addEventListener('mouseleave', () => {
                chip.style.transform = '';
            });
        });
    }

    // ── Chart Carousel ──────────────────────────────────────
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    const dotsContainer = document.getElementById('carouselDots');
    const slides = track ? track.querySelectorAll('.chart-slide') : [];
    let currentSlide = 0;
    let autoplayInterval;

    function createDots() {
        if (!dotsContainer) return;
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.classList.add('chart-dot');
            dot.setAttribute('aria-label', `Go to chart ${i + 1}`);
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });
    }

    function updateDots() {
        if (!dotsContainer) return;
        dotsContainer.querySelectorAll('.chart-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    function goToSlide(index) {
        if (!track) return;
        currentSlide = index;
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        updateDots();
        resetAutoplay();
    }

    function nextSlide() { goToSlide((currentSlide + 1) % slides.length); }
    function prevSlide() { goToSlide((currentSlide - 1 + slides.length) % slides.length); }

    function resetAutoplay() {
        clearInterval(autoplayInterval);
        autoplayInterval = setInterval(nextSlide, 5000);
    }

    if (slides.length > 0) {
        createDots();
        if (prevBtn) prevBtn.addEventListener('click', prevSlide);
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);
        autoplayInterval = setInterval(nextSlide, 5000);

        let touchStartX = 0;
        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) { diff > 0 ? nextSlide() : prevSlide(); }
        }, { passive: true });
    }

    // ── Functional Contact Form (Web3Forms AJAX) ───────────
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('formSubmit');

    if (contactForm && submitBtn) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const accessKey = contactForm.querySelector('input[name="access_key"]').value;
            if (accessKey === 'YOUR_ACCESS_KEY_HERE') {
                alert('Website configuration in progress. Please use the direct email link for now.');
                return;
            }

            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>⏳ Sending to Inbox…</span>';
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;

            const formData = new FormData(contactForm);
            const object = Object.fromEntries(formData);
            const json = JSON.stringify(object);

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: json
            })
            .then(async (response) => {
                let result = await response.json();
                if (response.status == 200) {
                    submitBtn.innerHTML = '<span>🚀 Message Sent Successfully!</span>';
                    submitBtn.style.background = '#28c840';
                    contactForm.reset();
                } else {
                    submitBtn.innerHTML = '<span>❌ Error. Please Try Again.</span>';
                    submitBtn.style.background = '#e74c3c';
                }
            })
            .catch(error => {
                submitBtn.innerHTML = '<span>❌ Connection Error.</span>';
            })
            .then(() => {
                setTimeout(() => {
                    submitBtn.innerHTML = originalHTML;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('loading');
                }, 4000);
            });
        });
    }

    // ── Smooth scroll for all anchor links ──────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ── Custom cursor glow (desktop only) ───────────────────
    if (isDesktop && !prefersReducedMotion) {
        const cursor = document.createElement('div');
        cursor.style.cssText = `
            position: fixed; width: 300px; height: 300px; border-radius: 50%;
            background: radial-gradient(circle, rgba(232,168,56,0.06) 0%, transparent 70%);
            pointer-events: none; z-index: 9999; transform: translate(-50%, -50%);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(cursor);

        let cursorX = 0, cursorY = 0, currentX = 0, currentY = 0;

        document.addEventListener('mousemove', (e) => {
            cursorX = e.clientX;
            cursorY = e.clientY;
        });

        function updateCursor() {
            currentX += (cursorX - currentX) * 0.08;
            currentY += (cursorY - currentY) * 0.08;
            cursor.style.left = currentX + 'px';
            cursor.style.top = currentY + 'px';
            requestAnimationFrame(updateCursor);
        }
        updateCursor();
    }

});

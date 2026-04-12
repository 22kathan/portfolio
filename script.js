/* ═══════════════════════════════════════════════════════════
   PORTFOLIO — Gadhiya Kathan — V3 Interactive JavaScript
   Smooth animations, 3D tilt, typewriter, carousel, perf-first
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

            // Navbar background
            if (scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            // Active nav link
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
    });

    navLinksContainer.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinksContainer.classList.remove('open');
        });
    });

    // ── Typewriter Effect ───────────────────────────────────
    const typewriterEl = document.getElementById('typewriter');
    const phrases = [
        'Data Science Enthusiast',
        'Python Developer',
        'Visualization Specialist',
        'Problem Solver',
        'Continuous Learner'
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 80;

    function typewrite() {
        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            typewriterEl.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typeSpeed = 35;
        } else {
            typewriterEl.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typeSpeed = 75;
        }

        if (!isDeleting && charIndex === currentPhrase.length) {
            typeSpeed = 2200;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typeSpeed = 400;
        }

        setTimeout(typewrite, typeSpeed);
    }

    typewrite();

    // ── Scroll Animations (Intersection Observer) ───────────
    const animatedElements = document.querySelectorAll('[data-animate]');

    const observerOptions = {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
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
                entry.target.style.setProperty('--fill-width', width + '%');
                entry.target.classList.add('animated');
                skillObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

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
        const duration = 1200;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing — ease out cubic
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

    // ── 3D Card Tilt (Desktop only, performance-safe) ───────
    if (isDesktop && !prefersReducedMotion) {
        const tiltCards = document.querySelectorAll('[data-tilt]');

        tiltCards.forEach(card => {
            let rafId = null;
            let currentX = 0, currentY = 0;
            let targetX = 0, targetY = 0;

            const maxTilt = parseFloat(card.getAttribute('data-tilt-max') || 4);

            card.addEventListener('mouseenter', () => {
                card.style.transition = 'box-shadow 0.3s ease';
            });

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // Normalized -1 to 1
                const normalX = (e.clientX - centerX) / (rect.width / 2);
                const normalY = (e.clientY - centerY) / (rect.height / 2);

                targetX = -normalY * maxTilt; // rotateX
                targetY = normalX * maxTilt;  // rotateY

                if (!rafId) {
                    rafId = requestAnimationFrame(function updateTilt() {
                        // Smooth lerp
                        currentX += (targetX - currentX) * 0.12;
                        currentY += (targetY - currentY) * 0.12;

                        card.style.transform = `perspective(1200px) rotateX(${currentX}deg) rotateY(${currentY}deg) translateZ(5px)`;

                        if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
                            rafId = requestAnimationFrame(updateTilt);
                        } else {
                            rafId = null;
                        }
                    });
                }
            });

            card.addEventListener('mouseleave', () => {
                targetX = 0;
                targetY = 0;
                card.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease';
                card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)';

                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
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

    function nextSlide() {
        goToSlide((currentSlide + 1) % slides.length);
    }

    function prevSlide() {
        goToSlide((currentSlide - 1 + slides.length) % slides.length);
    }

    function resetAutoplay() {
        clearInterval(autoplayInterval);
        autoplayInterval = setInterval(nextSlide, 5000);
    }

    if (slides.length > 0) {
        createDots();
        if (prevBtn) prevBtn.addEventListener('click', prevSlide);
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);
        autoplayInterval = setInterval(nextSlide, 5000);

        // Touch / Swipe support
        let touchStartX = 0;

        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? nextSlide() : prevSlide();
            }
        }, { passive: true });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
        });
    }

    // ── Contact Form (mailto fallback) ──────────────────────
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('formName').value.trim();
            const email = document.getElementById('formEmail').value.trim();
            const message = document.getElementById('formMessage').value.trim();

            if (!name || !email || !message) return;

            const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
            const mailtoLink = `mailto:gadhiyakathan10@gmail.com?subject=${subject}&body=${body}`;

            window.location.href = mailtoLink;

            // Visual feedback
            const submitBtn = document.getElementById('formSubmit');
            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>✓ Opening Email Client…</span>';
            submitBtn.style.background = 'linear-gradient(135deg, #5bba6f, #a3d9d1)';

            setTimeout(() => {
                submitBtn.innerHTML = originalHTML;
                submitBtn.style.background = '';
                contactForm.reset();
            }, 3000);
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

    // ── Parallax on hero visual (Desktop only) ──────────────
    if (isDesktop && !prefersReducedMotion) {
        const heroVisual = document.querySelector('.terminal-card');
        if (heroVisual) {
            let parallaxRaf = null;
            window.addEventListener('scroll', () => {
                if (parallaxRaf) return;
                parallaxRaf = requestAnimationFrame(() => {
                    const scrolled = window.scrollY;
                    const rate = scrolled * 0.12;
                    heroVisual.style.transform = `translateY(-${rate}px) rotateX(${scrolled * 0.01}deg)`;
                    parallaxRaf = null;
                });
            }, { passive: true });
        }
    }

});

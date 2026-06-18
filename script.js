document.addEventListener('DOMContentLoaded', () => {

    const navbar = document.getElementById('navbar');
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    const allNavLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    const navOverlay = document.getElementById('navOverlay');
    if (mobileToggle && navLinks) {
        const toggleMenu = () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('open');
            if (navOverlay) navOverlay.classList.toggle('active');
        };

        mobileToggle.addEventListener('click', toggleMenu);

        if (navOverlay) {
            navOverlay.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('open');
                navOverlay.classList.remove('active');
            });
        }

        // Close on link click
        allNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('open');
                if (navOverlay) navOverlay.classList.remove('active');
            });
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }

        // Active link tracking
        let current = '';
        document.querySelectorAll('.section').forEach(section => {
            if (window.scrollY >= section.offsetTop - 200) {
                current = section.getAttribute('id');
            }
        });

        allNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Hero text rotator
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) {
        const titles = [
            "Engineering the <span class='highlight'>Future</span><br>of AI & Data.",
            "Building <span class='highlight'>Intelligent</span><br>Machine Learning Systems.",
            "Architecting <span class='highlight'>Scalable</span><br>Data Solutions.",
            "Designing <span class='highlight'>Premium</span><br>Web Experiences."
        ];
        let i = 0;
        heroTitle.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        setInterval(() => {
            i = (i + 1) % titles.length;
            heroTitle.style.opacity = '0';
            heroTitle.style.transform = 'translateY(15px)';
            setTimeout(() => {
                heroTitle.innerHTML = titles[i];
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateY(0)';
            }, 400);
        }, 2000);
    }

    // Scroll animations
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    } else {
        document.querySelectorAll('[data-animate]').forEach(el => el.classList.add('visible'));
    }

    // Particle canvas
    const canvas = document.getElementById('bgCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
        const isMobile = window.innerWidth <= 768;
        const count = isMobile ? 30 : 80;
        let mouse = { x: null, y: null };

        window.addEventListener('resize', () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; });
        window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
        window.addEventListener('mouseout', () => { mouse.x = mouse.y = null; });

        class P {
            constructor() { this.x = Math.random()*w; this.y = Math.random()*h; this.vx = (Math.random()-0.5); this.vy = (Math.random()-0.5); this.s = Math.random()*2+1; }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > w) this.vx *= -1;
                if (this.y < 0 || this.y > h) this.vy *= -1;
                if (mouse.x && mouse.y) { let dx=mouse.x-this.x, dy=mouse.y-this.y; if (Math.sqrt(dx*dx+dy*dy)<150) { this.x-=dx*0.02; this.y-=dy*0.02; }}
            }
            draw() { ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fillStyle='rgba(0,255,204,0.4)'; ctx.fill(); }
        }

        const ps = Array.from({length:count}, () => new P());
        (function loop() {
            ctx.clearRect(0,0,w,h);
            ps.forEach((p,i) => { p.update(); p.draw(); for (let j=i+1;j<ps.length;j++) { let dx=p.x-ps[j].x, dy=p.y-ps[j].y, d=Math.sqrt(dx*dx+dy*dy); if(d<150){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(ps[j].x,ps[j].y);ctx.strokeStyle=`rgba(0,255,204,${(1-d/150)*0.25})`;ctx.lineWidth=1;ctx.stroke();}}});
            requestAnimationFrame(loop);
        })();
    }

    // Contact form
    const form = document.getElementById('contactForm');
    const btn = document.getElementById('formSubmit');
    if (form && btn) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const orig = btn.innerHTML;
            btn.innerHTML = 'Sending...'; btn.disabled = true;
            fetch('https://api.web3forms.com/submit', {
                method: 'POST', headers: {'Content-Type':'application/json',Accept:'application/json'},
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            })
            .then(r => { btn.innerHTML = r.status===200 ? (form.reset(),'Message Sent!') : 'Error'; })
            .catch(() => { btn.innerHTML = 'Error'; })
            .finally(() => { setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000); });
        });
    }

    // Tech Stack Filter Logic
    const filterButtons = document.querySelectorAll('.filter-btn');
    const skillCards = document.querySelectorAll('.skill-category-card');

    if (filterButtons.length > 0 && skillCards.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');

                const filter = btn.getAttribute('data-filter');

                skillCards.forEach(card => {
                    const category = card.getAttribute('data-category');
                    if (filter === 'all' || category === filter) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                });
            });
        });
    }

    // 3D skill card hover
    document.querySelectorAll('.skill-category-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect(), x = e.clientX-r.left, y = e.clientY-r.top;
            card.style.setProperty('--mouse-x', x+'px');
            card.style.setProperty('--mouse-y', y+'px');
            card.style.setProperty('--rotate-x', ((y-r.height/2)/r.height*-10)+'deg');
            card.style.setProperty('--rotate-y', ((x-r.width/2)/r.width*10)+'deg');
        });
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--rotate-x','0deg');
            card.style.setProperty('--rotate-y','0deg');
        });
    });
});

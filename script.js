document.addEventListener('DOMContentLoaded', () => {

    // Mobile Menu
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    const navLinks = document.querySelectorAll('.nav-link');

    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        mobileToggle.classList.toggle('active');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
            mobileToggle.classList.remove('active');
        });
    });

    // Header Text Rotator (every 2 seconds)
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) {
        const titles = [
            "Engineering the <span class='highlight'>Future</span><br>of AI & Data.",
            "Building <span class='highlight'>Intelligent</span><br>Machine Learning Systems.",
            "Architecting <span class='highlight'>Scalable</span><br>Data Solutions.",
            "Designing <span class='highlight'>Premium</span><br>Web Experiences."
        ];
        let titleIndex = 0;
        
        heroTitle.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setInterval(() => {
            titleIndex = (titleIndex + 1) % titles.length;
            heroTitle.style.opacity = '0';
            heroTitle.style.transform = 'translateY(15px)';
            
            setTimeout(() => {
                heroTitle.innerHTML = titles[titleIndex];
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateY(0)';
            }, 400); 
        }, 2000); 
    }

    // Scroll Animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

    // Active Navigation State
    const sections = document.querySelectorAll('.section');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // --- Interactive 3D Particle Network Canvas Effect ---
    const canvas = document.getElementById('bgCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        let particles = [];
        const isMobile = window.innerWidth <= 768;
        const particleCount = isMobile ? 30 : 80; // Optimized count
        const connectionDistance = 150;

        let mouse = { x: null, y: null };

        window.addEventListener('resize', () => {
            if (window.innerWidth !== width) { // Prevent jumpiness on mobile scrolling
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
            }
        });

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });
        window.addEventListener('mouseout', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = (Math.random() - 0.5) * 1;
                this.size = Math.random() * 2 + 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse interaction - repel slightly
                if (mouse.x && mouse.y) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        this.x -= dx * 0.02;
                        this.y -= dy * 0.02;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 204, 0.4)';
                ctx.fill();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                // Connect particles
                for (let j = i + 1; j < particles.length; j++) {
                    let dx = particles[i].x - particles[j].x;
                    let dy = particles[i].y - particles[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDistance) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        let opacity = 1 - (dist / connectionDistance);
                        ctx.strokeStyle = `rgba(0, 255, 204, ${opacity * 0.25})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    // Contact Form submission
    const form = document.getElementById('contactForm');
    const btn = document.getElementById('formSubmit');
    if (form && btn) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const orig = btn.innerHTML;
            btn.innerHTML = 'Sending...';
            btn.disabled = true;

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            })
            .then(async r => {
                if (r.status === 200) { 
                    btn.innerHTML = 'Message Sent!'; 
                    form.reset(); 
                } else { 
                    btn.innerHTML = 'Error Sending'; 
                }
            })
            .catch(() => { btn.innerHTML = 'Error Sending'; })
            .then(() => { 
                setTimeout(() => { 
                    btn.innerHTML = orig; 
                    btn.disabled = false; 
                }, 3000); 
            });
        });
    }
});

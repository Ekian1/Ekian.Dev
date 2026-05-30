// ========================================
// ekian.dev — JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Navbar scroll behavior ---
    const nav = document.getElementById('main-nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;

        if (currentScroll > 20) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    }, { passive: true });

    // --- Mobile menu toggle ---
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu on link click
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Lesson Filtering ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    const lessonCards = document.querySelectorAll('.lesson-card');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            lessonCards.forEach(card => {
                const level = card.dataset.level;
                if (level && !['beginner', 'intermediate', 'advanced'].includes(level)) {
                    console.warn('Invalid lesson level:', level);
                    return;
                }
                const access = card.dataset.access;

                let show = false;

                if (filter === 'all') {
                    show = true;
                } else if (filter === 'free') {
                    show = access === 'free';
                } else {
                    show = level === filter;
                }

                if (show) {
                    card.classList.remove('hidden');
                    // Re-trigger animation
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(16px)';
                    requestAnimationFrame(() => {
                        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // --- FAQ Accordion ---
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all
            faqItems.forEach(i => {
                i.classList.remove('active');
                i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
            });

            // Open clicked if it was closed
            if (!isActive) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // --- Scroll reveal animations ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all animatable elements
    const animatableElements = document.querySelectorAll(
        '.curriculum-card, .feature-card, .lesson-card, .pricing-card, .faq-item'
    );

    animatableElements.forEach(el => {
        observer.observe(el);
    });

    // --- Smooth scroll for anchor links ---
    const validSections = ['curriculum', 'lessons', 'pricing', 'faq', 'why'];
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (!href || !href.startsWith('#') || href === '#') return;
            
            const sectionId = href.substring(1);
            if (!validSections.includes(sectionId)) {
                console.warn('Invalid section:', sectionId);
                return;
            }

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const navHeight = nav.offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Helper paths ---
    function getProPageUrl() {
        const basePath = window.location.origin;
        return new URL('pro.html', basePath).href;
    }
    const proPageUrl = getProPageUrl();

    // --- Standard Pro Card Click Handler ---
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.lesson-card[data-access="pro"]');
        if (card) {
            e.preventDefault();
            window.location.href = proPageUrl;
        }
    });

    // --- Code window typing effect on hero ---
    const codeWindow = document.getElementById('hero-code-window');
    if (codeWindow) {
        let tick = 0;
        const float = () => {
            tick += 0.01;
            const y = Math.sin(tick) * 3;
            codeWindow.style.transform = `translateY(${y}px)`;
            requestAnimationFrame(float);
        };
        float();
    }
});

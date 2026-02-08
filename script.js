/* =====================================================
   LIVING FITNESS - Premium 3D Interactive Engine
   Advanced interactivity with cursor, counters, magnetics
   ===================================================== */

(function () {
    'use strict';

    // =====================================================
    // Configuration
    // =====================================================
    const CONFIG = {
        scroll: {
            damping: 0.08,
            maxVelocity: 400,
            pauseThreshold: 500,
            intensityWindow: 2000
        },
        breath: {
            inhale: 1.5,
            pause1: 0.3,
            exhale: 2.5,
            pause2: 0.3,
            minCycleMultiplier: 0.55,
            depthBase: 1,
            depthIntense: 1.5
        },
        heartbeat: {
            baseInterval: 1000,
            minInterval: 650,
            driftRange: 50,
            activationDepth: 0.30
        },
        fatigue: {
            activationDepth: 0.75,
            maxFatigue: 1,
            spacingMultiplier: 1.4
        },
        longPress: {
            duration: 2000
        },
        cursor: {
            smoothing: 0.15
        },
        counter: {
            duration: 2000
        }
    };

    // =====================================================
    // State
    // =====================================================
    const state = {
        lastFrame: 0,
        deltaTime: 0,
        timeScale: 1,
        targetTimeScale: 1,

        scrollY: 0,
        lastScrollY: 0,
        scrollVelocity: 0,
        smoothedVelocity: 0,
        lastScrollTime: 0,
        scrollDepth: 0,

        intensitySamples: [],
        smoothedIntensity: 0,
        normalizedIntensity: 0,

        breathPhase: 0,
        breathTime: 0,
        breathState: 'inhale',
        breathDepth: 1,

        heartbeatActive: false,
        heartbeatScale: 1,
        lastBeatTime: 0,
        nextBeatInterval: CONFIG.heartbeat.baseInterval,

        fatigueLevel: 0,

        ctaHolding: false,
        ctaHoldStart: 0,
        ctaProgress: 0,
        ctaCompleted: false,

        // Cursor state
        cursorX: 0,
        cursorY: 0,
        targetCursorX: 0,
        targetCursorY: 0,
        isHovering: false,
        isClicking: false,

        elements: {}
    };

    // =====================================================
    // Utilities
    // =====================================================
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
    const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const getScrollDepth = () => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        return docHeight > 0 ? window.scrollY / docHeight : 0;
    };

    // =====================================================
    // Custom Cursor with Trail
    // =====================================================
    const cursorTrail = {
        dots: [],
        maxDots: 12,
        positions: []
    };

    function updateCursor() {
        state.cursorX = lerp(state.cursorX, state.targetCursorX, CONFIG.cursor.smoothing);
        state.cursorY = lerp(state.cursorY, state.targetCursorY, CONFIG.cursor.smoothing);

        const cursor = state.elements.cursor;
        if (cursor) {
            cursor.style.transform = `translate3d(${state.cursorX}px, ${state.cursorY}px, 0)`;
        }

        // Update trail positions
        updateCursorTrail();
    }

    function updateCursorTrail() {
        // Add current position
        cursorTrail.positions.unshift({ x: state.cursorX, y: state.cursorY });

        // Limit history
        if (cursorTrail.positions.length > cursorTrail.maxDots) {
            cursorTrail.positions.pop();
        }

        // Update trail dots
        cursorTrail.dots.forEach((dot, i) => {
            const pos = cursorTrail.positions[Math.min(i * 2, cursorTrail.positions.length - 1)];
            if (pos) {
                const scale = 1 - (i / cursorTrail.maxDots) * 0.8;
                const opacity = 1 - (i / cursorTrail.maxDots);
                dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`;
                dot.style.opacity = opacity * 0.5;
            }
        });
    }

    function createCursorTrail() {
        // Only create on desktop
        if (window.innerWidth <= 768) return;

        for (let i = 0; i < cursorTrail.maxDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'cursor-trail';
            dot.style.transition = `transform ${0.1 + i * 0.02}s ease-out, opacity 0.2s`;
            document.body.appendChild(dot);
            cursorTrail.dots.push(dot);
        }
    }

    function setupCursor() {
        const cursor = document.getElementById('cursor');
        state.elements.cursor = cursor;

        // Create trail dots
        createCursorTrail();

        document.addEventListener('mousemove', (e) => {
            state.targetCursorX = e.clientX;
            state.targetCursorY = e.clientY;
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.add('cursor-active');
        });

        document.addEventListener('mouseup', () => {
            document.body.classList.remove('cursor-active');
        });

        // Hover effects for interactive elements
        const hoverTargets = document.querySelectorAll('a, button, .bento-card, .stat-card, .magnetic-btn');
        hoverTargets.forEach(target => {
            target.addEventListener('mouseenter', () => {
                document.body.classList.add('cursor-hover');
            });
            target.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-hover');
            });
        });
    }

    // =====================================================
    // Magnetic Buttons
    // =====================================================
    function setupMagneticButtons() {
        const buttons = document.querySelectorAll('.magnetic-btn');

        buttons.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const deltaX = (e.clientX - centerX) * 0.2;
                const deltaY = (e.clientY - centerY) * 0.2;

                btn.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // =====================================================
    // Animated Counters
    // =====================================================
    function setupCounters() {
        const counters = document.querySelectorAll('.counter');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.counted) {
                    entry.target.dataset.counted = 'true';
                    animateCounter(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => observer.observe(counter));
    }

    function animateCounter(element) {
        const target = parseFloat(element.dataset.target);
        const decimals = parseInt(element.dataset.decimals) || 0;
        const duration = CONFIG.counter.duration;
        const start = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutExpo(progress);
            const current = target * eased;

            element.textContent = current.toFixed(decimals);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // =====================================================
    // Reveal on Scroll
    // =====================================================
    function setupRevealOnScroll() {
        const reveals = document.querySelectorAll('.reveal-on-scroll');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.delay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('revealed');
                    }, delay);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        reveals.forEach(el => observer.observe(el));
    }

    // =====================================================
    // Split Text Animation
    // =====================================================
    function setupSplitText() {
        const splitTexts = document.querySelectorAll('.split-text');

        splitTexts.forEach(text => {
            const content = text.textContent;
            text.innerHTML = '';

            content.split('').forEach((char, i) => {
                const span = document.createElement('span');
                span.className = 'char';
                span.textContent = char === ' ' ? '\u00A0' : char;
                span.style.transitionDelay = `${i * 30}ms`;
                text.appendChild(span);
            });
        });

        // Trigger animation on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                }
            });
        }, { threshold: 0.3 });

        splitTexts.forEach(text => observer.observe(text));
    }

    // =====================================================
    // 3D Card Mouse Tracking
    // =====================================================
    function setup3DCards() {
        const cards = document.querySelectorAll('.card-3d');

        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;

                // Update glow position
                card.style.setProperty('--mouse-x', `${x * 100}%`);
                card.style.setProperty('--mouse-y', `${y * 100}%`);

                // 3D rotation based on mouse
                const rotateX = (y - 0.5) * -12;
                const rotateY = (x - 0.5) * 12;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.02)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // =====================================================
    // Newsletter Form
    // =====================================================
    function setupNewsletterForm() {
        const form = document.getElementById('newsletterForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            form.classList.add('submitted');
            form.querySelector('input').value = '';
            form.querySelector('input').blur();
        });
    }

    // =====================================================
    // Navigation
    // =====================================================
    function updateNavigation() {
        const nav = state.elements.nav;
        if (!nav) return;

        if (window.scrollY > 80) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    // =====================================================
    // Scroll Physics
    // =====================================================
    function updateScrollPhysics(timestamp) {
        const dt = state.deltaTime / 1000;
        if (dt <= 0) return;

        const rawVelocity = (state.scrollY - state.lastScrollY) / dt;
        state.smoothedVelocity += (rawVelocity - state.smoothedVelocity) * CONFIG.scroll.damping;
        state.lastScrollY = state.scrollY;
        state.scrollDepth = getScrollDepth();

        updateIntensity(timestamp, Math.abs(state.smoothedVelocity));

        const timeSinceScroll = timestamp - state.lastScrollTime;
        if (timeSinceScroll > CONFIG.scroll.pauseThreshold) {
            state.targetTimeScale = 0;
        } else {
            state.targetTimeScale = lerp(1, 1.8, state.normalizedIntensity);
        }

        if (state.scrollDepth > CONFIG.fatigue.activationDepth) {
            state.targetTimeScale = lerp(state.targetTimeScale, 0.5,
                (state.scrollDepth - CONFIG.fatigue.activationDepth) / (1 - CONFIG.fatigue.activationDepth));
        }

        state.timeScale += (state.targetTimeScale - state.timeScale) * 0.03;
    }

    function updateIntensity(timestamp, velocity) {
        state.intensitySamples.push({ time: timestamp, value: velocity });
        state.intensitySamples = state.intensitySamples.filter(s => timestamp - s.time < CONFIG.scroll.intensityWindow);

        if (state.intensitySamples.length > 0) {
            const sum = state.intensitySamples.reduce((acc, s) => acc + s.value, 0);
            state.smoothedIntensity = sum / state.intensitySamples.length;
        } else {
            state.smoothedIntensity = 0;
        }

        state.normalizedIntensity = clamp(state.smoothedIntensity / CONFIG.scroll.maxVelocity, 0, 1);
    }

    // =====================================================
    // Breathing System
    // =====================================================
    function updateBreathing(dt) {
        const scaledDt = dt * state.timeScale;
        const cycleMultiplier = lerp(1, CONFIG.breath.minCycleMultiplier, state.normalizedIntensity);

        const phaseDurations = {
            inhale: CONFIG.breath.inhale * cycleMultiplier * 1000,
            pause1: CONFIG.breath.pause1 * cycleMultiplier * 1000,
            exhale: CONFIG.breath.exhale * cycleMultiplier * 1000,
            pause2: CONFIG.breath.pause2 * cycleMultiplier * 1000
        };

        state.breathTime += scaledDt;
        const currentPhaseDuration = phaseDurations[state.breathState];

        if (state.breathTime >= currentPhaseDuration) {
            state.breathTime = 0;
            switch (state.breathState) {
                case 'inhale': state.breathState = 'pause1'; break;
                case 'pause1': state.breathState = 'exhale'; break;
                case 'exhale': state.breathState = 'pause2'; break;
                case 'pause2': state.breathState = 'inhale'; break;
            }
        }

        const progress = state.breathTime / currentPhaseDuration;
        state.breathDepth = lerp(CONFIG.breath.depthBase, CONFIG.breath.depthIntense, state.normalizedIntensity);

        switch (state.breathState) {
            case 'inhale': state.breathPhase = easeOutCubic(progress) * state.breathDepth; break;
            case 'pause1': state.breathPhase = state.breathDepth; break;
            case 'exhale': state.breathPhase = (1 - easeInOutSine(progress)) * state.breathDepth; break;
            case 'pause2': state.breathPhase = 0; break;
        }

        state.breathPhase = clamp(state.breathPhase / CONFIG.breath.depthIntense, 0, 1);
    }

    // =====================================================
    // Heartbeat System
    // =====================================================
    function updateHeartbeat(timestamp) {
        state.heartbeatActive = state.scrollDepth >= CONFIG.heartbeat.activationDepth;

        if (!state.heartbeatActive) {
            state.heartbeatScale = lerp(state.heartbeatScale, 1, 0.05);
            return;
        }

        const timeSinceBeat = timestamp - state.lastBeatTime;

        if (timeSinceBeat >= state.nextBeatInterval) {
            state.heartbeatScale = 1.25;
            state.lastBeatTime = timestamp;

            const intensityReduction = state.normalizedIntensity *
                (CONFIG.heartbeat.baseInterval - CONFIG.heartbeat.minInterval);
            const drift = (Math.random() - 0.5) * CONFIG.heartbeat.driftRange * 2;
            state.nextBeatInterval = CONFIG.heartbeat.baseInterval - intensityReduction + drift;
        }

        state.heartbeatScale = lerp(state.heartbeatScale, 1, 0.15);
    }

    // =====================================================
    // Fatigue System
    // =====================================================
    function updateFatigue() {
        if (state.scrollDepth > CONFIG.fatigue.activationDepth) {
            const fatigueProgress = (state.scrollDepth - CONFIG.fatigue.activationDepth) /
                (1 - CONFIG.fatigue.activationDepth);
            state.fatigueLevel = lerp(state.fatigueLevel, fatigueProgress, 0.02);
        } else {
            state.fatigueLevel = lerp(state.fatigueLevel, 0, 0.01);
        }
        state.fatigueLevel = clamp(state.fatigueLevel, 0, CONFIG.fatigue.maxFatigue);
    }

    // =====================================================
    // Long Press CTA
    // =====================================================
    function setupLongPressCTA() {
        const cta = document.getElementById('beginCta');
        if (!cta) return;

        state.elements.cta = cta;
        const progressEl = cta.querySelector('.cta-progress');

        const startHold = (e) => {
            if (state.ctaCompleted) return;
            e.preventDefault();
            state.ctaHolding = true;
            state.ctaHoldStart = performance.now();
            cta.classList.add('holding');
        };

        const endHold = () => {
            if (!state.ctaHolding) return;
            state.ctaHolding = false;
            state.ctaProgress = 0;
            cta.classList.remove('holding');
            if (progressEl) progressEl.style.transform = 'scaleX(0)';
        };

        cta.addEventListener('mousedown', startHold);
        cta.addEventListener('mouseup', endHold);
        cta.addEventListener('mouseleave', endHold);
        cta.addEventListener('touchstart', startHold, { passive: false });
        cta.addEventListener('touchend', endHold);
        cta.addEventListener('touchcancel', endHold);
    }

    function updateLongPressCTA(timestamp) {
        const cta = state.elements.cta;
        if (!cta || state.ctaCompleted) return;

        const progressEl = cta.querySelector('.cta-progress');

        if (state.ctaHolding) {
            const elapsed = timestamp - state.ctaHoldStart;
            state.ctaProgress = clamp(elapsed / CONFIG.longPress.duration, 0, 1);

            if (progressEl) progressEl.style.transform = `scaleX(${state.ctaProgress})`;

            if (state.ctaProgress >= 1) {
                state.ctaCompleted = true;
                state.ctaHolding = false;
                cta.classList.remove('holding');
                cta.classList.add('completed');

                // Celebrate!
                createConfetti();
            }
        }
    }

    // =====================================================
    // Confetti Effect
    // =====================================================
    function createConfetti() {
        const colors = ['#ff6b35', '#ff8f65', '#22c55e', '#4ade80', '#fafafa'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
        position: fixed;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${50 + (Math.random() - 0.5) * 30}%;
        top: 50%;
        pointer-events: none;
        z-index: 10001;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation: confettiFall ${Math.random() * 2 + 2}s ease-out forwards;
      `;

            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 4000);
        }

        // Add keyframes if not exists
        if (!document.getElementById('confettiStyles')) {
            const style = document.createElement('style');
            style.id = 'confettiStyles';
            style.textContent = `
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(${window.innerHeight}px) rotate(${Math.random() * 720}deg) scale(0);
            opacity: 0;
          }
        }
      `;
            document.head.appendChild(style);
        }
    }

    // =====================================================
    // Apply CSS Variables
    // =====================================================
    function applyCSSVariables() {
        const root = document.documentElement;

        root.style.setProperty('--breath-phase', state.breathPhase.toFixed(4));
        root.style.setProperty('--intensity', state.normalizedIntensity.toFixed(4));
        root.style.setProperty('--heartbeat-scale', state.heartbeatScale.toFixed(4));
        root.style.setProperty('--fatigue', state.fatigueLevel.toFixed(4));
        root.style.setProperty('--scroll-y', state.scrollY);

        const colorWarmth = 1 - state.fatigueLevel * 0.3;
        const colorContrast = 1 - state.fatigueLevel * 0.15;
        const accentIntensity = 1 - state.fatigueLevel * 0.4;
        const spacingScale = 1 + state.fatigueLevel * (CONFIG.fatigue.spacingMultiplier - 1);

        root.style.setProperty('--color-warmth', colorWarmth.toFixed(4));
        root.style.setProperty('--color-contrast', colorContrast.toFixed(4));
        root.style.setProperty('--accent-intensity', accentIntensity.toFixed(4));
        root.style.setProperty('--spacing-scale', spacingScale.toFixed(4));
        root.style.setProperty('--time-scale', state.timeScale.toFixed(4));
    }

    // =====================================================
    // Parallax Effect for Hero
    // =====================================================
    function updateParallax() {
        const heroLayerBack = document.querySelector('.hero-layer-back img');
        if (heroLayerBack && state.scrollY < window.innerHeight * 1.5) {
            const parallaxY = state.scrollY * 0.4;
            heroLayerBack.style.transform = `scale(${1.1 + state.breathPhase * 0.05}) translateY(${parallaxY}px)`;
        }
    }

    // =====================================================
    // Main Animation Loop
    // =====================================================
    function mainLoop(timestamp) {
        state.deltaTime = timestamp - state.lastFrame;
        state.lastFrame = timestamp;

        if (state.deltaTime > 100) state.deltaTime = 16.67;

        updateScrollPhysics(timestamp);
        updateBreathing(state.deltaTime);
        updateHeartbeat(timestamp);
        updateFatigue();
        updateNavigation();
        updateCursor();
        updateLongPressCTA(timestamp);
        updateParallax();
        applyCSSVariables();

        // Update scroll-linked marquee speed
        if (state.updateMarqueeSpeed) {
            state.updateMarqueeSpeed();
        }

        requestAnimationFrame(mainLoop);
    }

    // =====================================================
    // Event Listeners
    // =====================================================
    function setupEventListeners() {
        window.addEventListener('scroll', () => {
            state.scrollY = window.scrollY;
            state.lastScrollTime = performance.now();
        }, { passive: true });

        state.scrollY = window.scrollY;
        state.lastScrollY = window.scrollY;
    }

    // =====================================================
    // Cache Elements
    // =====================================================
    function cacheElements() {
        state.elements = {
            nav: document.getElementById('mainNav'),
            cta: document.getElementById('beginCta'),
            cursor: document.getElementById('cursor')
        };
    }

    // =====================================================
    // Text Scramble Effect
    // =====================================================
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '!<>-_\\/[]{}—=+*^?#________';
            this.originalText = el.dataset.text || el.textContent;
            this.frameRequest = null;
        }

        setText(newText) {
            const oldText = this.el.textContent;
            const length = Math.max(oldText.length, newText.length);
            const promise = new Promise((resolve) => this.resolve = resolve);
            this.queue = [];

            for (let i = 0; i < length; i++) {
                const from = oldText[i] || '';
                const to = newText[i] || '';
                const start = Math.floor(Math.random() * 40);
                const end = start + Math.floor(Math.random() * 40);
                this.queue.push({ from, to, start, end });
            }

            cancelAnimationFrame(this.frameRequest);
            this.frame = 0;
            this.el.classList.add('scrambling');
            this.update();
            return promise;
        }

        update() {
            let output = '';
            let complete = 0;

            for (let i = 0; i < this.queue.length; i++) {
                let { from, to, start, end, char } = this.queue[i];

                if (this.frame >= end) {
                    complete++;
                    output += to;
                } else if (this.frame >= start) {
                    if (!char || Math.random() < 0.28) {
                        char = this.randomChar();
                        this.queue[i].char = char;
                    }
                    output += `<span style="color: var(--color-accent)">${char}</span>`;
                } else {
                    output += from;
                }
            }

            this.el.innerHTML = output;

            if (complete === this.queue.length) {
                this.el.classList.remove('scrambling');
                this.resolve();
            } else {
                this.frameRequest = requestAnimationFrame(() => this.update());
                this.frame++;
            }
        }

        randomChar() {
            return this.chars[Math.floor(Math.random() * this.chars.length)];
        }
    }

    function setupTextScramble() {
        const elements = document.querySelectorAll('.text-scramble');

        elements.forEach(el => {
            const scrambler = new TextScramble(el);

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !el.dataset.scrambled) {
                        el.dataset.scrambled = 'true';
                        scrambler.setText(scrambler.originalText);
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(el);
        });
    }

    // =====================================================
    // Scroll-Linked Marquee Speed
    // =====================================================
    function setupScrollMarquee() {
        const marqueeTrack = document.querySelector('.marquee-track');
        if (!marqueeTrack) return;

        let baseSpeed = 35; // seconds for one loop

        function updateMarqueeSpeed() {
            // Speed up marquee based on scroll velocity
            const speedMultiplier = 1 + state.normalizedIntensity * 2;
            const newDuration = baseSpeed / speedMultiplier;
            marqueeTrack.style.animationDuration = `${newDuration}s`;
        }

        // Update on each frame via the main loop
        state.updateMarqueeSpeed = updateMarqueeSpeed;
    }

    // =====================================================
    // Enhanced Magnetic Buttons
    // =====================================================
    function setupMagneticButtonsEnhanced() {
        const buttons = document.querySelectorAll('.magnetic-btn');

        buttons.forEach(btn => {
            let boundingRect = btn.getBoundingClientRect();

            // Recalculate on resize
            window.addEventListener('resize', () => {
                boundingRect = btn.getBoundingClientRect();
            });

            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // Stronger magnetic pull
                const deltaX = (e.clientX - centerX) * 0.35;
                const deltaY = (e.clientY - centerY) * 0.35;

                // Add subtle rotation based on position
                const rotateX = (e.clientY - centerY) * 0.05;
                const rotateY = (e.clientX - centerX) * -0.05;

                btn.style.transform = `translate(${deltaX}px, ${deltaY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // =====================================================
    // Initialize
    // =====================================================
    function init() {
        cacheElements();
        setupEventListeners();
        setupCursor();
        setupMagneticButtonsEnhanced();
        setupCounters();
        setupRevealOnScroll();
        setupSplitText();
        setup3DCards();
        setupLongPressCTA();
        setupNewsletterForm();
        setupTextScramble();
        setupScrollMarquee();

        state.lastFrame = performance.now();
        state.lastScrollTime = performance.now();
        state.lastBeatTime = performance.now();

        // Initial cursor position
        state.cursorX = window.innerWidth / 2;
        state.cursorY = window.innerHeight / 2;
        state.targetCursorX = state.cursorX;
        state.targetCursorY = state.cursorY;

        requestAnimationFrame(mainLoop);

        console.log('🏋️ Living Fitness: Premium Interactive Engine v3.0 - Portfolio Edition');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

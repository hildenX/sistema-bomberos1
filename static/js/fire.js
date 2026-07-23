// ===== FIRE BACKGROUND ANIMATION =====
(function () {
    const canvas = document.getElementById('fireCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H, particles = [], animId;
    const COUNT = 120;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function rand(a, b) { return Math.random() * (b - a) + a; }

    function makeParticle() {
        return {
            x:     rand(0, W),
            y:     H + rand(0, 40),
            vx:    rand(-0.6, 0.6),
            vy:    rand(-2.8, -1.4),
            size:  rand(6, 22),
            life:  1,
            decay: rand(0.007, 0.018),
            wobble: rand(0, Math.PI * 2),
            wobbleSpeed: rand(0.02, 0.05),
        };
    }

    function resetParticle(p) {
        p.x     = rand(0, W);
        p.y     = H + rand(0, 30);
        p.vx    = rand(-0.6, 0.6);
        p.vy    = rand(-2.8, -1.4);
        p.size  = rand(6, 22);
        p.life  = 1;
        p.decay = rand(0.007, 0.018);
        p.wobble = rand(0, Math.PI * 2);
        p.wobbleSpeed = rand(0.02, 0.05);
    }

    function fireColor(life) {
        // life 1→0: white-yellow → orange → red → dark red
        if (life > 0.75) {
            const t = (life - 0.75) / 0.25;
            return [255, Math.floor(200 + 55 * t), Math.floor(80 * (1 - t))];
        } else if (life > 0.45) {
            const t = (life - 0.45) / 0.30;
            return [255, Math.floor(140 * t), 0];
        } else if (life > 0.2) {
            const t = (life - 0.2) / 0.25;
            return [Math.floor(192 + 63 * t), Math.floor(40 * t), 0];
        } else {
            return [Math.floor(120 * (life / 0.2)), 0, 0];
        }
    }

    function draw() {
        // Fade trail
        ctx.fillStyle = 'rgba(14,10,10,0.18)';
        ctx.fillRect(0, 0, W, H);

        for (const p of particles) {
            p.wobble += p.wobbleSpeed;
            p.x  += p.vx + Math.sin(p.wobble) * 0.5;
            p.y  += p.vy;
            p.vy *= 0.998;
            p.life -= p.decay;

            if (p.life <= 0 || p.y < -p.size) { resetParticle(p); continue; }

            const [r, g, b] = fireColor(p.life);
            const alpha = Math.min(p.life * 1.2, 0.75);
            const sz    = p.size * p.life * 0.6 + p.size * 0.4;

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz);
            grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha})`);
            grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
            grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

            ctx.beginPath();
            ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        animId = requestAnimationFrame(draw);
    }

    function init() {
        resize();
        canvas.classList.add('visible');
        particles = Array.from({ length: COUNT }, () => {
            const p = makeParticle();
            p.y    = rand(H * 0.3, H);  // spread initially
            p.life = rand(0.1, 0.9);
            return p;
        });
        draw();
    }

    window.addEventListener('resize', () => {
        cancelAnimationFrame(animId);
        resize();
        draw();
    });

    // Start after preloader hides
    window.addEventListener('fireStart', init);
    // Fallback: start anyway
    window.addEventListener('load', () => {
        if (!animId) setTimeout(init, 300);
    });
})();

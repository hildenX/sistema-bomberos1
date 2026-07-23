// ===== DOOM FIRE ALGORITHM =====
// Algoritmo clásico de fuego: cada píxel se "enfría" subiendo,
// produciendo llamas reales que ondulan naturalmente.
(function () {
    const canvas = document.getElementById('fireCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Resolución interna (baja = más rendimiento, sigue viéndose bien escalado)
    const FW = 200;
    const FH = 120;

    const pixels = new Uint8Array(FW * FH);

    // ---- Paleta de colores (negro → rojo → naranja → amarillo → blanco) ----
    const palette = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
        let r = 0, g = 0, b = 0, a = 0;
        if (i === 0) {
            a = 0; // transparente
        } else if (i < 40) {
            r = i * 4;
            g = 0;
            b = 0;
            a = i * 5;
        } else if (i < 90) {
            const t = (i - 40) / 50;
            r = 160 + t * 95;
            g = t * 30;
            b = 0;
            a = 180 + t * 40;
        } else if (i < 160) {
            const t = (i - 90) / 70;
            r = 255;
            g = 30 + t * 160;
            b = 0;
            a = 215 + t * 30;
        } else if (i < 210) {
            const t = (i - 160) / 50;
            r = 255;
            g = 190 + t * 55;
            b = t * 80;
            a = 240;
        } else {
            const t = (i - 210) / 45;
            r = 255;
            g = 245 + t * 10;
            b = 80 + t * 175;
            a = 245;
        }
        const idx = i * 4;
        palette[idx]     = Math.min(255, r);
        palette[idx + 1] = Math.min(255, g);
        palette[idx + 2] = Math.min(255, b);
        palette[idx + 3] = Math.min(255, a);
    }

    // ---- Canvas interno (baja resolución) ----
    const offscreen = document.createElement('canvas');
    offscreen.width  = FW;
    offscreen.height = FH;
    const fCtx = offscreen.getContext('2d');
    const imageData = fCtx.createImageData(FW, FH);

    function initPixels() {
        pixels.fill(0);
        // Fila inferior: máximo calor
        for (let x = 0; x < FW; x++) {
            pixels[(FH - 1) * FW + x] = 255;
        }
        // Segunda fila desde abajo también caliente para base más gruesa
        for (let x = 0; x < FW; x++) {
            pixels[(FH - 2) * FW + x] = 240 + Math.floor(Math.random() * 15);
        }
    }

    // ---- Algoritmo DOOM: cada píxel sube, se enfría y se desvía lateralmente ----
    function updateFire() {
        for (let y = 0; y < FH - 1; y++) {
            for (let x = 0; x < FW; x++) {
                const src   = (y + 1) * FW + x;
                const decay = Math.floor(Math.random() * 3); // 0, 1 o 2
                const heat  = Math.max(0, pixels[src] - decay);
                // Se desplaza ligeramente a la izquierda = efecto de viento/ondulación
                const dstX  = (x - (decay > 0 ? 1 : 0) + FW) % FW;
                pixels[y * FW + dstX] = heat;
            }
        }
        // Re-inyectar calor en la base con variación aleatoria (hace que las llamas pulsen)
        for (let x = 0; x < FW; x++) {
            const base = pixels[(FH - 1) * FW + x];
            pixels[(FH - 1) * FW + x] = base > 0 ? Math.min(255, base + Math.floor(Math.random() * 4) - 1) : 255;
        }
    }

    function renderToOffscreen() {
        const data = imageData.data;
        for (let i = 0; i < FW * FH; i++) {
            const val = pixels[i];
            const pi  = val * 4;
            const di  = i * 4;
            data[di]     = palette[pi];
            data[di + 1] = palette[pi + 1];
            data[di + 2] = palette[pi + 2];
            data[di + 3] = palette[pi + 3];
        }
        fCtx.putImageData(imageData, 0, 0);
    }

    let W, H, animId;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function loop() {
        updateFire();
        renderToOffscreen();

        ctx.clearRect(0, 0, W, H);

        // Las llamas ocupan la parte inferior (~55% de pantalla) y se ven desde abajo
        const destH = H * 0.62;
        const destY = H - destH;

        // Ligero blur para suavizar los píxeles escalados → llamas más fluidas
        ctx.filter = 'blur(5px)';
        ctx.drawImage(offscreen, 0, destY, W, destH);
        ctx.filter = 'none';

        animId = requestAnimationFrame(loop);
    }

    function init() {
        resize();
        initPixels();
        canvas.classList.add('visible');
        loop();
    }

    window.addEventListener('resize', () => { resize(); });
    window.addEventListener('fireStart', init);
    window.addEventListener('load', () => { if (!animId) setTimeout(init, 400); });
})();

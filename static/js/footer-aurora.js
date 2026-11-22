/**
 * Footer aurora — the Bifrost strip at the foot of every page, alive.
 *
 * The footer ends in `.footer__rainbow`, a flat band of the rainbow that
 * pans slowly (CSS only). Where WebGL is available and the visitor has not
 * asked for reduced motion, this script lays a canvas over that band and
 * draws the same colours as an aurora: three curtains of light with a hard
 * lower hem and a long upward fade, striated into rays, swaying over a low
 * glow at the bottom edge.
 *
 * It stays cheap on purpose. Nothing is created until the footer is close
 * to the viewport; the canvas renders at half resolution and about 30
 * frames a second; the loop stops when the footer is off screen or the tab
 * is hidden. If anything fails (no WebGL, a lost context, reduced motion)
 * the CSS band underneath is simply left as it was.
 *
 * Colours are read from the theme's `--accent-rainbow` token, so the
 * aurora follows the light/dark theme and the palette has one source.
 */
(() => {
    const strip = document.querySelector(".footer__rainbow");
    if (!strip || !("IntersectionObserver" in window)) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (calm.matches) return;

    const STOPS = 7;
    // Used only if the token cannot be parsed (the pastel 300 band).
    const FALLBACK = ["#fde4cf", "#f1c0e8", "#cfbaf0", "#a3c4f3", "#90dbf4", "#98f5e1", "#b9fbc0"];

    const VERTEX = "attribute vec2 corner; void main() { gl_Position = vec4(corner, 0.0, 1.0); }";

    const FRAGMENT = `
        precision mediump float;
        uniform vec2 uSize;
        uniform float uTime;
        uniform vec3 uBand[${STOPS}];
        uniform float uGain;

        // The rainbow as a closed loop: h runs once round the seven stops.
        vec3 band(float h) {
            h = fract(h) * ${STOPS}.0;
            vec3 c = vec3(0.0);
            for (int k = 0; k < ${STOPS}; k++) {
                float near = abs(h - float(k));
                near = min(near, ${STOPS}.0 - near);
                c += uBand[k] * max(0.0, 1.0 - near);
            }
            return c;
        }

        // One curtain: a swaying hem, light that falls off fast below it
        // and slowly above it, cut into vertical rays.
        float curtain(vec2 p, float seed) {
            float hem = 0.14 + 0.2 * seed
                + 0.1 * sin(p.x * 1.1 + uTime * 0.11 + seed * 6.1)
                + 0.05 * sin(p.x * 2.7 - uTime * 0.07 + seed * 2.3);
            float d = p.y - hem;
            float light = mix(exp(-d * d * 90.0), exp(-d * 2.6), step(0.0, d));
            // Broad folds first, fine striation second, so the rays read
            // as pleats in one sheet and not as separate spikes.
            float folds = 0.62 + 0.38 * sin(p.x * 6.5 + seed * 17.0 + 1.9 * sin(p.x * 1.7 + uTime * 0.17 + seed * 4.0));
            float rays = 0.86 + 0.14 * sin(p.x * 38.0 - uTime * 0.29 + seed * 3.0 + 2.0 * sin(p.x * 9.0));
            return light * folds * rays;
        }

        void main() {
            // y runs 0 (bottom edge) to 1 (top); x is measured in strip heights.
            vec2 p = gl_FragCoord.xy / uSize.y;
            float drift = uTime * 0.012;
            float hue = p.x * 0.21 + drift + 0.05 * sin(p.x * 0.9 + uTime * 0.05);

            vec3 colour = vec3(0.0);
            float alpha = 0.0;
            for (int i = 0; i < 3; i++) {
                float seed = float(i) * 0.5;
                float c = curtain(p, seed) * (0.7 - 0.12 * seed);
                colour += band(hue + seed * 0.19) * c;
                alpha += c;
            }

            // The ground glow keeps the band solid at the very bottom.
            float ground = smoothstep(0.62, 0.0, p.y);
            colour += band(hue) * ground;
            alpha += ground;

            colour /= max(alpha, 0.0001);
            alpha = clamp(alpha, 0.0, 1.0) * uGain;
            gl_FragColor = vec4(colour * alpha, alpha);
        }
    `;

    function palette() {
        const token = getComputedStyle(document.documentElement).getPropertyValue("--accent-rainbow");
        const found = token.match(/#[0-9a-f]{6}\b|rgb\([^)]+\)/gi) || [];
        const stops = found.length >= STOPS ? found.slice(0, STOPS) : FALLBACK;
        const flat = [];
        for (const stop of stops) {
            if (stop[0] === "#") {
                flat.push(parseInt(stop.slice(1, 3), 16) / 255, parseInt(stop.slice(3, 5), 16) / 255, parseInt(stop.slice(5, 7), 16) / 255);
            } else {
                const [r, g, b] = stop.match(/[\d.]+/g).map(Number);
                flat.push(r / 255, g / 255, b / 255);
            }
        }
        return new Float32Array(flat);
    }

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    }

    function start() {
        const canvas = document.createElement("canvas");
        canvas.className = "footer__aurora";
        const gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            powerPreference: "low-power",
        });
        if (!gl) return;

        const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
        const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
        if (!vertex || !fragment) return;
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        // One triangle that covers the whole canvas.
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const corner = gl.getAttribLocation(program, "corner");
        gl.enableVertexAttribArray(corner);
        gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

        const uSize = gl.getUniformLocation(program, "uSize");
        const uTime = gl.getUniformLocation(program, "uTime");
        const uBand = gl.getUniformLocation(program, "uBand");
        const uGain = gl.getUniformLocation(program, "uGain");

        // The band is deeper on the light theme (see --accent-rainbow), so
        // it is drawn a little thinner there to stay a wash, not a stripe.
        function retheme() {
            gl.uniform3fv(uBand, palette());
            gl.uniform1f(uGain, document.documentElement.getAttribute("data-theme") === "light" ? 0.72 : 1.0);
        }
        retheme();

        strip.prepend(canvas);
        strip.classList.add("footer__rainbow--live");

        const FRAME = 1000 / 30;
        // Start well into the cycle so the first frame is already mid-sway.
        const epoch = performance.now() - 60000;
        let onScreen = true;
        let frame = 0;
        let lastPaint = 0;
        let alive = true;

        function paint(now) {
            const box = canvas.getBoundingClientRect();
            const density = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
            const width = Math.max(1, Math.round(box.width * density));
            const height = Math.max(1, Math.round(box.height * density));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uSize, width, height);
            gl.uniform1f(uTime, (now - epoch) / 1000);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        function tick(now) {
            frame = 0;
            if (!alive || !onScreen || document.hidden) return;
            if (now - lastPaint >= FRAME) {
                lastPaint = now;
                paint(now);
            }
            frame = requestAnimationFrame(tick);
        }

        function wake() {
            if (alive && !frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
        }

        // Hand the strip back to its CSS band.
        function retire() {
            alive = false;
            if (frame) cancelAnimationFrame(frame);
            strip.classList.remove("footer__rainbow--live");
            canvas.remove();
        }

        new IntersectionObserver((entries) => {
            onScreen = entries[entries.length - 1].isIntersecting;
            wake();
        }).observe(strip);
        document.addEventListener("visibilitychange", wake);
        canvas.addEventListener("webglcontextlost", retire);
        calm.addEventListener("change", () => {
            if (calm.matches) retire();
        });
        new MutationObserver(() => {
            if (alive) retheme();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        paint(performance.now());
        wake();
    }

    // Build nothing until the footer is within a screen or so of view.
    const approach = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                approach.disconnect();
                start();
            }
        },
        { rootMargin: "800px 0px" },
    );
    approach.observe(strip);
})();

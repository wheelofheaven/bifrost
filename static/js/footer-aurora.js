/**
 * Footer aurora — the Bifrost at the foot of every page, alive.
 *
 * The footer ends in `.footer__rainbow`, a flat band of the rainbow that
 * pans slowly (CSS only). Where WebGL is available and the visitor has not
 * asked for reduced motion, this script lays a canvas behind the whole
 * footer and draws the same colours as an aurora: three curtains of light
 * rising from a solid glow at the bottom edge, pleated into rays that run
 * all the way up behind the links and thin out to nothing at the top.
 *
 * It stays cheap on purpose. Nothing is created until the footer is close
 * to the viewport; the canvas renders well below CSS resolution and about
 * 30 frames a second; the loop stops when the footer is off screen or the
 * tab is hidden. If anything fails (no WebGL, a lost context, reduced
 * motion) the CSS band is simply left as it was.
 *
 * Colours are read from the theme's `--accent-rainbow` token, so the
 * aurora follows the light/dark theme and the palette has one source.
 */
(() => {
    const footer = document.querySelector(".footer");
    const strip = footer && footer.querySelector(".footer__rainbow");
    if (!strip || !("IntersectionObserver" in window)) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (calm.matches) return;

    const STOPS = 7;
    // Used only if the token cannot be parsed (the pastel 300 band).
    const FALLBACK = ["#fde4cf", "#f1c0e8", "#cfbaf0", "#a3c4f3", "#90dbf4", "#98f5e1", "#b9fbc0"];
    // Upper bound on rendered pixels: a phone footer is several screens tall.
    const PIXEL_BUDGET = 420000;

    const VERTEX = "attribute vec2 corner; void main() { gl_Position = vec4(corner, 0.0, 1.0); }";

    const FRAGMENT = `
        precision mediump float;
        uniform vec2 uSize;
        uniform float uUnit;
        uniform float uTime;
        uniform float uGain;
        uniform vec3 uBand[${STOPS}];

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

        // One curtain. p is in units of the bottom strip's height (y = 0 at
        // the bottom edge); rise runs 0 at the bottom to 1 at the top of the
        // footer. The hem sways; below it the light dies fast, above it it
        // falls to a faint veil that reaches the top and fades with rise.
        float curtain(vec2 p, float rise, float seed) {
            float hem = 0.16 + 0.2 * seed
                + 0.15 * sin(p.x * 1.1 + uTime * 0.21 + seed * 6.1)
                + 0.07 * sin(p.x * 2.7 - uTime * 0.13 + seed * 2.3);
            float d = p.y - hem;
            float glow = exp(-d * 2.4);
            float veil = 0.34 * pow(1.0 - rise, 1.7);
            float light = mix(exp(-d * d * 90.0), glow + (1.0 - glow) * veil, step(0.0, d));

            // Broad folds first, fine striation second, so the rays read
            // as pleats in one sheet and not as separate spikes. The folds
            // travel sideways, which is most of the visible motion.
            float folds = 0.56 + 0.44 * sin(p.x * 6.5 + seed * 17.0 - uTime * 0.24
                + 2.1 * sin(p.x * 1.7 + uTime * 0.31 + seed * 4.0));
            float rays = 0.85 + 0.15 * sin(p.x * 38.0 - uTime * 0.5 + seed * 3.0 + 2.0 * sin(p.x * 9.0));
            // A slow swell of brightness passing along the sheet.
            float swell = 0.74 + 0.26 * sin(p.x * 0.75 - uTime * 0.38 + seed * 2.6);
            return light * folds * rays * swell;
        }

        void main() {
            // Drawn larger than the strip it grew out of: broad folds and
            // tall hems read as weather; small ones read as a pattern.
            vec2 p = gl_FragCoord.xy / (uUnit * vec2(1.8, 1.4));
            float rise = gl_FragCoord.y / uSize.y;
            float hue = p.x * 0.21 + uTime * 0.02 + 0.06 * sin(p.x * 0.9 + uTime * 0.09);

            vec3 colour = vec3(0.0);
            float alpha = 0.0;
            for (int i = 0; i < 3; i++) {
                float seed = float(i) * 0.5;
                float c = curtain(p, rise, seed) * (0.7 - 0.12 * seed);
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
        canvas.setAttribute("aria-hidden", "true");
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
        const uUnit = gl.getUniformLocation(program, "uUnit");
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

        footer.prepend(canvas);
        footer.classList.add("footer--aurora");

        const FRAME = 1000 / 30;
        // Start well into the cycle so the first frame is already mid-sway.
        const epoch = performance.now() - 60000;
        let onScreen = true;
        let frame = 0;
        let lastPaint = 0;
        let alive = true;

        function paint(now) {
            const box = canvas.getBoundingClientRect();
            let density = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
            const pixels = box.width * box.height * density * density;
            if (pixels > PIXEL_BUDGET) density *= Math.sqrt(PIXEL_BUDGET / pixels);
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
            // The strip's height is the shader's unit of length, so the band
            // at the bottom keeps its proportions however tall the footer is.
            gl.uniform1f(uUnit, Math.max(1, strip.offsetHeight * density));
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

        // Hand the footer back to its CSS band.
        function retire() {
            alive = false;
            if (frame) cancelAnimationFrame(frame);
            footer.classList.remove("footer--aurora");
            canvas.remove();
        }

        new IntersectionObserver((entries) => {
            onScreen = entries[entries.length - 1].isIntersecting;
            wake();
        }).observe(footer);
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
    approach.observe(footer);
})();

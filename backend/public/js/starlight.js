(function() {
    var canvas = document.getElementById('starlightBg');
    if (!canvas) return;

    // Tắt starlight trên trang xem phim để tiết kiệm CPU/GPU
    if (window.location.pathname.startsWith('/xem/')) {
        canvas.style.display = 'none';
        return;
    }

    // Tôn trọng prefers-reduced-motion — tắt animation hoàn toàn
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        canvas.style.display = 'none';
        return;
    }

    // Tắt trên mobile / thiết bị yếu — canvas position:fixed full-screen
    // buộc compositing layer phủ toàn viewport, compound với backdrop-filter → FPS drop nặng
    var isMobile = window.innerWidth < 768;
    var isLowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                   (navigator.deviceMemory && navigator.deviceMemory <= 2);
    if (isMobile || isLowEnd) {
        canvas.style.display = 'none';
        return;
    }

    var ctx = canvas.getContext('2d');
    var particles = [];
    var dpr = window.devicePixelRatio || 1;
    var W, H;
    var animId = null;
    var isRunning = false;

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createStars() {
        particles = [];
        // Giảm particle count: mobile 80 (was 150), desktop 200 (was 400)
        var count = window.innerWidth < 768 ? 80 : 200;
        for (var i = 0; i < count; i++) {
            var roll = Math.random();
            var r;
            if (roll < 0.5) {
                r = Math.random() * 0.8 + 0.4;
            } else if (roll < 0.85) {
                r = Math.random() * 1.2 + 0.8;
            } else {
                r = Math.random() * 1.8 + 1.2;
            }
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: r,
                alpha: Math.random(),
                speed: Math.random() * 0.008 + 0.002,
                dir: Math.random() > 0.5 ? 1 : -1,
                hue: Math.random() < 0.12 ? (Math.random() > 0.5 ? '244,171,180' : '180,200,255') : '255,255,255'
            });
        }
    }

    function createPetals() {
        particles = [];
        // Giảm particle count: mobile 40 (was 60), desktop 80 (was 130)
        var count = window.innerWidth < 768 ? 40 : 80;
        for (var i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: Math.random() * 6 + 3,
                alpha: Math.random() * 0.5 + 0.2,
                alphaSpeed: Math.random() * 0.006 + 0.002,
                alphaDir: Math.random() > 0.5 ? 1 : -1,
                fallSpeed: Math.random() * 0.3 + 0.1,
                swaySpeed: Math.random() * 0.003 + 0.001,
                swayAmp: Math.random() * 30 + 15,
                swayOffset: Math.random() * Math.PI * 2,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.01,
                colorIdx: Math.floor(Math.random() * 3)
            });
        }
    }

    var petalColors = [
        [190, 40, 70],
        [210, 80, 110],
        [180, 50, 85]
    ];

    function drawPetal(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        var c = petalColors[p.colorIdx];
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',1)';
        var s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s * 0.4, -s * 0.5, s, -s * 0.3, s * 0.5, s * 0.3);
        ctx.bezierCurveTo(s * 0.3, s * 0.6, 0, s * 0.5, 0, 0);
        ctx.fill();
        ctx.globalAlpha = p.alpha * 0.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s * 0.25, 0, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    var time = 0;
    function draw() {
        if (!isRunning) return;
        ctx.clearRect(0, 0, W, H);
        time++;
        if (isLight()) {
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                if (!p.size) { createPetals(); animId = requestAnimationFrame(draw); return; }
                p.alpha += p.alphaSpeed * p.alphaDir;
                if (p.alpha >= 0.7) { p.alpha = 0.7; p.alphaDir = -1; }
                if (p.alpha <= 0.15) { p.alpha = 0.15; p.alphaDir = 1; }
                p.y += p.fallSpeed;
                p.x += Math.sin(time * p.swaySpeed + p.swayOffset) * 0.3;
                p.rotation += p.rotSpeed;
                if (p.y > H + 20) {
                    p.y = -20;
                    p.x = Math.random() * W;
                }
                drawPetal(p);
            }
        } else {
            for (var i = 0; i < particles.length; i++) {
                var s = particles[i];
                if (s.size) { createStars(); animId = requestAnimationFrame(draw); return; }
                s.alpha += s.speed * s.dir;
                if (s.alpha >= 1) { s.alpha = 1; s.dir = -1; }
                if (s.alpha <= 0.05) { s.alpha = 0.05; s.dir = 1; }
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + s.hue + ',' + (s.alpha * 0.8) + ')';
                ctx.fill();
            }
        }
        animId = requestAnimationFrame(draw);
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        draw();
    }

    function stop() {
        isRunning = false;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
    }

    resize();
    if (isLight()) { createPetals(); } else { createStars(); }
    start();

    // Pause khi tab ẩn, resume khi tab hiện — tiết kiệm CPU/GPU/pin
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stop();
        } else {
            start();
        }
    });

    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            resize();
            if (isLight()) { createPetals(); } else { createStars(); }
        }, 200);
    });

    var observer = new MutationObserver(function() {
        if (isLight()) { createPetals(); } else { createStars(); }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

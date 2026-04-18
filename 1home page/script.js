/* ── AURORA CANVAS (identical to dashboard) ── */
(function () {
  const canvas = document.getElementById("auroraCanvas");
  const ctx = canvas.getContext("2d");
  let W, H, blobs;

  const BLOBS = [
    { x: 0.25, y: 0.3,  r: 0.38, color: "rgba(124,58,237,",  speed: 0.00018 },
    { x: 0.72, y: 0.55, r: 0.30, color: "rgba(168,85,247,",  speed: 0.00014 },
    { x: 0.50, y: 0.80, r: 0.28, color: "rgba(79,70,229,",   speed: 0.00022 },
    { x: 0.15, y: 0.70, r: 0.22, color: "rgba(192,132,252,", speed: 0.00016 },
    { x: 0.85, y: 0.20, r: 0.25, color: "rgba(109,40,217,",  speed: 0.00019 },
  ];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    blobs = BLOBS.map((b, i) => ({
      ...b,
      cx: b.x * W, cy: b.y * H,
      radius: Math.min(W, H) * b.r,
      angle: i * 1.2,
      ox: b.x * W, oy: b.y * H,
      drift: 0.06 * Math.min(W, H),
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    blobs.forEach(b => {
      b.angle += b.speed * 16;
      b.cx = b.ox + Math.cos(b.angle) * b.drift;
      b.cy = b.oy + Math.sin(b.angle * 0.7) * b.drift;
      const g = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.radius);
      g.addColorStop(0, b.color + "0.18)");
      g.addColorStop(1, b.color + "0)");
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
})();

/* ── MOBILE SIDEBAR CLOSE ON OUTSIDE CLICK ── */
document.addEventListener("click", function (e) {
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    if (!sidebar.contains(e.target) && !e.target.closest(".ham")) {
      sidebar.classList.remove("open");
    }
  }
});
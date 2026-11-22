// Electric snow in latent space. Points fall, hold hands with near neighbours and light the windows of four cities.
(() => {
  const canvas = document.getElementById("snow");
  const button = document.getElementById("motion");
  const g = canvas.getContext("2d");
  if (!g) return;
  const colours = ["#78e6d8", "#f2b860", "#ef86b5", "#eef1fb"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let width, height, flakes, windows, moving = !reduce.matches, request = 0;

  function build() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    flakes = Array.from({ length: Math.min(90, width / 9) }, (_, i) => ({
      x: Math.random() * width, y: Math.random() * height,
      r: 1 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.35, c: colours[i % 4]
    }));
    windows = [];
    const step = 14;
    for (let x = 4, column = 0; x < width; x += step, column++) {
      const city = Math.min(3, Math.floor((x / width) * 4));
      const block = Math.floor(column / 5);
      const floors = 2 + ((block * 7 + city * 3) % 6);
      if (column % 5 === 4) continue;
      for (let floor = 0; floor < floors; floor++) {
        windows.push({ x, y: height - 14 - floor * step, c: colours[city], lit: Math.random() * 6.28 });
      }
    }
  }

  function draw(time) {
    g.clearRect(0, 0, width, height);
    for (const pane of windows) {
      g.globalAlpha = 0.16 + 0.18 * (1 + Math.sin(pane.lit + time / 2400));
      g.fillStyle = pane.c;
      g.fillRect(pane.x, pane.y, 7, 8);
    }
    g.lineWidth = 1;
    for (let i = 0; i < flakes.length; i++) {
      const a = flakes[i];
      for (let j = i + 1; j < flakes.length; j++) {
        const b = flakes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 90) continue;
        g.globalAlpha = (1 - d / 90) * 0.18;
        g.strokeStyle = a.c;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.globalAlpha = 0.65;
      g.fillStyle = a.c;
      g.beginPath();
      g.arc(a.x, a.y, a.r, 0, 6.283);
      g.fill();
    }
  }

  function tick(time) {
    for (const f of flakes) {
      f.y += f.v;
      f.x += Math.sin(f.y / 70) * 0.18;
      if (f.y > height) { f.y = -4; f.x = Math.random() * width; }
    }
    draw(time);
    request = moving ? requestAnimationFrame(tick) : 0;
  }

  function setMoving(on) {
    moving = on;
    cancelAnimationFrame(request);
    document.body.classList.toggle("still", !on);
    button.textContent = on ? "Pause snow" : "Let it snow";
    if (on) request = requestAnimationFrame(tick); else draw(0);
  }

  build();
  button.hidden = false;
  button.addEventListener("click", () => setMoving(!moving));
  reduce.addEventListener("change", event => setMoving(!event.matches));
  addEventListener("resize", () => { build(); if (!moving) draw(0); });
  setMoving(moving);
})();

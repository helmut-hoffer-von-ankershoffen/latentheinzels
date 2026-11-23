// The artwork viewer: one picture at a time, swiped, keyed or picked from the strip, with an address per picture.
// Without this script the pictures still scroll sideways, snap into place and open by their address.
(() => {
  const viewer = document.querySelector(".viewer");
  if (!viewer) return;
  const stage = viewer.querySelector(".stage");
  const slides = [...viewer.querySelectorAll(".slide")];
  const thumbs = [...viewer.querySelectorAll(".thumb")];
  const count = viewer.querySelector(".count");
  const full = viewer.querySelector(".full");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const canFullscreen = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  let current = -1;
  let settled = false;

  function index(slug) {
    return slides.findIndex(slide => slide.id === slug);
  }

  // The picture before and after the one in view load early, so a swipe never shows an empty frame.
  function prepare(at) {
    for (const near of [at - 1, at, at + 1]) {
      const image = slides[near]?.querySelector("img");
      if (image) image.loading = "eager";
    }
  }

  function mark(at) {
    if (at === current) return;
    current = at;
    slides.forEach((slide, place) => slide.classList.toggle("current", place === at));
    thumbs.forEach((thumb, place) => {
      if (place === at) thumb.setAttribute("aria-current", "true");
      else thumb.removeAttribute("aria-current");
    });
    count.textContent = `${at + 1} / ${slides.length}`;
    prepare(at);
    // Only the strip moves to show its thumbnail; the page stays where the visitor has it.
    const thumb = thumbs[at];
    if (thumb) {
      const strip = thumb.closest(".thumbs");
      strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: "instant" });
    }
    // The address names the picture once the visitor has moved, so a shared link opens it. Writing it on arrival
    // would make the browser jump to it.
    if (settled) history.replaceState(null, "", `#${slides[at].id}`);
  }

  function show(at, smooth = true) {
    const target = Math.max(0, Math.min(slides.length - 1, at));
    prepare(target);
    stage.scrollTo({ left: slides[target].offsetLeft, behavior: smooth && !reduce.matches ? "smooth" : "instant" });
    mark(target);
  }

  const watch = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) mark(slides.indexOf(entry.target));
    }
  }, { root: stage, threshold: 0.6 });
  for (const slide of slides) watch.observe(slide);

  viewer.querySelector(".prev").addEventListener("click", () => show(current - 1));
  viewer.querySelector(".next").addEventListener("click", () => show(current + 1));
  thumbs.forEach((thumb, at) => thumb.addEventListener("click", () => show(at)));

  addEventListener("keydown", event => {
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key === "ArrowRight") show(current + 1);
    else if (event.key === "ArrowLeft") show(current - 1);
    else if (event.key === "Escape" && (inFullscreen() || viewer.classList.contains("overlay"))) leave();
    else return;
    event.preventDefault();
  });

  addEventListener("hashchange", () => {
    const at = index(decodeURIComponent(location.hash.slice(1)));
    if (at >= 0 && at !== current) show(at, false);
  });

  // Full screen: the browser's own where it has one, otherwise a layer over the whole page.
  function inFullscreen() {
    return (document.fullscreenElement || document.webkitFullscreenElement) === viewer;
  }

  function state() {
    const on = inFullscreen() || viewer.classList.contains("overlay");
    full.classList.toggle("second", on);
    full.setAttribute("aria-pressed", String(on));
    document.documentElement.classList.toggle("viewing", viewer.classList.contains("overlay"));
    // Widths change, so the picture in view is put back in place.
    if (current >= 0) requestAnimationFrame(() => show(current, false));
  }

  function leave() {
    if (inFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    viewer.classList.remove("overlay");
    state();
  }

  full.addEventListener("click", () => {
    if (inFullscreen() || viewer.classList.contains("overlay")) {
      leave();
      return;
    }
    if (canFullscreen) {
      (viewer.requestFullscreen || viewer.webkitRequestFullscreen).call(viewer);
    } else {
      viewer.classList.add("overlay");
      state();
    }
  });
  document.addEventListener("fullscreenchange", state);
  document.addEventListener("webkitfullscreenchange", state);
  addEventListener("resize", () => {
    if (current >= 0) show(current, false);
  });

  viewer.classList.add("ready");
  setTimeout(() => { settled = true; }, 0);
  const start = index(decodeURIComponent(location.hash.slice(1)));
  show(start >= 0 ? start : 0, false);
  if (start > 0) viewer.scrollIntoView({ block: "start", behavior: "instant" });
})();

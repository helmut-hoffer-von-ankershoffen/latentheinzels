// The film docks into a small corner player whenever its own place is out of view, from the first moment of a visit:
// paused on its first picture with a play mark until someone presses it, then playing with sound. It never plays
// muted. The same video element moves on screen, never in the document, so it plays on without a break. Its picture's
// place stays, so nothing on the page jumps. It never covers the bar, the page's top links or the top button.
(() => {
  const film = document.querySelector("video.film");
  let visual = film?.closest(".visual") || null;
  const dock = document.querySelector(".film-dock");
  const bar = document.querySelector(".film-bar");
  if (!film || !dock || !bar || !("IntersectionObserver" in window)) return;
  const root = document.documentElement;
  const toggle = bar.querySelector(".film-toggle");
  const dockToggle = dock.querySelector(".dock-toggle");
  const back = dock.querySelector(".dock-back");
  const firstLabel = back.getAttribute("aria-label");
  // The words for the way back, in the page's language: another language's page brings its own (nav.js).
  const backLabel = () => back.dataset.label || firstLabel;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let away = !visual;
  let closed = false; // for this page: closing undocks and the film stays in its place
  let docked = false;
  let ratio = 0; // how much of the film's own place is on screen
  let wanted = false; // sound just came on while the film is not fully in view: show it at once
  let wasMuted = film.muted;
  let yielded = false; // a SoundCloud player has the sound: the corner stays free until the film plays again
  let unhid = false; // the film was put in the corner before it was ever loaded, as its first picture

  function heard() {
    return !film.paused && !film.ended && !film.muted;
  }

  function label(button, from) {
    // The bar button's two labels, already in the page's language; the one it shows now names what a press does.
    const [first, second] = from.querySelectorAll("span");
    button.setAttribute("aria-label", (from.classList.contains("second") ? second : first).textContent);
    button.classList.toggle("second", from.classList.contains("second"));
  }

  function mirror() {
    label(dockToggle, toggle);
    // Paused, the whole picture is a play button with its mark on it; playing, it leads back to the film.
    const waiting = !heard();
    dock.classList.toggle("paused", waiting);
    back.setAttribute("aria-label", waiting ? dockToggle.getAttribute("aria-label") : backLabel());
  }

  // The corner player keeps clear of the page's top links and the top button, and stays wholly on screen.
  // What the corner player never covers: the page's top links, the top button, and a page's own controls such as the
  // gallery's buttons, title and strip.
  const TOP = "header a, header button, .film-cue:not([hidden])";
  const CLEAR = `${TOP}, .viewer .controls, .viewer .slide.current figcaption, .viewer .thumbs`;

  function cramped() {
    const own = dock.getBoundingClientRect();
    if (own.top < 0 || (!bar.hidden && own.bottom > bar.getBoundingClientRect().top + 1)) return true;
    return [...document.querySelectorAll(CLEAR)].some(guard => {
      const box = guard.getBoundingClientRect();
      if (!box.width || box.bottom <= 0 || box.top >= innerHeight) return false;
      return box.left < own.right + 8 && own.left < box.right + 8 && box.top < own.bottom + 8 && own.top < box.bottom + 8;
    });
  }

  // The lower corner first; the upper one, below whatever of the top links is on screen, where the lower one is taken.
  function corner(top) {
    root.classList.toggle("dock-top", top);
    if (!top) return;
    const below = [...document.querySelectorAll(TOP)].map(guard => guard.getBoundingClientRect())
      .filter(box => box.width && box.bottom > 0).reduce((most, box) => Math.max(most, box.bottom + 8), 12);
    room("--dock-top", `${Math.round(below)}px`);
  }

  function room(name, value) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }

  function place() {
    const consent = document.querySelector(".consent:not([hidden])");
    const below = (bar.hidden ? 0 : bar.getBoundingClientRect().height) + (consent ? consent.getBoundingClientRect().height : 0);
    // Written only when it changes: a style change calls this again.
    room("--dock-bottom", `${Math.round(below) + 12}px`);
    room("--dock-h", docked ? `${Math.round(dock.getBoundingClientRect().height)}px` : "0px");
  }

  function set(on) {
    if (on === docked) return;
    if (on && film.hidden) {
      // Never loaded yet, or back at the start after the end: its first picture stands in the corner.
      if (!film.poster && film.dataset.poster) film.poster = film.dataset.poster;
      film.hidden = false;
      unhid = true;
    }
    if (!on && unhid && film.paused) film.hidden = true;
    if (!on) unhid = false;
    docked = on;
    dock.hidden = !on;
    film.classList.toggle("docked", on);
    film.classList.toggle("parked", !visual);
    root.classList.toggle("film-docked", on);
    // In the corner the dock's own buttons stand in for the browser's controls, which would not fit.
    if (on) film.removeAttribute("controls");
    else film.setAttribute("controls", "");
    mirror();
    place();
  }

  function update() {
    const playingMuted = !film.paused && film.muted;
    if (closed || yielded || playingMuted || !(away || wanted)) {
      set(false);
      return;
    }
    set(true);
    corner(false);
    place();
    if (cramped()) {
      corner(true);
      if (cramped()) set(false);
    }
    mirror();
  }

  const watch = new IntersectionObserver(entries => {
    ratio = entries[entries.length - 1].intersectionRatio;
    away = ratio < 0.4;
    // Once the film is wholly in view, the usual rule takes over again.
    if (ratio >= 0.99) wanted = false;
    update();
  }, { threshold: [0, 0.4, 0.99, 1] });
  if (visual) watch.observe(visual);
  // Another page came in around the film (nav.js). Without a place of its own there, the film stays in the corner.
  document.addEventListener("site:swap", () => {
    watch.disconnect();
    visual = film.closest(".visual");
    away = true;
    ratio = 0;
    wanted = false;
    film.classList.toggle("parked", !visual);
    if (visual) watch.observe(visual);
    update();
  });
  // Who turns the sound on should see what they hear: unless the film is fully in view, it comes to the corner.
  film.addEventListener("volumechange", () => {
    if (wasMuted && !film.muted && ratio < 0.99) {
      wanted = true;
    }
    wasMuted = film.muted;
    update();
  });
  for (const type of ["play", "playing", "pause", "ended", "emptied"]) film.addEventListener(type, update);
  film.addEventListener("play", () => {
    yielded = false;
    update();
  });
  // A SoundCloud player takes the sound, and the film leaves the corner so the player's controls stay free.
  document.addEventListener("soundcloud:play", () => {
    yielded = true;
    set(false);
  });
  // The top links scroll away and the top button comes and goes, so the room is checked again as the page moves.
  let pending = false;
  addEventListener("scroll", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  }, { passive: true });

  new MutationObserver(mirror).observe(toggle, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ["class", "style"] });
  addEventListener("resize", place);

  dockToggle.addEventListener("click", () => toggle.click());
  dock.querySelector(".dock-close").addEventListener("click", () => {
    closed = true;
    set(false);
    toggle.focus({ preventScroll: true });
  });
  back.addEventListener("click", () => {
    if (!heard()) {
      toggle.click();
      return;
    }
    if (visual) visual.scrollIntoView({ block: "center", behavior: reduce.matches ? "instant" : "smooth" });
    // On a page without the film, the way back is the film's own page, in the page's language.
    else window.siteGo?.(bar.querySelector(".share")?.dataset.shareUrl || "/singularity/");
  });
  mirror();
  place();
  update();
})();

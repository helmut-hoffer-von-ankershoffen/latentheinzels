// The film docks into a small corner player while it plays out of view. The same video element moves on screen,
// never in the document, so it plays on without a break. Its picture's place stays, so nothing on the page jumps.
(() => {
  const film = document.querySelector("video.film");
  const visual = film?.parentElement;
  const dock = document.querySelector(".film-dock");
  const bar = document.querySelector(".film-bar");
  if (!film || !visual || !dock || !bar || !("IntersectionObserver" in window)) return;
  const root = document.documentElement;
  const toggle = bar.querySelector(".film-toggle");
  const sound = bar.querySelector(".film-sound");
  const dockToggle = dock.querySelector(".dock-toggle");
  const dockSound = dock.querySelector(".dock-sound");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let away = false;
  let seen = false; // it docks only after it has been in view, never on arrival below the fold
  let closed = false; // for this page: closing undocks and the film stays in its place
  let docked = false;

  function label(button, from) {
    // The bar's two labels, already in the page's language; the one it shows now names what a press does.
    const [first, second] = from.querySelectorAll("span");
    button.setAttribute("aria-label", (from.classList.contains("second") ? second : first).textContent);
    button.classList.toggle("second", from.classList.contains("second"));
  }

  function mirror() {
    label(dockToggle, toggle);
    label(dockSound, sound);
  }

  function place() {
    const consent = document.querySelector(".consent:not([hidden])");
    const below = (bar.hidden ? 0 : bar.getBoundingClientRect().height) + (consent ? consent.getBoundingClientRect().height : 0);
    root.style.setProperty("--dock-bottom", `${Math.round(below) + 12}px`);
    root.style.setProperty("--dock-h", docked ? `${Math.round(dock.getBoundingClientRect().height)}px` : "0px");
  }

  function set(on) {
    if (on === docked) return;
    docked = on;
    dock.hidden = !on;
    visual.classList.toggle("docked", on);
    root.classList.toggle("film-docked", on);
    // In the corner the dock's own buttons stand in for the browser's controls, which would not fit.
    if (on) film.removeAttribute("controls");
    else film.setAttribute("controls", "");
    mirror();
    place();
  }

  function update() {
    if (closed || !seen || film.hidden || film.ended || !film.getAttribute("src") || !away) set(false);
    else if (!film.paused) set(true);
  }

  new IntersectionObserver(entries => {
    away = entries[entries.length - 1].intersectionRatio < 0.4;
    if (!away) seen = true;
    update();
  }, { threshold: [0, 0.4, 1] }).observe(visual);
  for (const type of ["play", "playing", "pause", "ended", "emptied"]) film.addEventListener(type, update);
  // A SoundCloud player takes the sound, and the film leaves the corner so the player's controls stay free.
  document.addEventListener("soundcloud:play", () => set(false));

  for (const watched of [toggle, sound]) {
    new MutationObserver(mirror).observe(watched, { attributes: true, attributeFilter: ["class"] });
  }
  new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ["class", "style"] });
  addEventListener("resize", place);

  dockToggle.addEventListener("click", () => toggle.click());
  dockSound.addEventListener("click", () => sound.click());
  dock.querySelector(".dock-close").addEventListener("click", () => {
    closed = true;
    set(false);
    toggle.focus({ preventScroll: true });
  });
  dock.querySelector(".dock-back").addEventListener("click", () => {
    visual.scrollIntoView({ block: "center", behavior: reduce.matches ? "instant" : "smooth" });
  });
  mirror();
  place();
})();

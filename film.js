// The top song's film, from this site. It starts on a visit with its sound where the browser allows that; where it
// doesn't, it waits paused on its first picture. It never plays muted. It stays off under reduced motion and data
// saving until someone presses play.
// Every word it shows is in the HTML, so each language's page brings its own.
(() => {
  const film = document.querySelector("video.film");
  const bar = document.querySelector(".film-bar");
  if (!film || !bar || !film.dataset.film) return;
  const toggle = bar.querySelector(".film-toggle");
  const cue = document.querySelector(".film-cue");
  const source = rendition();
  // The large file's name stands for the film, so a language switch or a turned phone carries on where it was.
  const name = film.dataset.film.split("/").pop();
  // One entry for this tab only. The privacy page names it and what it holds.
  const KEY = "latentheinzels-film";

  let choice; // what the visitor chose, and how far the film is
  let refused = false; // the browser withheld the sound
  let startAt = null; // a position to go to as soon as the film's length is known
  let attempt = 0; // an autoplay answer that arrives late must not undo a press
  let ourPause = false;
  let mutedByUs = false;
  let leaving = false;
  let onScreen = false;

  // 720x1280 for large screens, 540x960 for phones, 360x640 for the smallest and for slow lines. One choice a page,
  // before the first request, so nothing is fetched twice. Browsers that don't report the line go by the screen.
  function rendition() {
    const { film: large, filmMid: middle = large, filmSmall: light = middle } = film.dataset;
    const line = navigator.connection;
    const phone = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 500px)").matches;
    if (line?.saveData || ["slow-2g", "2g", "3g"].includes(line?.effectiveType) || line?.downlink < 1.5) return light;
    const modest = line?.downlink < 3;
    if (!phone) return modest ? middle : large;
    return modest || matchMedia("(max-width: 340px)").matches ? light : middle;
  }

  function read() {
    choice = { film: name, time: 0, paused: false, muted: false, heard: false };
    try {
      const kept = JSON.parse(sessionStorage.getItem(KEY));
      if (!kept) return;
      for (const part of ["paused", "muted", "heard"]) choice[part] = kept[part] === true;
      // Another film file starts at its beginning.
      if (kept.film === name && Number.isFinite(kept.time) && kept.time > 0) choice.time = kept.time;
    } catch {
      // Without storage the film works the same, it just remembers nothing.
    }
  }

  function write() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(choice));
    } catch {
      // As above.
    }
  }

  // One button: Pause while the film plays with its sound, Play in every other case (muted, paused or ended).
  function heard() {
    return !film.paused && !film.ended && !film.muted;
  }

  function show() {
    const on = heard();
    const [playLabel, pauseLabel] = toggle.querySelectorAll("span");
    toggle.classList.toggle("second", on);
    toggle.setAttribute("aria-pressed", String(on));
    toggle.setAttribute("aria-label", (on ? pauseLabel : playLabel).textContent);
    const wanted = refused && !on;
    toggle.classList.toggle("wanted", wanted);
    // The top button belongs to the page that shows the film; elsewhere the bar and the corner are enough.
    if (cue) cue.hidden = !wanted || !film.closest(".visual");
  }

  // A pause belongs to moving around the site. A reload or a new arrival starts the film again, from the top.
  function arrived() {
    const [entry] = performance.getEntriesByType("navigation");
    if (entry?.type === "reload") return true;
    return entry?.type !== "back_forward" && !document.referrer.startsWith(`${location.origin}/`);
  }

  function setMuted(value) {
    mutedByUs = value;
    film.muted = value;
  }

  function seek(time) {
    if (film.readyState) {
      startAt = null;
      film.currentTime = time;
    } else {
      startAt = time;
    }
  }

  function load() {
    if (!film.getAttribute("src")) {
      // The film's own first picture, so nothing jumps when it starts.
      if (film.dataset.poster) film.poster = film.dataset.poster;
      film.src = source;
      seek(choice.time);
    }
    const failed = document.querySelector(".film-failed > span");
    if (failed) failed.hidden = true;
  }

  function pause() {
    if (film.paused) return;
    ourPause = true;
    film.pause();
  }

  // A press. The call to play has to stay inside it, or the browser withholds the sound.
  function play({ fromStart = false, withSound = false } = {}) {
    attempt += 1;
    load();
    if (withSound) {
      refused = false;
      choice.muted = false;
      setMuted(false);
    }
    if (fromStart) {
      choice.time = 0;
      seek(0);
    }
    choice.paused = false;
    write();
    film.hidden = false;
    // The other player goes now, not when the film's own event arrives a moment later.
    document.dispatchEvent(new Event("film:play"));
    film.play().catch(() => {}).then(show);
    show();
  }

  let first = true;

  async function visit() {
    read();
    if (first) {
      first = false;
      if (arrived()) {
        Object.assign(choice, { paused: false, time: 0, heard: false });
        write();
      }
    }
    // The film is only ever heard: a mute kept from an earlier page doesn't carry over.
    setMuted(false);
    show();
    const saving = navigator.connection?.saveData === true;
    if (saving || matchMedia("(prefers-reduced-motion: reduce)").matches || choice.paused) return;
    const mine = ++attempt;
    load();
    // It has no background of its own, so the still shows through until the first picture is there.
    film.hidden = false;
    try {
      await film.play();
    } catch (error) {
      // The browser withholds the sound: the film waits on its first picture for a press or a first tap.
      if (mine === attempt && error.name === "NotAllowedError") refused = true;
    }
    show();
  }


  // Play brings the sound, from where the film is; Pause stops it.
  function press() {
    if (!heard()) {
      play({ fromStart: film.ended, withSound: true });
      return;
    }
    attempt += 1;
    // Paused by hand: a tap elsewhere must not start it again.
    refused = false;
    choice.paused = true;
    pause();
    write();
    show();
  }
  toggle.addEventListener("click", press);

  // Where the browser withheld the sound, the top button and the first tap anywhere but on a control bring it.
  cue?.addEventListener("click", press);
  const CONTROLS = "a, button, input, select, textarea, label, summary, video, audio, iframe, [role=button], .details";
  // On the page's own blocks, as iPhones send no click to the document from plain text or pictures. Only on the page
  // that shows the film: a tap on another page is for that page.
  let page = new AbortController();
  function bind() {
    page.abort();
    page = new AbortController();
    const start = document.querySelector(".featured-play");
    if (start) {
      start.hidden = false;
      start.addEventListener("click", () => play({ fromStart: true, withSound: true }), { signal: page.signal });
    }
    for (const area of document.querySelectorAll("header, main, footer")) {
      area.addEventListener("click", event => {
        if (refused && !heard() && film.closest(".visual") && !event.target.closest(CONTROLS)) press();
      }, { signal: page.signal });
    }
  }
  bind();

  film.addEventListener("loadedmetadata", () => {
    if (startAt === null) return;
    film.currentTime = startAt < film.duration ? startAt : 0;
    startAt = null;
  });

  film.addEventListener("play", () => {
    ourPause = false;
    choice.paused = false;
    document.dispatchEvent(new Event("film:play"));
    show();
  });

  film.addEventListener("playing", () => {
    film.hidden = false;
    if (!film.muted) choice.heard = true;
    write();
    show();
  });

  film.addEventListener("pause", () => {
    const ours = ourPause;
    ourPause = false;
    // The film's own controls and media keys count as the visitor's pause. A browser that stops a silent film off
    // screen, a hidden tab and leaving the page don't.
    const theirs = !ours && !film.ended && !leaving && !document.hidden && (!film.muted || onScreen);
    if (theirs && film.readyState) choice.paused = true;
    write();
    show();
  });

  film.addEventListener("volumechange", () => {
    if (film.muted !== mutedByUs) {
      mutedByUs = film.muted;
      refused = false;
    }
    // Muted by the film's own controls or the system, it stops as a pause would, and Play brings the sound back.
    if (film.muted && !film.paused) {
      choice.paused = true;
      pause();
    }
    if (!film.muted && !film.paused && film.readyState > 2) choice.heard = true;
    write();
    show();
  });

  film.addEventListener("timeupdate", () => {
    // Some browsers report the end before its event, and the button already says Play then.
    if (film.ended) show();
    if (startAt !== null || film.ended) return;
    // Kept in memory; storage only hears of it on a press or when the page is left.
    choice.time = film.currentTime;
  });

  film.addEventListener("ended", () => {
    choice.paused = true;
    choice.time = 0;
    // Ready for the next press, with the still in place until then.
    film.hidden = true;
    seek(0);
    write();
    show();
  });

  film.addEventListener("error", () => {
    film.hidden = true;
    pause();
    film.removeAttribute("src");
    // Without this the element still counts as playing, and the buttons would say so.
    film.load();
    const failed = document.querySelector(".film-failed > span");
    if (failed) failed.hidden = false;
    show();
  });

  // One sound at a time.
  document.addEventListener("soundcloud:play", () => {
    attempt += 1;
    refused = false;
    choice.paused = true;
    pause();
    write();
    show();
  });

  const seen = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
  }) : null;
  seen?.observe(film.parentElement);

  // Another page of this site came in around the film (nav.js): its buttons, its place for the film, its words.
  document.addEventListener("site:swap", () => {
    seen?.disconnect();
    onScreen = false;
    if (film.closest(".visual")) seen?.observe(film.parentElement);
    bind();
    show();
  });

  addEventListener("pagehide", () => {
    leaving = true;
    if (film.readyState && startAt === null && !film.ended) choice.time = film.currentTime;
    write();
    pause();
  });

  addEventListener("pageshow", event => {
    if (!event.persisted) return;
    // Back from another page, which may have moved the film on.
    leaving = false;
    read();
    if (film.getAttribute("src")) seek(choice.time);
    visit();
  });

  bar.hidden = false;
  document.body.classList.add("with-film");
  if (document.hidden) {
    read();
    show();
    document.addEventListener("visibilitychange", visit, { once: true });
  } else {
    visit();
  }
})();

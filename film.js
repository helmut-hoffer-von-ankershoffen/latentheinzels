// The top song's film, from this site. It starts on a visit, with sound where the browser allows that and muted where
// it doesn't. It stays off under reduced motion and data saving until someone presses play.
// Every word it shows is in the HTML, so each language's page brings its own.
(() => {
  const film = document.querySelector("video.film");
  const bar = document.querySelector(".film-bar");
  if (!film || !bar || !film.dataset.film) return;
  const start = document.querySelector(".featured-play");
  const toggle = bar.querySelector(".film-toggle");
  const sound = bar.querySelector(".film-sound");
  const failed = document.querySelector(".film-failed > span");
  // Phones and slow lines get the light file. It is chosen once a page, before anything loads.
  const phone = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 500px)").matches;
  const line = navigator.connection;
  const slow = ["slow-2g", "2g", "3g"].includes(line?.effectiveType) || line?.downlink < 1.5 || line?.saveData === true;
  const source = ((phone || slow) && film.dataset.filmSmall) || film.dataset.film;
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

  function show() {
    const playing = !film.paused;
    toggle.classList.toggle("second", playing);
    sound.classList.toggle("second", film.muted);
    sound.classList.toggle("wanted", film.muted && refused);
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
      film.src = source;
      seek(choice.time);
    }
    failed.hidden = true;
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

  async function visit() {
    read();
    setMuted(choice.muted);
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
      if (mine !== attempt || error.name !== "NotAllowedError" || film.muted) {
        show();
        return;
      }
      refused = true;
      setMuted(true);
      try {
        await film.play();
      } catch {
        // A browser may refuse even this, for example to save power. The play buttons are there.
      }
    }
    show();
  }

  start.addEventListener("click", () => play({ fromStart: true, withSound: true }));

  toggle.addEventListener("click", () => {
    if (film.paused) {
      play();
      return;
    }
    attempt += 1;
    choice.paused = true;
    pause();
    write();
    show();
  });

  sound.addEventListener("click", () => {
    if (film.muted) {
      // Never heard in this tab, it starts over with its sound. Heard, on another language's page say, it carries on.
      if (refused) play({ fromStart: !choice.heard, withSound: true });
      else {
        choice.muted = false;
        setMuted(false);
      }
    } else {
      refused = false;
      choice.muted = true;
      setMuted(true);
    }
    write();
    show();
  });

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
      choice.muted = film.muted;
    }
    if (!film.muted && !film.paused && film.readyState > 2) choice.heard = true;
    write();
    show();
  });

  film.addEventListener("timeupdate", () => {
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
    failed.hidden = false;
    show();
  });

  // One sound at a time.
  document.addEventListener("soundcloud:play", () => {
    attempt += 1;
    choice.paused = true;
    pause();
    write();
    show();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      onScreen = entries[entries.length - 1].isIntersecting;
    }).observe(film.parentElement);
  }

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
  start.hidden = false;
  document.body.classList.add("with-film");
  if (document.hidden) {
    read();
    show();
    document.addEventListener("visibilitychange", visit, { once: true });
  } else {
    visit();
  }
})();

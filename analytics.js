// Google Analytics 4, and only after a visitor allows it. Before that, and after Decline, nothing goes to Google.
// The privacy notice names what is kept here and the cookies Google sets: change both together.
(() => {
  const ID = "G-EL18RTQ5GY";
  const KEY = "latentheinzels-analytics";
  // Google's default would set the cookies on all of heinzel.team.
  const DOMAIN = "latentheinzels.heinzel.team";
  const banner = document.querySelector(".consent");
  const settings = document.querySelector(".consent-settings");
  if (!banner || !settings) return;
  const root = document.documentElement;
  const filmBar = document.querySelector(".film-bar");
  let choice = null;
  let loaded = false;

  function read() {
    try {
      const kept = localStorage.getItem(KEY);
      choice = kept === "allow" || kept === "decline" ? kept : null;
    } catch {
      // Without storage a choice lasts for this page and the question comes back on the next one.
    }
  }

  function keep(value) {
    choice = value;
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // As above.
    }
  }

  function removeCookies() {
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0].trim();
      if (name !== "_ga" && !name.startsWith("_ga_")) continue;
      // Only this site's own cookies: its host, never the domain above it.
      for (const domain of ["", `; domain=${location.hostname}`, `; domain=${DOMAIN}`]) {
        document.cookie = `${name}=; path=/; max-age=0${domain}`;
      }
    }
  }

  function load() {
    if (loaded) return;
    loaded = true;
    window[`ga-disable-${ID}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
    });
    // The only update, ever.
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: DOMAIN
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
    document.head.append(script);
  }

  function room() {
    root.style.setProperty("--film-bar-room", `${filmBar ? filmBar.getBoundingClientRect().height : 0}px`);
    root.style.setProperty("--consent-room", `${banner.hidden ? 0 : banner.getBoundingClientRect().height}px`);
  }

  function ask(asking) {
    banner.hidden = !asking;
    root.classList.toggle("asking", asking);
    room();
  }

  function apply() {
    if (choice === "allow") {
      load();
    } else {
      window[`ga-disable-${ID}`] = true;
      removeCookies();
      // A fresh page is the only one that holds none of Google's code.
      if (loaded) {
        // Not reload(): to the film a reload is a new arrival, which would undo the visitor's pause.
        location.replace(location.pathname + location.search);
        return;
      }
    }
    settings.classList.toggle("allowed", choice === "allow");
    ask(choice === null);
  }

  function decide(value) {
    keep(value);
    const inside = banner.contains(document.activeElement);
    apply();
    if (inside) settings.focus({ preventScroll: true });
  }

  banner.querySelector(".consent-decline").addEventListener("click", () => decide("decline"));
  banner.querySelector(".consent-allow").addEventListener("click", () => decide("allow"));

  settings.addEventListener("click", () => {
    // Withdrawing takes one press, as allowing does.
    if (choice === "allow") {
      decide("decline");
      return;
    }
    ask(true);
    banner.querySelector(".consent-decline").focus({ preventScroll: true });
  });

  function followOtherPage() {
    read();
    apply();
  }
  addEventListener("storage", event => {
    if (event.key === KEY || event.key === null) {
      if (event.newValue === null) choice = null;
      followOtherPage();
    }
  });
  addEventListener("pageshow", event => {
    if (event.persisted) followOtherPage();
  });

  if ("ResizeObserver" in window) {
    const watch = new ResizeObserver(room);
    watch.observe(banner, { box: "border-box" });
    if (filmBar) watch.observe(filmBar, { box: "border-box" });
  }

  settings.hidden = false;
  followOtherPage();
})();

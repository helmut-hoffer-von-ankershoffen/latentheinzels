// Google Analytics 4, and only after a visitor allows it. Before that, and after Decline, nothing goes to Google.
// The privacy notice names what is kept here and the cookies Google sets: change both together.
(() => {
  const ID = "G-EL18RTQ5GY";
  const KEY = "latentheinzels-analytics";
  // Google's default would set the cookies on all of heinzel.team, as the first version of this script did.
  const DOMAIN = "latentheinzels.heinzel.team";
  const PARENT = "heinzel.team";
  const SESSION = `_ga_${ID.slice(2)}`;
  const banner = document.querySelector(".consent");
  // On the privacy page only: the current choice, with withdrawal and a new Accept.
  const panel = document.querySelector(".consent-panel");
  if (!banner) return;
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

  function cookieNames() {
    return document.cookie.split(";").map(part => part.split("=")[0].trim())
      .filter(name => name === "_ga" || name.startsWith("_ga_"));
  }

  function expire(name, domain) {
    document.cookie = `${name}=; path=/; max-age=0${domain ? `; domain=${domain}` : ""}`;
  }

  // On the parent domain only what is this site's: the session cookie always, _ga only beside it and only when no
  // other _ga_* says that another heinzel.team site counts with the same _ga.
  function removeParentCookies(names) {
    expire(SESSION, PARENT);
    const others = names.some(name => name !== "_ga" && name !== SESSION);
    if (names.includes(SESSION) && !others) expire("_ga", PARENT);
  }

  function removeCookies() {
    const names = cookieNames();
    for (const name of names) {
      for (const domain of ["", location.hostname, DOMAIN]) expire(name, domain);
    }
    removeParentCookies(names);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    // Who accepted the first version has the cookies on the parent domain: they go before Google's script loads.
    removeParentCookies(cookieNames());
    window[`ga-disable-${ID}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    // First of all commands: later, and in config alone, the tag ignores it.
    window.gtag("set", { cookie_domain: DOMAIN });
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
    if (panel) panel.dataset.choice = choice || "none";
    ask(choice === null);
  }

  function decide(value) {
    keep(value);
    const inside = banner.contains(document.activeElement);
    apply();
    // The question has gone: the privacy link, where the choice can be changed, takes the focus.
    if (inside) document.querySelector('footer a[href$="/privacy/"]')?.focus({ preventScroll: true });
  }

  banner.querySelector(".consent-decline").addEventListener("click", () => decide("decline"));
  banner.querySelector(".consent-allow").addEventListener("click", () => decide("allow"));

  // Withdrawing takes one press there, as allowing does.
  panel?.querySelector(".consent-withdraw").addEventListener("click", () => decide("decline"));
  panel?.querySelector(".consent-accept").addEventListener("click", () => decide("allow"));

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

  if (panel) panel.hidden = false;
  followOtherPage();
})();

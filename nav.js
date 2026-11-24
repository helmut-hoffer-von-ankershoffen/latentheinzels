// Moving between this site's pages without a reload, so the film plays on with its sound and the corner player stays.
// Every page is complete HTML of its own: without this script, for crawlers, or whenever anything here fails, a link
// simply loads the next page. Nothing here is stored.
(() => {
  // The pages this applies to, in every language. Everything else is an ordinary link.
  const PAGES = /^\/(?:(?:zh|fr|de)\/)?(?:(?:artwork|imprint|privacy|singularity)\/)?$/;
  // What stays on screen from page to page, and the stylesheets that draw it.
  const SHELL = [".film-dock", ".film-cue", ".film-bar", ".share-status"];
  const SHELL_SHEETS = ["/shell.css", "/dock.css", "/share.css"];
  const HEAD = 'title, meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], '
    + 'link[rel="alternate"], script[type="application/ld+json"]';
  // Texts that change with the language; the state the scripts keep (hidden, classes, pressed) stays as it is.
  const WORDS = ["aria-label", "title", "href", "data-copied", "data-failed", "data-share-url", "data-share-title",
    "data-share-text"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const pages = new Map(); // script address → what it does on a page
  let running = []; // the current page's own work, undone before the next page
  let shown = location.pathname;
  let entry = 0;
  let count = 0;
  let busy = false;
  const scrolls = new Map(); // in memory only: where each visited entry was scrolled to
  const homes = new Map(); // the film's words in each language, fetched once when a page without the film needs them

  const key = src => new URL(src, location.href).pathname;
  // Where each stylesheet and script came from, fixed now: a relative address read later would resolve against
  // whichever page the address bar shows by then.
  const origin = new WeakMap();
  for (const node of document.querySelectorAll('link[rel="stylesheet"], script[src]')) {
    origin.set(node, node.href || node.src);
  }
  const from = node => origin.get(node) || node.href || node.src;

  function start(init) {
    const control = new AbortController();
    running.push(control);
    try {
      init(control.signal);
    } catch (error) {
      console.error(error);
    }
  }

  // A page script hands over what it does on a page: done now, and again on every page that lists the script.
  window.sitePage = init => {
    const address = document.currentScript ? key(document.currentScript.src) : "";
    if (!pages.has(address)) pages.set(address, []);
    pages.get(address).push(init);
    start(init);
  };

  const live = document.createElement("p");
  live.className = "sr site-live";
  live.setAttribute("aria-live", "polite");

  function same(a, b) {
    for (const name of WORDS) {
      const value = b.getAttribute(name);
      if (value === null) continue;
      // The corner player's picture names Play or the way back; its script picks, from the words given here.
      if (name === "aria-label" && a.classList.contains("dock-back")) a.dataset.label = value;
      else a.setAttribute(name, value);
    }
    const ours = [...a.childNodes];
    const theirs = [...b.childNodes];
    for (let i = 0; i < Math.min(ours.length, theirs.length); i++) {
      const [x, y] = [ours[i], theirs[i]];
      if (x.nodeType === Node.TEXT_NODE && y.nodeType === Node.TEXT_NODE) x.data = y.data;
      else if (x.nodeType === Node.ELEMENT_NODE && x.tagName === y.tagName) same(x, y);
    }
  }

  async function fetchPage(url) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) throw new Error("not a page");
    return new DOMParser().parseFromString(await response.text(), "text/html");
  }

  const policy = doc => doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content;

  // The film's words in the language of a page that has no film of its own.
  async function filmWords(doc, url) {
    if (doc.querySelector(".film-bar") || !document.querySelector(".film-bar")) return doc;
    const language = url.pathname.match(/^\/(zh|fr|de)\//)?.[1] || "";
    const home = `/${language ? `${language}/` : ""}`;
    if (!homes.has(home)) homes.set(home, fetchPage(home));
    try {
      return await homes.get(home);
    } catch {
      homes.delete(home);
      return null;
    }
  }

  // The next page's stylesheets, loaded before anything changes so nothing shows unstyled.
  async function sheets(doc, url) {
    const want = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(link => new URL(link.getAttribute("href"), url).href);
    const have = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(from));
    const waits = [];
    for (const href of want) {
      if (have.has(href)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      origin.set(link, href);
      waits.push(new Promise(done => {
        link.onload = link.onerror = done;
        setTimeout(done, 3000);
      }));
      document.head.append(link);
    }
    await Promise.all(waits);
    return want;
  }

  function prune(want) {
    const film = Boolean(document.querySelector(".film-bar"));
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const path = new URL(from(link)).pathname;
      if (want.includes(from(link)) || (film && SHELL_SHEETS.includes(path))) continue;
      link.remove();
    }
  }

  function swap(doc, words) {
    const body = document.body;
    const film = document.querySelector("video.film");
    // The film leaves the old page first, in the same moment, so it never stops.
    if (film?.closest("main")) body.append(film);
    for (const node of document.head.querySelectorAll(HEAD)) node.remove();
    for (const node of doc.head.querySelectorAll(HEAD)) document.head.append(document.importNode(node, true));
    document.documentElement.lang = doc.documentElement.lang;
    for (const { name } of [...body.attributes]) if (name !== "class") body.removeAttribute(name);
    for (const { name, value } of [...doc.body.attributes]) if (name !== "class") body.setAttribute(name, value);
    const consent = body.querySelector(":scope > .consent");
    const shell = SHELL.map(selector => body.querySelector(`:scope > ${selector}`));
    const kept = shell.some(Boolean);
    const parts = [];
    for (const node of [...doc.body.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (consent && node.matches(".consent")) {
          same(consent, node);
          parts.push(consent);
          continue;
        }
        const at = SHELL.findIndex(selector => node.matches(selector));
        if (at >= 0 && kept) {
          if (shell[at]) {
            same(shell[at], node);
            parts.push(shell[at]);
          }
          continue;
        }
      }
      parts.push(document.adoptNode(node));
    }
    for (const [at, node] of shell.entries()) {
      if (!node || parts.includes(node)) continue;
      // A page without the film: the bar and the corner keep their place, in the page's language.
      const theirs = words?.querySelector(`body > ${SHELL[at]}`);
      if (theirs) same(node, theirs);
      parts.push(node);
    }
    if (film) {
      const place = parts.map(part => part.querySelector?.("main video.film")).find(Boolean);
      if (place) place.replaceWith(film);
      else parts.push(film);
    }
    parts.push(live);
    body.replaceChildren(...parts);
  }

  function arrive(url, scroll) {
    if (scroll !== undefined) {
      scrollTo({ top: scroll, behavior: "instant" });
    } else if (url.hash) {
      document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: "instant" });
    } else if (document.body.dataset.open === "film") {
      document.querySelector(".visual")?.scrollIntoView({ block: "start", behavior: "instant" });
    } else {
      scrollTo({ top: 0, behavior: "instant" });
    }
    const heading = document.querySelector("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    live.textContent = document.title;
  }

  async function scripts(doc, url) {
    for (const control of running) control.abort();
    running = [];
    const loaded = new Set([...document.querySelectorAll("script[src]")].map(script => key(from(script))));
    for (const tag of doc.querySelectorAll("head script[src]")) {
      const address = key(new URL(tag.getAttribute("src"), url).href);
      if (pages.has(address)) {
        for (const init of pages.get(address)) start(init);
      } else if (!loaded.has(address)) {
        const script = document.createElement("script");
        script.src = new URL(tag.getAttribute("src"), url).href;
        origin.set(script, script.src);
        await new Promise(done => {
          script.onload = script.onerror = done;
          document.head.append(script);
        });
      }
    }
  }

  async function go(url, { push, scroll } = {}) {
    if (busy) return;
    busy = true;
    let moved = false;
    try {
      const doc = await fetchPage(url.pathname);
      if (policy(doc) !== policy(document)) throw new Error("another policy");
      const [want, words] = await Promise.all([sheets(doc, url), filmWords(doc, url)]);
      if (push) {
        scrolls.set(entry, scrollY);
        entry = ++count;
        history.scrollRestoration = "manual";
        history.pushState({ site: entry }, "", url.href);
      }
      moved = true;
      shown = url.pathname;
      const change = () => swap(doc, words);
      if (document.startViewTransition && !reduce.matches) await document.startViewTransition(change).updateCallbackDone;
      else change();
      prune(want);
      document.dispatchEvent(new CustomEvent("site:swap"));
      arrive(url, scroll);
      await scripts(doc, url);
    } catch (error) {
      console.error(error);
      if (moved) location.reload();
      else location.assign(url.href);
    } finally {
      busy = false;
    }
  }

  // Exposed for the corner player's way back to the film.
  window.siteGo = href => {
    const url = new URL(href, location.href);
    if (PAGES.test(url.pathname)) go(url, { push: true });
    else location.assign(url.href);
  };

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href]");
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !PAGES.test(url.pathname)) return;
    // An anchor on the same page is the browser's to follow.
    if (url.pathname === location.pathname && url.hash) return;
    event.preventDefault();
    go(url, { push: true });
  });

  addEventListener("popstate", event => {
    // A move between anchors of the same page is the browser's and the page's own.
    if (location.pathname === shown) return;
    scrolls.set(entry, scrollY);
    entry = event.state?.site ?? 0;
    go(new URL(location.href), { scroll: scrolls.get(entry) ?? 0 });
  });

  history.replaceState({ ...history.state, site: 0 }, "");
  document.body.append(live);
})();

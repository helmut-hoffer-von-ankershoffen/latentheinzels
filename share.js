// Share the Extended. A shared link opens at the film. Nothing here loads or tells anyone but the device's own sheet.
(() => {
  const opened = document.body.dataset.open === "film";
  if (opened && !location.hash) {
    const toFilm = () => document.querySelector(".visual")?.scrollIntoView({ block: "start", behavior: "instant" });
    toFilm();
    // What loads above the film can still move it, until the visitor scrolls for themselves.
    let theirs = false;
    for (const name of ["wheel", "touchstart", "keydown", "pointerdown"]) {
      addEventListener(name, () => { theirs = true; }, { once: true, passive: true });
    }
    addEventListener("load", () => { if (!theirs) toFilm(); }, { once: true });
  }

  const status = document.querySelector(".share-status");
  let timer = 0;

  function say(text, url) {
    clearTimeout(timer);
    status.replaceChildren(text);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      status.append(" ", link);
    }
    timer = setTimeout(() => status.replaceChildren(), url ? 20000 : 4000);
  }

  for (const button of document.querySelectorAll("button.share")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const { shareUrl, shareTitle, shareText } = button.dataset;
      const url = new URL(shareUrl, location.origin).href;
      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url });
          return;
        } catch (error) {
          // Closing the sheet is an answer, not a failure.
          if (error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        say(status.dataset.copied);
      } catch {
        say(status.dataset.failed, url);
      }
    });
  }
})();

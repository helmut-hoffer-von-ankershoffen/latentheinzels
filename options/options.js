// Previews A and C. SoundCloud hears nothing until someone presses a still, and only one player exists at a time.
(() => {
  const music = document.querySelector("#music[data-option]");
  if (!music) return;
  const address = /^https:\/\/soundcloud\.com\/latentheinzels\/(?!sets$)[a-z0-9_-]+$/;
  const widget = "https://w.soundcloud.com";
  const option = music.dataset.option;
  const bar = document.getElementById("bar");
  let current = null;

  function player(url, title, height) {
    const frame = document.createElement("iframe");
    const settings = new URLSearchParams({
      url, auto_play: "true", visual: "false", hide_related: "true",
      show_comments: "false", show_reposts: "false", show_teaser: "false", color: "#f2b860"
    });
    frame.src = `${widget}/player/?${settings}`;
    frame.title = `SoundCloud player: ${title}`;
    frame.allow = "autoplay; encrypted-media";
    frame.height = height;
    frame.tabIndex = 0;
    return frame;
  }

  function stop() {
    if (!current) return;
    current.frame.remove();
    current.tile.classList.remove("playing", "current");
    current = null;
  }

  function play(button) {
    const { url, title } = button.dataset;
    if (!address.test(url)) return;
    stop();
    const tile = button.closest(".tile");
    const frame = player(url, title, option === "a" ? 166 : 120);
    current = { tile, button, frame };
    if (option === "a") {
      frame.className = "card-frame";
      tile.classList.add("playing");
      tile.prepend(frame);
      frame.focus();
    } else {
      tile.classList.add("current");
      bar.querySelector(".bar-title").textContent = title;
      bar.hidden = false;
      document.body.classList.add("with-bar");
      bar.append(frame);
    }
  }

  for (const button of music.querySelectorAll("button.still[data-url]")) {
    button.addEventListener("click", () => play(button));
  }
  if (option !== "c") return;

  bar.querySelector(".bar-close").addEventListener("click", () => {
    const from = current && current.button;
    stop();
    bar.hidden = true;
    document.body.classList.remove("with-bar");
    if (from) from.focus();
  });

  // The widget announces itself, then reports the end of a track if asked. The bar goes on through that list only.
  addEventListener("message", event => {
    if (event.origin !== widget || !current || event.source !== current.frame.contentWindow) return;
    let data = event.data;
    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch {
      return;
    }
    if (data?.method === "ready") {
      event.source.postMessage(JSON.stringify({ method: "addEventListener", value: "finish" }), widget);
    } else if (data?.method === "finish") {
      const list = [...current.tile.closest(".tiles").querySelectorAll("button.still[data-url]")];
      const next = list[list.indexOf(current.button) + 1];
      if (next) play(next);
    }
  });
})();

// Every track is a card, every city has its playlist, and one player exists at a time.
// SoundCloud hears nothing from this page until someone presses play.
// The addresses live in the JSON block at the end of index.html: fill one in and its play button appears.
(() => {
  const data = document.getElementById("soundcloud");
  if (!data) return;
  let known;
  try {
    known = JSON.parse(data.textContent);
  } catch (error) {
    console.error("The SoundCloud addresses in index.html are not valid JSON.", error);
    known = {};
  }
  const addresses = {
    playlists: /^https:\/\/soundcloud\.com\/latentheinzels\/sets\/[a-z0-9_-]+$/,
    tracks: /^https:\/\/soundcloud\.com\/latentheinzels\/(?!sets$)[a-z0-9_-]+$/
  };
  const addressOf = (kind, key) => {
    const url = known[kind]?.[key];
    return addresses[kind].test(url || "") ? url : null;
  };
  let current = null;

  function element(tag, className, text) {
    const made = document.createElement(tag);
    if (className) made.className = className;
    if (text) made.textContent = text;
    return made;
  }

  function player(url, title, className) {
    const frame = element("iframe", className);
    const settings = new URLSearchParams({
      url, auto_play: "true", visual: "false", hide_related: "true",
      show_comments: "false", show_reposts: "false", show_teaser: "false", color: "#f2b860"
    });
    frame.src = `https://w.soundcloud.com/player/?${settings}`;
    frame.title = `SoundCloud player: ${title}`;
    frame.allow = "autoplay; encrypted-media";
    frame.tabIndex = 0;
    return frame;
  }

  function stop() {
    if (!current) return;
    current.frame.remove();
    current.holder.classList.remove("playing");
    current = null;
  }

  function start(holder, frame, place) {
    stop();
    current = { holder, frame };
    holder.classList.add("playing");
    place(frame);
    frame.focus();
  }

  for (const tile of document.querySelectorAll(".tile[data-track]")) {
    const cover = tile.querySelector(".cover");
    const badge = cover.querySelector(".badge");
    const url = addressOf("tracks", tile.dataset.track);
    badge.hidden = false;
    if (!url) {
      tile.classList.add("soon-tile");
      badge.textContent = "soon";
      continue;
    }
    const { title } = tile.dataset;
    const button = element("button", "cover");
    button.type = "button";
    button.setAttribute("aria-label", `Play ${title}`);
    button.setAttribute("aria-describedby", "play-note");
    badge.textContent = "▶";
    badge.setAttribute("aria-hidden", "true");
    button.append(...cover.childNodes);
    cover.replaceWith(button);
    button.addEventListener("click", () => {
      start(tile, player(url, title, "card-frame"), frame => tile.prepend(frame));
    });
  }

  for (const day of document.querySelectorAll(".day[data-playlist]")) {
    const head = day.querySelector(".day-head");
    const slot = head.querySelector(".whole");
    const url = addressOf("playlists", day.dataset.playlist);
    if (!url) {
      slot.append(element("span", "pending", "Playlist soon"));
      continue;
    }
    const { title } = day.dataset;
    const button = element("button", "play-all");
    button.type = "button";
    button.setAttribute("aria-describedby", "play-note");
    const mark = element("span", "", "▶");
    mark.setAttribute("aria-hidden", "true");
    button.append(mark, "Play the whole playlist", element("span", "sr", `: ${title}`));
    slot.append(button);
    button.addEventListener("click", () => {
      start(head, player(url, title, "list-frame"), frame => head.append(frame));
    });
  }
})();

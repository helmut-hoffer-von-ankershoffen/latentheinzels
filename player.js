// One player per city. SoundCloud hears nothing from this page until someone presses play.
(() => {
  const address = /^https:\/\/soundcloud\.com\/latentheinzels\/sets\/[a-z0-9_-]+$/;
  for (const box of document.querySelectorAll(".player[data-playlist]")) {
    const url = box.dataset.playlist;
    const button = box.querySelector("button");
    if (!button || !address.test(url)) continue;
    button.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      const options = new URLSearchParams({
        url, auto_play: "true", visual: "false", hide_related: "true",
        show_comments: "false", show_reposts: "false", show_teaser: "false", color: "#f2b860"
      });
      frame.src = `https://w.soundcloud.com/player/?${options}`;
      frame.title = `SoundCloud player: ${box.dataset.title}`;
      frame.allow = "autoplay; encrypted-media";
      frame.tabIndex = 0;
      button.replaceWith(frame);
      frame.focus();
    });
    box.hidden = false;
  }
})();

// The top song's silent loop. It only runs on screen and while motion is on; otherwise the still shows.
(() => {
  const video = document.querySelector(".visual video");
  if (!video || !("IntersectionObserver" in window)) return;
  let onScreen = false;

  function update() {
    const moving = document.body.classList.contains("moving");
    if (!moving) video.classList.remove("shown");
    if (moving && onScreen) {
      if (!video.getAttribute("src")) video.src = video.dataset.src;
      video.muted = true;
      // A browser may refuse, for example to save power: then the still simply stays.
      video.play().then(() => {
        if (document.body.classList.contains("moving")) video.classList.add("shown");
      }, () => video.classList.remove("shown"));
    } else {
      video.pause();
    }
  }

  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    update();
  }).observe(video.parentElement);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();

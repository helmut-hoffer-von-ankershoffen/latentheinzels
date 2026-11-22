// Every track's description sits behind an info button. The panel lies over the page, so nothing moves when it opens.
(() => {
  let open = null;

  function close(refocus) {
    if (!open) return;
    open.panel.hidden = true;
    open.button.setAttribute("aria-expanded", "false");
    if (refocus) open.button.focus();
    open = null;
  }

  function show(button, panel) {
    close(false);
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    open = { button, panel };
    // Keep the panel inside its city, whichever card in the row it belongs to.
    panel.style.left = "0px";
    const room = button.closest(".tiles").getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const spill = Math.max(0, box.right - room.right);
    panel.style.left = `${-Math.min(spill, box.left - room.left)}px`;
  }

  for (const button of document.querySelectorAll("button.info")) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) continue;
    button.hidden = false;
    button.addEventListener("click", () => {
      if (open?.button === button) close(false);
      else show(button, panel);
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && open) close(true);
  });
  document.addEventListener("click", event => {
    if (open && !open.panel.contains(event.target) && !open.button.contains(event.target)) close(false);
  });
  document.addEventListener("focusin", event => {
    if (open && !open.panel.contains(event.target) && !open.button.contains(event.target)) close(false);
  });
  addEventListener("resize", () => {
    if (open) show(open.button, open.panel);
  });
})();

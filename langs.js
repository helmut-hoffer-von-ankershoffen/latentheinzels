// A language link opens the other language at the section being read. Nothing is stored or redirected.
(() => {
  const links = document.querySelectorAll(".langs a");
  function sectionInView() {
    if (scrollY < innerHeight / 4) return "";
    const sections = [...document.querySelectorAll("main > section[id]")];
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    if (atEnd && sections.length) return sections[sections.length - 1].id;
    let seen = "";
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= innerHeight / 2) seen = section.id;
    }
    return seen;
  }
  for (const link of links) {
    const go = () => { link.hash = sectionInView(); };
    link.addEventListener("click", go);
    link.addEventListener("auxclick", go);
  }
})();

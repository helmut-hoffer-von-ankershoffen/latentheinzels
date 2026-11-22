"""Build the Chinese, French and German pages, and the sitemap, from the English pages.

The English pages are the only source. Run `python3 -I i18n/build.py` after editing one, `--check` before pushing
and `--missing FILE` to list what the translations still need. A missing string fails the build unless
`--english-for-missing` is given, which lists each one and shows it in English. An element marked translate="no"
is copied as written.
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://latentheinzels.heinzel.team"
PAGES = ("", "imprint/", "privacy/")
# The address people share: the main page under its own title and picture, open at the film.
SHARE = "singularity/"
SHARE_PICTURE = "assets/share/singularity-2cf5f2d3.jpg"
SHARE_PICTURE_SIZE = (1200, 630)
LANGUAGES = {"zh": "zh-Hans", "fr": "fr", "de": "de"}
TEXT_ATTRIBUTES = ("alt", "aria-label", "data-label", "data-share-text", "data-copied", "data-failed")
VOID = {"br", "img", "link", "meta", "source"}
# Only the profile link may name the platform.
PROFILE = '<a href="https://suno.com/@latentheinzels">Suno</a>'
NAMES = {
    "Latent",
    "Heinzels",
    "Latent Heinzels",
    "YouTube",
    "YouTube Music",
    "SoundCloud",
    "Facebook",
    "Instagram",
    "Suno",
    "EN",
    "DE",
    "FR",
    "中文",
    "i",
}
NO_WORDS = re.compile(r"[\W\d_]*")
SPACE = re.compile(r"[ \t\r\n]+")
TOKEN = re.compile(r"<!--.*?-->|<[^>]*>|[^<]+", flags=re.DOTALL)
INLINE_BLOCK = re.compile(r"<(p|li)(\s[^>]*)?>(.*?)</\1>", flags=re.DOTALL)
INLINE_TAG = re.compile(r"<(a|em|strong|code)(?:\s[^>]*)?>.*?</\1>", flags=re.DOTALL)
EMAIL = re.compile(
    r'(?:<!--email_off-->)?<a [^>]*href="mailto:[^"]*"[^>]*>.*?</a>(?:<!--/email_off-->)?',
    flags=re.DOTALL,
)
SCRIPT = re.compile(r"<script\b[^>]*>.*?</script>", flags=re.DOTALL)


class BuildError(Exception):
    """A page can't be built as it stands."""


def plain(fragment: str) -> str:
    """The text of a fragment, with white space collapsed as a browser shows it."""
    return SPACE.sub(" ", html.unescape(re.sub(r"<!--.*?-->|<[^>]*>", "", fragment, flags=re.DOTALL))).strip(" ")


def names_in(page: str) -> set[str]:
    """Titles and names, which stay English in every language."""
    found = set(NAMES)
    patterns = (
        r'data-title="([^"]+)"',
        r'<span class="(?:song|version)">([^<]+)</span>',
        r"<h3>(Heinzels in [^<]+)<span>",
        r"<h3>Heinzels in [^<]+<span>([^<]+)</span>",
        r'<li id="[^"]+"><h3>([^<]+)<small>',
        r'<dt><a href="#[^"]+">([^<]+)</a>',
        r'<span class="name">([^<]+)</span>',
    )
    for pattern in patterns:
        found |= {plain(value) for value in re.findall(pattern, page)}
    return found


class Translator:
    """One language's strings, and what they lack."""

    def __init__(self, strings: dict[str, str], names: set[str]) -> None:
        """Keep the strings and the names that stay English."""
        self.strings = strings
        self.names = names
        self.missing: list[str] = []

    def text(self, english: str) -> str:
        """The translation of one string, which is noted when there is none."""
        if english in self.strings:
            return self.strings[english]
        if english in self.names or NO_WORDS.fullmatch(english):
            return english
        if english not in self.missing:
            self.missing.append(english)
        return english

    def labelled(self, prefix: str, title: str) -> str:
        """A label that holds a title: by its full text, else by its template."""
        if prefix + title in self.strings:
            return self.strings[prefix + title]
        return self.text(prefix + "${title}").replace("${title}", title)

    def node(self, raw: str) -> str:
        """One text node, with the white space around it kept."""
        english = plain(raw)
        if not english:
            return raw
        before = raw[: len(raw) - len(raw.lstrip(" \t\r\n"))]
        after = raw[len(raw.rstrip(" \t\r\n")) :]
        return before + html.escape(self.text(english), quote=False) + after

    def sentence(self, match: re.Match[str]) -> str:
        """A paragraph with links or emphasis inside, translated as one sentence."""
        tag, attributes, inner = match.group(1), match.group(2) or "", match.group(3)
        if 'translate="no"' in attributes or "<br" in inner:
            return match.group(0)
        held: list[str] = []

        def hold(found: re.Match[str]) -> str:
            held.append(found.group(0))
            return "{email}"

        body = EMAIL.sub(hold, inner)
        parts = list(INLINE_TAG.finditer(body))
        outside = INLINE_TAG.sub("", body)
        if "<" in outside or not (parts or held) or not plain(outside):
            return match.group(0)
        english = plain(body)
        done = html.escape(self.text(numbered(body, parts)) if english not in self.strings else self.strings[english])
        for index, part in enumerate(parts, start=1):
            done = self.put_back(done, part.group(0), index)
        for email in held:
            done = done.replace("{email}", email, 1)
        return f'<{tag}{attributes} data-done="">{done}</{tag}>'

    def put_back(self, done: str, element: str, index: int) -> str:
        """Wrap the marked or matching words in the element they had."""
        opening = element[: element.index(">") + 1]
        closing = element[element.rindex("<") :]
        marked = re.search(rf"&lt;{index}&gt;(.*?)&lt;/{index}&gt;", done)
        if marked:
            return done.replace(marked.group(0), opening + marked.group(1) + closing)
        words = html.escape(self.text(plain(element)))
        if done.count(words) == 1:
            return done.replace(words, opening + words + closing)
        if plain(element) not in self.missing:
            self.missing.append(plain(element))
        return done


def numbered(body: str, parts: list[re.Match[str]]) -> str:
    """The sentence as translators get it: each element becomes a numbered mark."""
    out, at = "", 0
    for index, part in enumerate(parts, start=1):
        out += html.unescape(body[at : part.start()]) + f"<{index}>{plain(part.group(0))}</{index}>"
        at = part.end()
    return SPACE.sub(" ", out + html.unescape(body[at:])).strip(" ")


def attribute(tag: str, name: str) -> str | None:
    """One attribute's value."""
    found = re.search(rf'\s{name}="([^"]*)"', tag)
    return html.unescape(found.group(1)) if found else None


def with_attribute(tag: str, name: str, value: str) -> str:
    """The tag with one attribute set."""
    pair = f' {name}="{html.escape(value)}"'
    if attribute(tag, name) is None:
        return tag[:-1] + pair + ">"
    return re.sub(rf'\s{name}="[^"]*"', lambda _: pair, tag, count=1)


def localised_tag(tag: str, translator: Translator) -> str:
    """A start tag with its texts, and the labels the players write, translated."""
    for name in TEXT_ATTRIBUTES:
        if (value := attribute(tag, name)) is not None:
            tag = with_attribute(tag, name, translator.text(value))
    if tag.startswith("<meta") and attribute(tag, "name") == "description":
        tag = with_attribute(tag, "content", translator.text(attribute(tag, "content") or ""))
    title = attribute(tag, "data-title")
    if title is None:
        return tag
    tag = with_attribute(tag, "data-player", translator.labelled("SoundCloud player: ", title))
    if attribute(tag, "data-track") is not None:
        tag = with_attribute(tag, "data-play", translator.labelled("Play ", title))
    if attribute(tag, "data-playlist") is not None:
        tag = with_attribute(tag, "data-after", translator.text(f": {title}"))
        if attribute(tag, "data-label") is None:
            tag = with_attribute(tag, "data-label", translator.text("Play the whole playlist"))
    return tag


def translated_body(page: str, translator: Translator) -> str:
    """Every visible string and text attribute, outside scripts and what is marked as fixed.

    Raises:
        BuildError: When an element is not closed.
    """
    out: list[str] = []
    kept: list[bool] = []
    for token in TOKEN.findall(INLINE_BLOCK.sub(translator.sentence, page)):
        fixed = bool(kept) and kept[-1]
        if token.startswith(("<!", "</")):
            if token.startswith("</") and kept:
                kept.pop()
            out.append(token)
        elif token.startswith("<"):
            name = re.match(r"<([a-z0-9]+)", token)
            done = attribute(token, "data-done") is not None
            own = token.replace(' data-done=""', "")
            out.append(own if fixed else localised_tag(own, translator))
            if name and name.group(1) not in VOID:
                kept.append(fixed or done or attribute(token, "translate") == "no")
        else:
            out.append(token if fixed else translator.node(token))
    if kept:
        message = f"{len(kept)} elements are not closed"
        raise BuildError(message)
    return "".join(out)


def rooted(page: str) -> str:
    """The same page with addresses that work from any folder."""
    page = re.sub(r'((?:href|src|data-src|srcset)="|, )(assets/)', r"\1/\2", page)
    return re.sub(r'((?:href|src)=")((?:[a-z]+\.(?:css|js))\?v=)', r"\1/\2", page)


def share_page(main_page: str, folder: str) -> str:
    """The address to share, built from that language's main page. Crawlers need no script to read its card.

    Raises:
        BuildError: When the main page has no share button, still, switch or one of the tags it replaces.
    """
    button = re.search(r'<button class="share"[^>]*>', main_page)
    still = re.search(r'<img id="featured-still"[^>]*>', main_page)
    switch = re.search(r'<nav class="langs".*?</nav>', main_page, flags=re.DOTALL)
    if not (button and still and switch):
        message = f"/{folder}: the share button, still or language switch is missing"
        raise BuildError(message)
    title = attribute(button.group(0), "data-share-title") or ""
    text = html.escape(attribute(button.group(0), "data-share-text") or "")
    alt = html.escape(attribute(still.group(0), "alt") or "")
    address, picture = f"{SITE}/{folder}{SHARE}", f"{SITE}/{SHARE_PICTURE}"
    width, height = SHARE_PICTURE_SIZE
    card = (
        f'<meta name="description" content="{text}">\n'
        f'<meta property="og:type" content="website">\n'
        f'<meta property="og:site_name" content="Latent Heinzels">\n'
        f'<meta property="og:url" content="{address}">\n'
        f'<meta property="og:title" content="{html.escape(title)}">\n'
        f'<meta property="og:description" content="{text}">\n'
        f'<meta property="og:image" content="{picture}">\n'
        f'<meta property="og:image:type" content="image/jpeg">\n'
        f'<meta property="og:image:width" content="{width}">\n'
        f'<meta property="og:image:height" content="{height}">\n'
        f'<meta property="og:image:alt" content="{alt}">\n'
        f'<meta name="twitter:card" content="summary_large_image">\n'
        f"<title>{html.escape(title, quote=False)} · Latent Heinzels</title>"
    )
    page = re.sub(r'<meta (?:property="og:|name="(?:description|twitter:|google-site))[^>]*>\n', "", rooted(main_page))
    page, titles = re.subn(r"<title>[^<]*</title>", lambda _: card, page, count=1)
    page, bodies = re.subn(r"<body([^>]*)>", r'<body\1 data-open="film">', page, count=1)
    if not (titles and bodies):
        message = f"/{folder}: no title or body"
        raise BuildError(message)
    new = re.sub(r'href="(/(?:[a-z]+/)?)"', rf'href="\1{SHARE}"', switch.group(0))
    page = page.replace(switch.group(0), new)
    return re.sub(r'(<link rel="(?:canonical|alternate)"[^>]*href="[^"]+/)"', rf'\1{SHARE}"', page)


def moved(page: str, language: str, path: str) -> str:
    """Addresses that still work one folder down, and links that stay in the language.

    Raises:
        BuildError: When the page has no language switch.
    """
    page = rooted(page)
    page = page.replace(f'data-share-url="/{SHARE}"', f'data-share-url="/{language}/{SHARE}"')
    # The language switch already names every language, so its links stay as they are.
    switch = re.search(r'<nav class="langs".*?</nav>', page, flags=re.DOTALL)
    if not switch:
        message = f"/{path}: no language switch"
        raise BuildError(message)
    old = switch.group(0)
    page = page.replace(old, "\0")
    page = re.sub(r'(<a [^>]*href=")/((?:imprint/|privacy/)?)"', rf'\1/{language}/\2"', page)
    new = old.replace(' aria-current="page"', "")
    new = new.replace(f'data-lang="{language}"', f'data-lang="{language}" aria-current="page"')
    page = page.replace("\0", new)
    address = f'<link rel="canonical" href="{SITE}/'
    page = page.replace(f'{address}{path}">', f'{address}{language}/{path}">')
    # Search Console's tag stands on the start page only.
    page = re.sub(r'<meta name="google-site-verification"[^>]*>\n', "", page)
    return page.replace('<html lang="en">', f'<html lang="{LANGUAGES[language]}">', 1)


def built(source: str, language: str, path: str, translator: Translator) -> str:
    """One translated page.

    Raises:
        BuildError: When the platform is named outside the profile link.
    """
    scripts = SCRIPT.findall(source)
    body = translated_body(SCRIPT.sub("<!--script-->", source), translator)
    for script in scripts:
        body = body.replace("<!--script-->", script, 1)
    page = moved(body, language, path)
    if re.search("suno", page.replace(PROFILE, ""), flags=re.IGNORECASE):
        message = f"/{language}/{path}: the platform is named outside the profile link"
        raise BuildError(message)
    return page


def sitemap() -> str:
    """Every public page in every language, each with its alternates. The previews under options/ are not in it."""
    folders = {"en": "", **{tag: f"{language}/" for language, tag in LANGUAGES.items()}}
    entries = []
    for path in (*PAGES, SHARE):
        links = [(tag, f"{SITE}/{folder}{path}") for tag, folder in folders.items()]
        shared = "".join(
            f'    <xhtml:link rel="alternate" hreflang="{tag}" href="{url}"/>\n'
            for tag, url in [*links, ("x-default", f"{SITE}/{path}")]
        )
        entries += [f"  <url>\n    <loc>{url}</loc>\n{shared}  </url>\n" for _, url in links]
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        f"{''.join(entries)}</urlset>\n"
    )


def build_all() -> tuple[dict[Path, str], dict[str, list[str]]]:
    """Every translated page, and what each language lacks."""
    sources = {path: (ROOT / path / "index.html").read_text(encoding="utf-8") for path in PAGES}
    names = set().union(*(names_in(source) for source in sources.values()))
    pages, missing = {ROOT / SHARE / "index.html": share_page(sources[""], "")}, {}
    for language in LANGUAGES:
        strings = json.loads((ROOT / "i18n" / f"{language}.json").read_text(encoding="utf-8"))
        translator = Translator(strings, names)
        for path, source in sources.items():
            pages[ROOT / language / path / "index.html"] = built(source, language, path, translator)
        main_page = pages[ROOT / language / "index.html"]
        pages[ROOT / language / SHARE / "index.html"] = share_page(main_page, f"{language}/")
        if translator.missing:
            missing[language] = translator.missing
    pages[ROOT / "sitemap.xml"] = sitemap()
    return pages, missing


def marked_english(path: Path, text: str, missing: dict[str, list[str]]) -> str:
    """A legal page that still shows English says so to screen readers and search engines."""
    folder = path.parent.relative_to(ROOT).parts
    if len(folder) > 1 and folder[0] in missing and f"{folder[1]}/" != SHARE:
        return text.replace('<main id="main">', '<main id="main" lang="en">', 1)
    return text


def main() -> int:
    """Build, or only check.

    Returns:
        The process exit code: 1 when a string is missing or a page is out of date.
    """
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--check", action="store_true", help="write nothing; fail when a page is out of date")
    arguments.add_argument("--missing", type=Path, help="write the missing strings to this JSON file")
    arguments.add_argument("--english-for-missing", action="store_true", help="warn instead of failing")
    options = arguments.parse_args()
    try:
        pages, missing = build_all()
    except BuildError as error:
        sys.stderr.write(f"{error}\n")
        return 1
    if options.missing:
        options.missing.write_text(json.dumps(missing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if missing:
        for language, strings in missing.items():
            sys.stderr.write(f"{language}: {len(strings)} strings have no translation\n")
        if not options.english_for_missing:
            sys.stderr.write("nothing was written\n")
            return 1
        pages = {path: marked_english(path, text, missing) for path, text in pages.items()}
    stale = [path for path, text in pages.items() if not path.is_file() or path.read_text(encoding="utf-8") != text]
    if options.check:
        for path in stale:
            sys.stderr.write(f"out of date: {path.relative_to(ROOT)}\n")
        return int(bool(stale))
    for path in stale:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(pages[path], encoding="utf-8")
    sys.stdout.write(f"{len(pages)} files, {len(stale)} written\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

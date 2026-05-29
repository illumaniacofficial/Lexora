// Minimal EPUB builder. EPUB is a ZIP archive with a specific structure.
// No zip library is available, so this implements a tiny store-mode (no
// compression) ZIP writer. EPUB readers accept stored (uncompressed) entries.
// The "mimetype" entry MUST be the first entry and stored uncompressed.

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression method (0 = store)
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    localParts.push(local, nameBuf, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + entry.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // central dir start disk
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralDir.length, 12); // central dir size
  end.writeUInt32LE(localData.length, 16); // central dir offset
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localData, centralDir, end]);
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphsToHtml(content: string): string {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("### ")) return `<h3>${esc(p.slice(4))}</h3>`;
      if (p.startsWith("## ")) return `<h2>${esc(p.slice(3))}</h2>`;
      if (p.startsWith("# ")) return `<h1>${esc(p.slice(2))}</h1>`;
      if (p.startsWith("> ")) return `<blockquote>${esc(p.slice(2))}</blockquote>`;
      if (p.startsWith("- ") || p.startsWith("* ")) return `<p class="bullet">\u2022 ${esc(p.slice(2))}</p>`;
      if (/^(---|\*\*\*)/.test(p)) return `<hr/>`;
      return `<p>${esc(p)}</p>`;
    })
    .join("\n");
}

export interface EpubChapter {
  chapterNumber: number;
  title: string;
  content: string | null;
}

export interface EpubOptions {
  title: string;
  authorName: string;
  language?: string;
  chapters: EpubChapter[];
}

const BCP47_MAP: Record<string, string> = {
  english: "en", spanish: "es", french: "fr", german: "de", italian: "it",
  portuguese: "pt", dutch: "nl", russian: "ru", japanese: "ja", korean: "ko",
  chinese: "zh", "chinese (simplified)": "zh-Hans", "chinese (traditional)": "zh-Hant",
  arabic: "ar", hindi: "hi", polish: "pl", turkish: "tr", swedish: "sv",
  norwegian: "no", danish: "da", finnish: "fi", greek: "el", hebrew: "he",
};

function toBcp47(lang?: string): string {
  if (!lang) return "en";
  const trimmed = lang.trim();
  const lower = trimmed.toLowerCase();
  if (BCP47_MAP[lower]) return BCP47_MAP[lower];
  // Already a plausible BCP47 tag (e.g., "en", "en-US", "zh-Hans").
  if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(trimmed)) return trimmed;
  return "en";
}

export function buildEpub(opts: EpubOptions): Buffer {
  const { title, authorName } = opts;
  const language = toBcp47(opts.language);
  const chapters = opts.chapters;
  const bookId = `urn:uuid:lexora-${Date.now()}`;

  const css = `body{font-family:Georgia,serif;line-height:1.6;margin:5%;}
h1,h2,h3{font-weight:bold;line-height:1.3;}
.chapter-num{color:#777;font-style:italic;font-size:0.9em;margin-bottom:0.2em;}
.chapter-title{font-size:1.6em;margin-top:0;margin-bottom:1.5em;}
p{margin:0 0 0.2em;text-indent:1.4em;}
p.bullet{text-indent:0;margin-left:1em;}
blockquote{font-style:italic;color:#555;margin:1em 2em;}
hr{border:0;border-top:1px solid #ccc;width:30%;margin:1.5em auto;}
.title-page{text-align:center;margin-top:30%;}
.title-page h1{font-size:2.2em;}
.title-page .author{font-style:italic;color:#555;font-size:1.2em;}`;

  const xhtmlDoc = (bodyTitle: string, body: string) =>
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}">
<head><meta charset="utf-8"/><title>${esc(bodyTitle)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;

  const titlePage = xhtmlDoc(
    title,
    `<div class="title-page"><h1>${esc(title)}</h1><p class="author">by ${esc(authorName)}</p></div>`,
  );

  const tocLinks = chapters
    .map((ch, i) => `<p><a href="chap${i + 1}.xhtml">Chapter ${ch.chapterNumber}: ${esc(ch.title)}</a></p>`)
    .join("\n");
  const tocPage = xhtmlDoc("Table of Contents", `<h1>Table of Contents</h1>${tocLinks}`);

  const navListItems = [
    `<li><a href="title.xhtml">Title</a></li>`,
    `<li><a href="toc.xhtml">Table of Contents</a></li>`,
    ...chapters.map((ch, i) => `<li><a href="chap${i + 1}.xhtml">Chapter ${ch.chapterNumber}: ${esc(ch.title)}</a></li>`),
  ].join("\n      ");
  const navDoc = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head><meta charset="utf-8"/><title>Navigation</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${navListItems}
    </ol>
  </nav>
</body>
</html>`;

  const chapterDocs = chapters.map((ch, i) =>
    xhtmlDoc(
      ch.title,
      `<p class="chapter-num">Chapter ${ch.chapterNumber}</p><h2 class="chapter-title">${esc(ch.title)}</h2>${paragraphsToHtml(ch.content || "")}`,
    ),
  );

  const manifestItems = [
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapters.map((_, i) => `<item id="chap${i + 1}" href="chap${i + 1}.xhtml" media-type="application/xhtml+xml"/>`),
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ].join("\n    ");

  const spineItems = [
    `<itemref idref="title"/>`,
    `<itemref idref="toc"/>`,
    ...chapters.map((_, i) => `<itemref idref="chap${i + 1}"/>`),
  ].join("\n    ");

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:creator>${esc(authorName)}</dc:creator>
    <dc:language>${language}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`;

  const navPoints = [
    `<navPoint id="np-title" playOrder="1"><navLabel><text>Title</text></navLabel><content src="title.xhtml"/></navPoint>`,
    `<navPoint id="np-toc" playOrder="2"><navLabel><text>Table of Contents</text></navLabel><content src="toc.xhtml"/></navPoint>`,
    ...chapters.map(
      (ch, i) =>
        `<navPoint id="np-chap${i + 1}" playOrder="${i + 3}"><navLabel><text>Chapter ${ch.chapterNumber}: ${esc(ch.title)}</text></navLabel><content src="chap${i + 1}.xhtml"/></navPoint>`,
    ),
  ].join("\n    ");

  const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookId}"/></head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <navMap>
    ${navPoints}
  </navMap>
</ncx>`;

  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const entries: ZipEntry[] = [
    // mimetype MUST be first and stored uncompressed (store mode is used for all entries).
    { name: "mimetype", data: Buffer.from("application/epub+zip", "ascii") },
    { name: "META-INF/container.xml", data: Buffer.from(container, "utf8") },
    { name: "OEBPS/content.opf", data: Buffer.from(contentOpf, "utf8") },
    { name: "OEBPS/toc.ncx", data: Buffer.from(tocNcx, "utf8") },
    { name: "OEBPS/style.css", data: Buffer.from(css, "utf8") },
    { name: "OEBPS/nav.xhtml", data: Buffer.from(navDoc, "utf8") },
    { name: "OEBPS/title.xhtml", data: Buffer.from(titlePage, "utf8") },
    { name: "OEBPS/toc.xhtml", data: Buffer.from(tocPage, "utf8") },
    ...chapterDocs.map((doc, i) => ({ name: `OEBPS/chap${i + 1}.xhtml`, data: Buffer.from(doc, "utf8") })),
  ];

  return buildZip(entries);
}

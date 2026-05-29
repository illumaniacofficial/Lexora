// Minimal uncompressed MOBI (Mobipocket / PalmDOC database) writer.
// Produces a single-file .mobi with a PalmDB header, record 0 (PalmDOC + MOBI
// + EXTH headers), and uncompressed 4096-byte text records of HTML content.
// No images, no DRM, no compression. Renders in Kindle, Calibre, and Kindle
// Previewer. This is a best-effort spec-compliant writer (compression = none).

const RECORD_SIZE = 4096;
const PALM_EPOCH_OFFSET = 2082844800; // seconds between 1904-01-01 and 1970-01-01

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface MobiChapter {
  chapterNumber: number;
  title: string;
  content: string | null;
}

export interface MobiOptions {
  title: string;
  authorName: string;
  chapters: MobiChapter[];
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
      if (p.startsWith("- ") || p.startsWith("* ")) return `<p>&bull; ${esc(p.slice(2))}</p>`;
      if (/^(---|\*\*\*)/.test(p)) return `<hr/>`;
      return `<p>${esc(p)}</p>`;
    })
    .join("");
}

function buildHtml(opts: MobiOptions): string {
  const toc = opts.chapters
    .map((ch) => `<li><a href="#ch${ch.chapterNumber}">Chapter ${ch.chapterNumber}: ${esc(ch.title)}</a></li>`)
    .join("");

  const body = opts.chapters
    .map(
      (ch) =>
        `<mbp:pagebreak/><h2 id="ch${ch.chapterNumber}">Chapter ${ch.chapterNumber}: ${esc(ch.title)}</h2>` +
        paragraphsToHtml(ch.content || ""),
    )
    .join("");

  return (
    `<html xmlns:mbp="http://mobipocket.com/ns/mbp"><head>` +
    `<guide><reference type="toc" title="Table of Contents" filepos="0"/></guide>` +
    `</head><body>` +
    `<h1>${esc(opts.title)}</h1><p><i>by ${esc(opts.authorName)}</i></p>` +
    `<mbp:pagebreak/><h2>Table of Contents</h2><ul>${toc}</ul>` +
    body +
    `</body></html>`
  );
}

function buildExth(title: string, author: string): Buffer {
  const records: Buffer[] = [];
  const addRecord = (type: number, value: string) => {
    const data = Buffer.from(value, "utf8");
    const rec = Buffer.alloc(8 + data.length);
    rec.writeUInt32BE(type, 0);
    rec.writeUInt32BE(8 + data.length, 4);
    data.copy(rec, 8);
    records.push(rec);
  };
  addRecord(100, author); // author
  addRecord(503, title); // updated title

  const body = Buffer.concat(records);
  const unpaddedLen = 12 + body.length;
  const padding = (4 - (unpaddedLen % 4)) % 4;
  const exth = Buffer.alloc(unpaddedLen + padding);
  exth.write("EXTH", 0, "ascii");
  exth.writeUInt32BE(unpaddedLen + padding, 4); // header length (incl padding)
  exth.writeUInt32BE(records.length, 8); // record count
  body.copy(exth, 12);
  return exth;
}

export function buildMobi(opts: MobiOptions): Buffer {
  const html = buildHtml(opts);
  const textBuf = Buffer.from(html, "utf8");

  // Split text into uncompressed records.
  const textRecords: Buffer[] = [];
  for (let i = 0; i < textBuf.length; i += RECORD_SIZE) {
    textRecords.push(textBuf.subarray(i, Math.min(i + RECORD_SIZE, textBuf.length)));
  }
  if (textRecords.length === 0) textRecords.push(Buffer.alloc(0));

  const fullName = Buffer.from(opts.title, "utf8");
  const exth = buildExth(opts.title, opts.authorName);
  const uid = Math.floor(Math.random() * 0xffffffff) >>> 0;

  // ---- Record 0: PalmDOC header (16) + MOBI header (232) + EXTH + name ----
  const palmDoc = Buffer.alloc(16);
  palmDoc.writeUInt16BE(1, 0); // compression: 1 = none
  palmDoc.writeUInt16BE(0, 2); // unused
  palmDoc.writeUInt32BE(textBuf.length, 4); // uncompressed text length
  palmDoc.writeUInt16BE(textRecords.length, 8); // record count
  palmDoc.writeUInt16BE(RECORD_SIZE, 10); // record size
  palmDoc.writeUInt16BE(0, 12); // encryption: none
  palmDoc.writeUInt16BE(0, 14); // unused

  const MOBI_LEN = 232;
  const mobi = Buffer.alloc(MOBI_LEN, 0);
  mobi.write("MOBI", 0, "ascii");
  mobi.writeUInt32BE(MOBI_LEN, 4); // header length
  mobi.writeUInt32BE(2, 8); // mobi type: book
  mobi.writeUInt32BE(65001, 12); // text encoding: UTF-8
  mobi.writeUInt32BE(uid, 16); // unique id
  mobi.writeUInt32BE(6, 20); // file version
  // index fields (offsets 24..83) -> 0xFFFFFFFF (no indices)
  for (let off = 24; off <= 80; off += 4) mobi.writeUInt32BE(0xffffffff, off);
  // full name offset/length (relative to start of record 0)
  const fullNameOffset = 16 + MOBI_LEN + exth.length;
  mobi.writeUInt32BE(fullNameOffset, 84);
  mobi.writeUInt32BE(fullName.length, 88);
  mobi.writeUInt32BE(9, 92); // locale: English
  mobi.writeUInt32BE(0, 96); // input language
  mobi.writeUInt32BE(0, 100); // output language
  mobi.writeUInt32BE(6, 104); // min version
  mobi.writeUInt32BE(0xffffffff, 108); // first image index: none
  mobi.writeUInt32BE(0, 112); // huffman record offset
  mobi.writeUInt32BE(0, 116); // huffman record count
  mobi.writeUInt32BE(0, 120); // huffman table offset
  mobi.writeUInt32BE(0, 124); // huffman table length
  mobi.writeUInt32BE(0x40, 128); // EXTH flags: has EXTH
  // 132..159 unknown (0)
  mobi.writeUInt32BE(0xffffffff, 160); // DRM offset: none
  mobi.writeUInt32BE(0, 164); // DRM count
  mobi.writeUInt32BE(0, 168); // DRM size
  mobi.writeUInt32BE(0, 172); // DRM flags
  // first content record = 1, last content record = number of text records
  mobi.writeUInt16BE(1, 192); // first content record number
  mobi.writeUInt16BE(textRecords.length, 194); // last content record number

  const namePad = Buffer.alloc(2, 0); // trailing pad after name
  const record0 = Buffer.concat([palmDoc, mobi, exth, fullName, namePad]);

  // ---- Assemble Palm Database ----
  const allRecords = [record0, ...textRecords];
  const numRecords = allRecords.length;

  const PDB_HEADER = 78;
  const recordListSize = numRecords * 8;
  const gap = 2; // conventional 2-byte gap before first record
  const dataStart = PDB_HEADER + recordListSize + gap;

  const header = Buffer.alloc(PDB_HEADER);
  const nameField = Buffer.from(opts.title, "latin1").subarray(0, 31);
  nameField.copy(header, 0);
  header.writeUInt16BE(0, 32); // attributes
  header.writeUInt16BE(0, 34); // version
  const now = Math.floor(Date.now() / 1000) + PALM_EPOCH_OFFSET;
  header.writeUInt32BE(now, 36); // creation date
  header.writeUInt32BE(now, 40); // modification date
  header.writeUInt32BE(0, 44); // last backup
  header.writeUInt32BE(0, 48); // modification number
  header.writeUInt32BE(0, 52); // app info id
  header.writeUInt32BE(0, 56); // sort info id
  header.write("BOOK", 60, "ascii"); // type
  header.write("MOBI", 64, "ascii"); // creator
  header.writeUInt32BE(uid, 68); // unique id seed
  header.writeUInt32BE(0, 72); // next record list id
  header.writeUInt16BE(numRecords, 76); // number of records

  const recordList = Buffer.alloc(recordListSize);
  let offset = dataStart;
  for (let i = 0; i < numRecords; i++) {
    recordList.writeUInt32BE(offset, i * 8); // record data offset
    recordList.writeUInt8(0, i * 8 + 4); // attributes
    // unique id (3 bytes)
    recordList.writeUInt8((i >> 16) & 0xff, i * 8 + 5);
    recordList.writeUInt8((i >> 8) & 0xff, i * 8 + 6);
    recordList.writeUInt8(i & 0xff, i * 8 + 7);
    offset += allRecords[i].length;
  }

  const gapBuf = Buffer.alloc(gap, 0);
  return Buffer.concat([header, recordList, gapBuf, ...allRecords]);
}

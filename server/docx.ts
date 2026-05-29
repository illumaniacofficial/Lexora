import { buildZip, type ZipEntry } from "./zip";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface DocxChapter {
  chapterNumber: number;
  title: string;
  content: string | null;
}

export interface DocxOptions {
  title: string;
  authorName: string;
  chapters: DocxChapter[];
}

type Para = { text: string; style: "Title" | "Subtitle" | "Heading1" | "Quote" | "Bullet" | "Normal"; pageBreakBefore?: boolean };

function runProps(style: Para["style"]): string {
  switch (style) {
    case "Title":
      return `<w:rPr><w:b/><w:sz w:val="56"/></w:rPr>`;
    case "Subtitle":
      return `<w:rPr><w:i/><w:color w:val="555555"/><w:sz w:val="28"/></w:rPr>`;
    case "Heading1":
      return `<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>`;
    case "Quote":
      return `<w:rPr><w:i/><w:color w:val="555555"/></w:rPr>`;
    default:
      return "";
  }
}

function paraProps(style: Para["style"], pageBreakBefore?: boolean): string {
  const parts: string[] = [];
  if (pageBreakBefore) parts.push(`<w:pageBreakBefore/>`);
  if (style === "Title") parts.push(`<w:jc w:val="center"/><w:spacing w:before="2400" w:after="240"/>`);
  if (style === "Subtitle") parts.push(`<w:jc w:val="center"/><w:spacing w:after="480"/>`);
  if (style === "Heading1") parts.push(`<w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/>`);
  if (style === "Quote") parts.push(`<w:ind w:left="720" w:right="720"/><w:spacing w:after="160"/>`);
  if (style === "Bullet") parts.push(`<w:ind w:left="720"/>`);
  if (style === "Normal") parts.push(`<w:ind w:firstLine="360"/><w:spacing w:after="120"/>`);
  return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
}

function paragraphXml(p: Para): string {
  const rPr = runProps(p.style);
  const text = `<w:r>${rPr}<w:t xml:space="preserve">${esc(p.text)}</w:t></w:r>`;
  return `<w:p>${paraProps(p.style, p.pageBreakBefore)}${text}</w:p>`;
}

function contentToParas(content: string): Para[] {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map<Para>((p) => {
      if (p.startsWith("### ")) return { text: p.slice(4), style: "Heading1" };
      if (p.startsWith("## ")) return { text: p.slice(3), style: "Heading1" };
      if (p.startsWith("# ")) return { text: p.slice(2), style: "Heading1" };
      if (p.startsWith("> ")) return { text: p.slice(2), style: "Quote" };
      if (p.startsWith("- ") || p.startsWith("* ")) return { text: `\u2022 ${p.slice(2)}`, style: "Bullet" };
      if (/^(---|\*\*\*)/.test(p)) return { text: "* * *", style: "Quote" };
      return { text: p, style: "Normal" };
    });
}

export function buildDocx(opts: DocxOptions): Buffer {
  const paras: Para[] = [
    { text: opts.title, style: "Title" },
    { text: `by ${opts.authorName}`, style: "Subtitle" },
  ];

  for (const ch of opts.chapters) {
    paras.push({ text: `Chapter ${ch.chapterNumber}: ${ch.title}`, style: "Heading1", pageBreakBefore: true });
    paras.push(...contentToParas(ch.content || ""));
  }

  const body = paras.map(paragraphXml).join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${esc(opts.title)}</dc:title>
  <dc:creator>${esc(opts.authorName)}</dc:creator>
</cp:coreProperties>`;

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "docProps/core.xml", data: Buffer.from(core, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
  ];

  return buildZip(entries);
}

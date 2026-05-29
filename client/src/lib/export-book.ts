interface ExportChapter {
  chapterNumber: number;
  title: string;
  content?: string | null;
  status?: string;
}

interface ExportBook {
  id: number;
  title: string;
  authorName?: string | null;
  coverImageUrl?: string | null;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadBookFile(projectId: number, format: "txt" | "html" | "epub" | "docx" | "mobi") {
  const a = document.createElement("a");
  a.href = `/api/projects/${projectId}/export?format=${format}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadEditionFile(projectId: number, editionId: number, format: "txt" | "html" | "epub" | "docx" | "mobi") {
  const a = document.createElement("a");
  a.href = `/api/projects/${projectId}/editions/${editionId}/export?format=${format}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface TrimSize {
  id: string;
  label: string;
  width: number; // points (1in = 72pt)
  height: number;
}

export const TRIM_SIZES: TrimSize[] = [
  { id: "letter", label: "Letter (8.5 × 11)", width: 612, height: 792 },
  { id: "5x8", label: "Pocket (5 × 8)", width: 360, height: 576 },
  { id: "5.25x8", label: "Digest (5.25 × 8)", width: 378, height: 576 },
  { id: "5.5x8.5", label: "Trade (5.5 × 8.5)", width: 396, height: 612 },
  { id: "6x9", label: "US Trade (6 × 9)", width: 432, height: 648 },
];

export function getTrimSize(id: string): TrimSize {
  return TRIM_SIZES.find(t => t.id === id) || TRIM_SIZES[0];
}

function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export async function exportBookPdf(book: ExportBook, chapters: ExportChapter[], trimSizeId: string = "letter", printMode: boolean = false) {
  const completed = chapters.filter(c => c.status === "complete" && c.content);
  if (completed.length === 0) throw new Error("No completed chapters to export");

  const trim = getTrimSize(trimSizeId);
  // Print mode adds a 0.125in (9pt) bleed on every edge so the page can be
  // trimmed by a print-on-demand service without white slivers.
  const bleed = printMode ? 9 : 0;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [trim.width + bleed * 2, trim.height + bleed * 2] });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const isSmallTrim = pageW < 500;
  // In print mode add an inner gutter (extra 18pt) so text clears the spine.
  const gutter = printMode ? 18 : 0;
  const marginX = (isSmallTrim ? 54 : 72) + bleed + gutter;
  const marginTop = (isSmallTrim ? 54 : 72) + bleed;
  const marginBottom = (isSmallTrim ? 54 : 72) + bleed;
  const contentW = pageW - marginX * 2;
  const lineH = 16;
  const maxY = pageH - marginBottom;

  const addPageNumber = (num: number) => {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(160, 160, 160);
    doc.text(String(num), pageW / 2, pageH - 36, { align: "center" });
  };

  let pageNum = 1;

  if (book.coverImageUrl) {
    try {
      const coverDataUrl = await loadImageAsDataUrl(book.coverImageUrl);
      const imgObj = new Image();
      imgObj.src = coverDataUrl;
      await new Promise<void>((r) => { imgObj.onload = () => r(); });
      const imgAspect = imgObj.naturalWidth / imgObj.naturalHeight;
      const pageAspect = pageW / pageH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgAspect > pageAspect) {
        drawH = pageH;
        drawW = pageH * imgAspect;
        drawX = (pageW - drawW) / 2;
        drawY = 0;
      } else {
        drawW = pageW;
        drawH = pageW / imgAspect;
        drawX = 0;
        drawY = (pageH - drawH) / 2;
      }
      doc.addImage(coverDataUrl, "JPEG", drawX, drawY, drawW, drawH);
      doc.addPage();
      pageNum++;
    } catch {
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(40, 40, 40);
  const titleLines = doc.splitTextToSize(book.title, contentW);
  const titleY = pageH / 2 - (titleLines.length * 34) / 2;
  doc.text(titleLines, pageW / 2, titleY, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(16);
  doc.setTextColor(100, 100, 100);
  doc.text(`by ${book.authorName || "Unknown Author"}`, pageW / 2, titleY + titleLines.length * 34 + 20, { align: "center" });

  doc.setDrawColor(180, 160, 130);
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - 40, titleY - 20, pageW / 2 + 40, titleY - 20);
  doc.line(pageW / 2 - 40, titleY + titleLines.length * 34 + 50, pageW / 2 + 40, titleY + titleLines.length * 34 + 50);

  doc.addPage();
  pageNum++;

  const copyrightYear = new Date().getFullYear();
  const authorName = book.authorName || "the author";
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const copyrightLines = [
    `Copyright \u00A9 ${copyrightYear} ${authorName}`,
    "",
    "All rights reserved. No part of this publication may be reproduced,",
    "distributed, or transmitted in any form or by any means, including",
    "photocopying, recording, or other electronic or mechanical methods,",
    "without the prior written permission of the publisher, except in the",
    "case of brief quotations embodied in critical reviews.",
    "",
    "",
    "Published with Lexora AI Publishing Platform",
    "www.lexora.ai",
    "",
    "",
    `First Edition, ${copyrightYear}`,
  ];
  let copyrightY = pageH / 2 - (copyrightLines.length * 14) / 2;
  for (const cl of copyrightLines) {
    doc.text(cl, pageW / 2, copyrightY, { align: "center" });
    copyrightY += 14;
  }
  doc.setDrawColor(180, 160, 130);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 60, copyrightY + 20, pageW / 2 + 60, copyrightY + 20);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Powered by Lexora", pageW / 2, copyrightY + 36, { align: "center" });

  doc.addPage();
  pageNum++;
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("Table of Contents", pageW / 2, marginTop + 20, { align: "center" });

  doc.setDrawColor(180, 160, 130);
  doc.line(pageW / 2 - 50, marginTop + 32, pageW / 2 + 50, marginTop + 32);

  let tocY = marginTop + 60;
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  for (const ch of completed) {
    const label = `Chapter ${ch.chapterNumber}: ${ch.title}`;
    const lines = doc.splitTextToSize(label, contentW);
    for (const line of lines) {
      if (tocY > maxY) {
        addPageNumber(pageNum);
        doc.addPage();
        pageNum++;
        tocY = marginTop;
      }
      doc.text(line, marginX, tocY);
      tocY += 18;
    }
    tocY += 4;
  }
  addPageNumber(pageNum);

  for (const ch of completed) {
    doc.addPage();
    pageNum++;

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(160, 160, 160);
    doc.text(`Chapter ${ch.chapterNumber}`, pageW / 2, pageH / 2 - 40, { align: "center" });

    doc.setDrawColor(180, 160, 130);
    doc.line(pageW / 2 - 30, pageH / 2 - 25, pageW / 2 + 30, pageH / 2 - 25);

    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    const chTitleLines = doc.splitTextToSize(ch.title, contentW);
    doc.text(chTitleLines, pageW / 2, pageH / 2, { align: "center" });

    addPageNumber(pageNum);

    doc.addPage();
    pageNum++;
    let y = marginTop;

    const paragraphs = (ch.content || "").split(/\n+/).filter(p => p.trim());
    for (const para of paragraphs) {
      const trimmed = para.trim();
      let fontSize = 11;
      let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal";
      let indent = 24;
      let extraSpacing = 4;
      let textColor: [number, number, number] = [50, 50, 50];

      if (trimmed.startsWith("### ")) {
        fontSize = 13; fontStyle = "bold"; indent = 0; extraSpacing = 6; textColor = [40, 40, 40];
      } else if (trimmed.startsWith("## ")) {
        fontSize = 15; fontStyle = "bold"; indent = 0; extraSpacing = 8; textColor = [35, 35, 35];
      } else if (trimmed.startsWith("# ")) {
        fontSize = 18; fontStyle = "bold"; indent = 0; extraSpacing = 10; textColor = [30, 30, 30];
      } else if (trimmed.startsWith("> ")) {
        fontStyle = "italic"; textColor = [80, 80, 80]; indent = 36;
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        indent = 36;
      } else if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
        doc.setDrawColor(180, 160, 130);
        doc.line(pageW / 2 - 30, y, pageW / 2 + 30, y);
        y += 12;
        continue;
      }

      const cleanText = trimmed.replace(/^#+\s*/, "").replace(/^>\s*/, "");
      doc.setFont("times", fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(...textColor);

      const lines = doc.splitTextToSize(cleanText, contentW - indent);
      for (const line of lines) {
        if (y > maxY) {
          addPageNumber(pageNum);
          doc.addPage();
          pageNum++;
          y = marginTop;
        }
        doc.text(line, marginX + indent, y);
        y += lineH;
      }
      y += extraSpacing;
    }
    addPageNumber(pageNum);
  }

  doc.save(`${slugify(book.title)}.pdf`);
}

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

export function downloadBookFile(projectId: number, format: "txt" | "html") {
  const a = document.createElement("a");
  a.href = `/api/projects/${projectId}/export?format=${format}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
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

export async function exportBookPdf(book: ExportBook, chapters: ExportChapter[]) {
  const completed = chapters.filter(c => c.status === "complete" && c.content);
  if (completed.length === 0) throw new Error("No completed chapters to export");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 72;
  const marginTop = 72;
  const marginBottom = 72;
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

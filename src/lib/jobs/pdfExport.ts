import { jsPDF } from "jspdf";

export function downloadTextAsPdf(text: string, filename: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 5.2;
  let y = margin;

  const cleaned = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim();
  const lines = cleaned.split(/\r?\n/);

  function checkPageBreak(needed = lineHeight) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  let lineIndex = 0;

  // ── Header: name (line 0) and contact info (line 1) ──
  const nameLine = lines[lineIndex]?.trim() ?? "";
  if (nameLine) {
    checkPageBreak(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(nameLine, pageWidth / 2, y, { align: "center" });
    y += 9;
    lineIndex++;
  }

  // Skip possible blank line after name
  if (lines[lineIndex]?.trim() === "") lineIndex++;

  // Contact info line (pipe-separated), must appear before section content
  const contactLine = lines[lineIndex]?.trim() ?? "";
  if (contactLine && !contactLine.startsWith("---") && lineIndex < 5) {
    checkPageBreak(lineHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(contactLine, pageWidth / 2, y, { align: "center" });
    y += 6;
    lineIndex++;
  }

  // Divider under header
  checkPageBreak(4);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── Body ──
  doc.setFontSize(10);

  for (; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const trimmed = raw?.trim() ?? "";

    // Blank line → small gap
    if (!trimmed) {
      y += 2;
      continue;
    }

    // Horizontal rule marker "---"
    if (trimmed === "---") {
      checkPageBreak(4);
      doc.setDrawColor(60, 60, 60);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
      continue;
    }

    // Bullet point: starts with – or - or •
    if (/^[–\-•]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[–\-•]\s+/, "");
      const wrapped = doc.splitTextToSize(content, maxWidth - 6);
      for (let i = 0; i < wrapped.length; i++) {
        checkPageBreak(lineHeight);
        if (i === 0) {
          doc.setFont("helvetica", "normal");
          doc.text("•", margin, y);
        }
        doc.text(wrapped[i], margin + 5, y);
        y += lineHeight;
      }
      continue;
    }

    // Tab-separated line: "Company/Institution\tDate range"
    if (trimmed.includes("\t")) {
      const tabIdx = trimmed.indexOf("\t");
      const leftPart = trimmed.slice(0, tabIdx).trim();
      const rightPart = trimmed.slice(tabIdx + 1).trim();
      checkPageBreak(lineHeight);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(leftPart, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(rightPart, pageWidth - margin, y, { align: "right" });
      doc.setFontSize(10);
      y += lineHeight;
      continue;
    }

    // Section heading: detect by checking if the NEXT line is "---"
    const nextLine = lines[lineIndex + 1]?.trim();
    if (nextLine === "---") {
      checkPageBreak(lineHeight + 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(trimmed.toUpperCase(), margin, y);
      y += lineHeight + 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      continue;
    }

    // Plain text (role title, degree name, etc.)
    checkPageBreak(lineHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(trimmed, maxWidth);
    for (const line of wrapped) {
      checkPageBreak(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  doc.save(`${filename}.pdf`);
}

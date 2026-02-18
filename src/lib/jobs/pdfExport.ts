import { jsPDF } from "jspdf";

type PdfBlock = { type: "heading" | "bullet" | "text"; content: string };

const SECTION_HEADERS = [
  "Objective", "Education", "Experience", "Skills", "Summary",
  "Certifications", "Projects", "Qualifications", "Work Experience",
  "Professional Experience", "Technical Skills", "Relevant Experience",
];

function parseResumeBlocks(text: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const cleaned = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .trim();
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const stripped = line.replace(/\*\*/g, "").trim();
    if (!stripped) continue;

    const wasBold = line.includes("**");
    const isSectionHeader =
      wasBold ||
      SECTION_HEADERS.some((h) => stripped === h || stripped.startsWith(h + ":") || stripped.startsWith(h + " "));
    const isBullet = /^[–\-•]\s+/.test(stripped) || /^\d+\.\s+/.test(stripped);

    if (isSectionHeader && !isBullet) {
      blocks.push({ type: "heading", content: stripped.replace(/:\s*$/, "") });
      continue;
    }

    if (isBullet) {
      const content = stripped.replace(/^[–\-•]\s+/, "").replace(/^\d+\.\s+/, "");
      blocks.push({ type: "bullet", content });
      continue;
    }

    blocks.push({ type: "text", content: stripped });
  }

  return blocks;
}

export function downloadTextAsPdf(text: string, filename: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 5.5;
  const headingHeight = 8;
  const sectionGap = 4;
  const bulletIndent = 6;
  let y = margin;

  const blocks = parseResumeBlocks(text);

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  for (const block of blocks) {
    checkPageBreak(block.type === "heading" ? headingHeight + sectionGap : lineHeight * 2);

    if (block.type === "heading") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(block.content, margin, y);
      y += headingHeight + sectionGap;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      continue;
    }

    if (block.type === "bullet") {
      const lines = doc.splitTextToSize(block.content, maxWidth - bulletIndent);
      for (const line of lines) {
        checkPageBreak(lineHeight);
        doc.text("•", margin, y);
        doc.text(line, margin + bulletIndent, y);
        y += lineHeight;
      }
      y += 1;
      continue;
    }

    const lines = doc.splitTextToSize(block.content, maxWidth);
    for (const line of lines) {
      checkPageBreak(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 1;
  }

  doc.save(`${filename}.pdf`);
}

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ParsedCv } from './parseDocx.js';

export async function convertToPdf(parsedCv: ParsedCv, newSummary: string, newSkills: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Design elements
  const margin = 50;
  const pageHeight = 842; // A4 height
  const pageWidth = 595;  // A4 width
  const contentWidth = pageWidth - (margin * 2);
  
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(heightNeeded: number) {
    if (y - heightNeeded < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function wrapText(text: string, size: number, font: any, width: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const widthOfTest = font.widthOfTextAtSize(testLine, size);
      if (widthOfTest > width) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  function drawText(text: string, options: { font: any; size: number; bold?: boolean; color?: any } = { font: fontRegular, size: 9.5 }) {
    const color = options.color || rgb(0.1, 0.1, 0.1);
    const lines = wrapText(text, options.size, options.font, contentWidth);
    
    for (const line of lines) {
      ensureSpace(options.size + 4);
      currentPage.drawText(line, {
        x: margin,
        y: y,
        size: options.size,
        font: options.font,
        color: color
      });
      y -= (options.size + 4);
    }
  }

  function drawHeading(text: string) {
    y -= 12;
    ensureSpace(18);
    // Draw horizontal separator line as accent
    currentPage.drawLine({
      start: { x: margin, y: y + 10 },
      end: { x: pageWidth - margin, y: y + 10 },
      thickness: 1.5,
      color: rgb(0.18, 0.24, 0.35) // Slate accent
    });
    
    currentPage.drawText(text.toUpperCase(), {
      x: margin,
      y: y - 4,
      size: 10,
      font: fontBold,
      color: rgb(0.18, 0.24, 0.35)
    });
    y -= 22;
  }

  // 1. HEADER (Candidate Name + Contact Info)
  // Large Name
  const nameSize = 22;
  ensureSpace(nameSize + 10);
  const nameWidth = fontBold.widthOfTextAtSize(parsedCv.name, nameSize);
  currentPage.drawText(parsedCv.name, {
    x: (pageWidth - nameWidth) / 2, // Centered name
    y: y,
    size: nameSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= (nameSize + 8);

  // Contact Info row
  const contactParts = [
    parsedCv.email,
    parsedCv.phone,
    parsedCv.linkedin,
    parsedCv.address
  ].filter(Boolean);
  const contactText = contactParts.join('  |  ');
  const contactSize = 8.5;
  ensureSpace(contactSize + 10);
  const contactWidth = fontRegular.widthOfTextAtSize(contactText, contactSize);
  currentPage.drawText(contactText, {
    x: (pageWidth - contactWidth) / 2, // Centered contacts
    y: y,
    size: contactSize,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4)
  });
  y -= 20;

  // 2. PROFESSIONAL SUMMARY
  drawHeading('Professional Summary');
  drawText(newSummary, { font: fontRegular, size: 9.5 });
  y -= 8;

  // 3. CORE SKILLS
  drawHeading('Core Skills');
  drawText(newSkills.join('  •  '), { font: fontBold, size: 9.5, color: rgb(0.15, 0.15, 0.15) });
  y -= 8;

  // 4. PROFESSIONAL EXPERIENCE
  drawHeading('Professional Experience');
  const experienceLines = parsedCv.workHistory.split('\n');
  for (const line of experienceLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const isHeaderLine = trimmed.includes('|') || trimmed.includes('20') || trimmed.includes('Present') || trimmed.length < 80;
    if (isHeaderLine && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
      drawText(trimmed, { font: fontRegular, size: 9 });
    } else if (isHeaderLine) {
      drawText(trimmed, { font: fontBold, size: 9.5, color: rgb(0.1, 0.1, 0.1) });
    } else {
      drawText(trimmed, { font: fontRegular, size: 9 });
    }
  }
  y -= 8;

  // 5. EDUCATION
  drawHeading('Education');
  const educationLines = parsedCv.education.split('\n');
  for (const line of educationLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    drawText(trimmed, { font: fontRegular, size: 9 });
  }

  // 6. OTHER DETAILS if any
  if (parsedCv.other) {
    y -= 8;
    drawHeading('Other Details');
    const otherLines = parsedCv.other.split('\n');
    for (const line of otherLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      drawText(trimmed, { font: fontRegular, size: 9 });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

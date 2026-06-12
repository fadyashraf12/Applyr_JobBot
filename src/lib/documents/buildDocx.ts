import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { ParsedCv } from './parseDocx.js';

export async function buildDocx(parsedCv: ParsedCv, newSummary: string, newSkills: string[]): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header / Contact info
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: parsedCv.name,
                bold: true,
                size: 32, // 16pt
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${parsedCv.email}  |  ${parsedCv.phone}  |  ${parsedCv.linkedin}  |  ${parsedCv.address}`,
                size: 20, // 10pt
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({ text: '' }), // Spacer

          // Summary Section
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Professional Summary',
                bold: true,
                size: 24,
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: newSummary,
                size: 22,
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Skills Section
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Core Skills',
                bold: true,
                size: 24,
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: newSkills.join(', '),
                size: 22,
                font: 'Inter',
              }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Professional Experience
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Professional Experience',
                bold: true,
                size: 24,
                font: 'Inter',
              }),
            ],
          }),
          ...parsedCv.workHistory.split('\n').map(line => 
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 22,
                  font: 'Inter',
                }),
              ],
            })
          ),
          new Paragraph({ text: '' }),

          // Education
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Education',
                bold: true,
                size: 24,
                font: 'Inter',
              }),
            ],
          }),
          ...parsedCv.education.split('\n').map(line => 
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 22,
                  font: 'Inter',
                }),
              ],
            })
          ),
          
          // Other sections if present
          ...(parsedCv.other ? [
            new Paragraph({ text: '' }),
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text: 'Other Details',
                  bold: true,
                  size: 24,
                  font: 'Inter',
                }),
              ],
            }),
            ...parsedCv.other.split('\n').map(line => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: 22,
                    font: 'Inter',
                  }),
                ],
              })
            )
          ] : []),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

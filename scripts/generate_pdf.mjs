import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

async function generatePDF() {
  console.log('Reading deliverable1_report.md...');
  const mdPath = path.resolve('docs/deliverable1_report.md');
  let mdContent = fs.readFileSync(mdPath, 'utf8');

  // Convert relative image paths to base64 data URIs
  const imageMatches = mdContent.matchAll(/!\[(.*?)\]\((screenshots\/.*?\.png)\)/g);
  for (const match of imageMatches) {
    const fullMatch = match[0];
    const alt = match[1];
    const relPath = match[2];
    const absPath = path.resolve('docs', relPath);
    if (fs.existsSync(absPath)) {
      const b64 = fs.readFileSync(absPath).toString('base64');
      const dataUri = `data:image/png;base64,${b64}`;
      mdContent = mdContent.replace(fullMatch, `<figure class="report-figure"><img src="${dataUri}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`);
    }
  }

  // Pre-process markdown: give Answer Part headings a dedicated section class for clean page breaks
  mdContent = mdContent.replace(/# Answer Part ([A-F]):/g, '<div class="part-page-break"></div>\n\n# Answer Part $1:');

  console.log('Rendering Markdown to HTML...');
  const htmlBody = marked.parse(mdContent);

  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>CPE 334 - Deliverable 1 Engineering Report</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 22mm 18mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      margin: 0;
      padding: 0;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    /* Clean Section Page Breaks */
    .part-page-break {
      page-break-before: always;
      height: 0;
      margin: 0;
      padding: 0;
    }

    /* Headings */
    h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 6px;
      margin-top: 20pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 13pt;
      font-weight: 600;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 16pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #334155;
      margin-top: 12pt;
      margin-bottom: 5pt;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #475569;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 7pt;
      text-align: justify;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 20px;
    }
    li {
      margin-bottom: 2.5pt;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8pt;
      margin-bottom: 12pt;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5pt 7pt;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Code & Terminal */
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1.5pt 3.5pt;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      border-radius: 6px;
      padding: 9pt 11pt;
      font-size: 8pt;
      line-height: 1.45;
      overflow-x: auto;
      page-break-inside: avoid;
      margin-top: 6pt;
      margin-bottom: 10pt;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    /* Blockquotes (Code Review) */
    blockquote {
      border-left: 4px solid #2563eb;
      background-color: #f8fafc;
      color: #334155;
      padding: 6pt 12pt;
      margin: 8pt 0;
      border-radius: 0 4px 4px 0;
      font-style: italic;
      page-break-inside: avoid;
    }
    blockquote p {
      margin-bottom: 0;
    }

    /* Figures & Screenshots */
    .report-figure {
      margin: 12pt 0;
      padding: 6pt;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background-color: #ffffff;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .report-figure img {
      max-width: 98%;
      height: auto;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
      display: inline-block;
    }
    .report-figure figcaption {
      margin-top: 6pt;
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
    }

    hr {
      height: 1px;
      background-color: #e2e8f0;
      border: none;
      margin: 14pt 0;
    }

    /* Title Block Header */
    .university-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12pt;
      margin-bottom: 18pt;
    }
    .university-header .sub-title {
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 2pt;
    }
    .university-header .main-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      margin: 4pt 0 10pt 0;
      line-height: 1.25;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10pt;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10pt 14pt;
      margin-top: 10pt;
      font-size: 9pt;
    }
    .meta-grid strong {
      color: #0f172a;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
`;

  const outputPath = path.resolve('docs/deliverable1_report.pdf');
  console.log('Launching Chrome to generate polished PDF...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '16mm',
      right: '16mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8pt; font-family:-apple-system, sans-serif; color:#64748b; width:100%; text-align:right; padding-right:16mm; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">CPE 334 — Project Deliverable 1: QuickOrder</div>',
    footerTemplate: '<div style="font-size:8pt; font-family:-apple-system, sans-serif; color:#64748b; width:100%; display:flex; justify-content:space-between; padding:0 16mm; border-top:1px solid #e2e8f0; padding-top:3px;"><span>Department of Computer Engineering, KMUTT</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
  });

  await browser.close();
  console.log(`Successfully generated polished PDF: ${outputPath}`);
}

generatePDF().catch(err => {
  console.error('PDF Generation Error:', err);
  process.exit(1);
});

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
      mdContent = mdContent.replace(fullMatch, `![${alt}](${dataUri})`);
    }
  }

  console.log('Rendering Markdown to HTML...');
  const htmlBody = marked.parse(mdContent);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CPE 334 - Deliverable 1 Report</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #24292f;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18pt;
      border-bottom: 2px solid #0969da;
      padding-bottom: 6px;
      margin-top: 24pt;
      margin-bottom: 12pt;
      color: #1f2328;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      border-bottom: 1px solid #d0d7de;
      padding-bottom: 4px;
      margin-top: 18pt;
      margin-bottom: 8pt;
      color: #1f2328;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      margin-top: 14pt;
      margin-bottom: 6pt;
      color: #1f2328;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10.5pt;
      margin-top: 10pt;
      margin-bottom: 4pt;
      color: #1f2328;
      page-break-after: avoid;
    }
    p, ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    ul, ol {
      padding-left: 20px;
    }
    li {
      margin-bottom: 3pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8pt;
      margin-bottom: 12pt;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d0d7de;
      padding: 5pt 7pt;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #fcfcfc;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 8.5pt;
      background-color: rgba(175, 184, 193, 0.2);
      padding: 1.5pt 3pt;
      border-radius: 3px;
    }
    pre {
      background-color: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 5px;
      padding: 8pt 10pt;
      font-size: 8pt;
      line-height: 1.4;
      overflow-x: auto;
      page-break-inside: avoid;
      margin-top: 6pt;
      margin-bottom: 10pt;
    }
    pre code {
      background: none;
      padding: 0;
      font-size: inherit;
    }
    blockquote {
      border-left: 4px solid #0969da;
      color: #57606a;
      padding: 4pt 10pt;
      margin: 8pt 0;
      background-color: #f6f8fa;
      page-break-inside: avoid;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 1px solid #d0d7de;
      border-radius: 4px;
      margin-top: 6pt;
      margin-bottom: 10pt;
      display: block;
      page-break-inside: avoid;
    }
    hr {
      height: 1px;
      background-color: #d0d7de;
      border: none;
      margin: 16pt 0;
    }
    .header-banner {
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-left: 4px solid #0969da;
      padding: 8pt 12pt;
      margin-bottom: 14pt;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
`;

  const outputPath = path.resolve('docs/deliverable1_report.pdf');
  console.log('Launching Chrome to generate PDF...');
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
    headerTemplate: '<div style="font-size:8pt; font-family:sans-serif; color:#656d76; width:100%; text-align:right; padding-right:16mm;">CPE 334 — Deliverable 1 (QuickOrder)</div>',
    footerTemplate: '<div style="font-size:8pt; font-family:sans-serif; color:#656d76; width:100%; text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
  });

  await browser.close();
  console.log(`Successfully generated PDF: ${outputPath}`);
}

generatePDF().catch(err => {
  console.error('PDF Generation Error:', err);
  process.exit(1);
});


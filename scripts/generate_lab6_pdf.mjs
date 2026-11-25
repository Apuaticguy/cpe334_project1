import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function renderPdf(inputMdPath, outputPdfPath, title) {
  console.log(`Reading ${inputMdPath}...`);
  if (!fs.existsSync(inputMdPath)) {
    throw new Error(`File not found: ${inputMdPath}`);
  }
  let mdContent = fs.readFileSync(inputMdPath, 'utf8');

  // Convert image references (screenshots/*.png or screenshots/*.jpg) to base64 Data URIs
  const imageRegex = /!\[(.*?)\]\((screenshots\/.*?\.(png|jpg|jpeg))\)/gi;
  mdContent = mdContent.replace(imageRegex, (match, alt, relPath, ext) => {
    const absPath = path.resolve(path.dirname(inputMdPath), relPath);
    if (fs.existsSync(absPath)) {
      const b64 = fs.readFileSync(absPath).toString('base64');
      const mime = ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${b64}`;
      return `<figure class="report-figure"><img src="${dataUri}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`;
    } else {
      console.warn(`Warning: Image not found at ${absPath}`);
      return match;
    }
  });

  mdContent = mdContent.replace(/<div class="part-page-break"><\/div>/g, '<div style="page-break-before: always; height: 1px; margin: 0; padding: 0;"></div>');

  console.log('Rendering Markdown to HTML...');
  const htmlBody = marked.parse(mdContent);

  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.5;
      color: #1e293b;
      margin: 0;
      padding: 0;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    h1 {
      font-size: 15pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 5px;
      margin-top: 18pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 12pt;
      font-weight: 600;
      color: #1e293b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin-top: 14pt;
      margin-bottom: 7pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 11pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 6pt;
      text-align: justify;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 7pt;
      padding-left: 18px;
    }
    li {
      margin-bottom: 2pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6pt;
      margin-bottom: 10pt;
      font-size: 8.2pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4.5pt 6pt;
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

    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 8.2pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1pt 3pt;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      border-radius: 5px;
      padding: 8pt 10pt;
      font-size: 7.8pt;
      line-height: 1.4;
      overflow-x: auto;
      page-break-inside: avoid;
      margin-top: 5pt;
      margin-bottom: 9pt;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    blockquote {
      border-left: 3.5px solid #2563eb;
      background-color: #f8fafc;
      color: #334155;
      padding: 5pt 10pt;
      margin: 6pt 0;
      border-radius: 0 4px 4px 0;
      font-style: italic;
      page-break-inside: avoid;
    }

    .report-figure {
      margin: 10pt 0;
      padding: 5pt;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background-color: #ffffff;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .report-figure img {
      max-width: 96%;
      max-height: 380px;
      height: auto;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
      display: inline-block;
    }
    .report-figure figcaption {
      margin-top: 4pt;
      font-size: 8pt;
      font-weight: 600;
      color: #475569;
    }

    .university-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8pt;
      margin-bottom: 12pt;
    }
    .university-header .sub-title {
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 2pt;
    }
    .university-header .main-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 4pt 0 8pt 0;
      line-height: 1.2;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8pt;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 8pt 12pt;
      margin-top: 8pt;
      margin-bottom: 10pt;
      font-size: 8.5pt;
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

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  let executablePath = chromePaths.find(p => fs.existsSync(p));
  if (!executablePath) {
    throw new Error('Could not find Google Chrome executable on system.');
  }

  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup-lab6-'));
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir: tempUserDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '15mm',
      right: '15mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:7.5pt; font-family:-apple-system, sans-serif; color:#64748b; width:100%; text-align:right; padding-right:15mm; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">${title}</div>`,
    footerTemplate: '<div style="font-size:7.5pt; font-family:-apple-system, sans-serif; color:#64748b; width:100%; display:flex; justify-content:space-between; padding:0 15mm; border-top:1px solid #e2e8f0; padding-top:3px;"><span>Department of Computer Engineering, KMUTT</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
  });

  await browser.close();
  try {
    fs.rmSync(tempUserDataDir, { recursive: true, force: true });
  } catch (e) {}
  console.log(`Successfully generated PDF: ${outputPdfPath}`);
}

async function main() {
  // 1. Compile full comprehensive Lab 6 Report
  await renderPdf(
    path.resolve(projectRoot, 'docs/labs/lab-06/lab6_report.md'),
    path.resolve(projectRoot, 'docs/labs/lab-06/lab6_report.pdf'),
    'CPE 334 — Lab 6: Independent UAT and Defect Management (QuickOrder & TutorHub)'
  );

  // 2. Compile standalone Signed UAT Acceptance for TutorHub Team
  await renderPdf(
    path.resolve(projectRoot, 'docs/labs/lab-06/TutorHub_UAT_Execution_Log_and_Signed_Acceptance.md'),
    path.resolve(projectRoot, 'docs/labs/lab-06/TutorHub_UAT_Execution_Log_and_Signed_Acceptance.pdf'),
    'CPE 334 Lab 6 — TutorHub UAT Execution Log & Acceptance Sign-Off'
  );
}

main().catch(err => {
  console.error('PDF Generation Error:', err);
  process.exit(1);
});

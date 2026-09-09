const fs = require('fs');
const path = require('path');

/**
 * LHCI's filesystem upload target writes a fresh timestamped HTML/JSON
 * pair per run with no stable "latest" filename, and never prunes old
 * ones - left alone this folder grows forever. This script:
 *   1. Reads manifest.json to find each URL's representative (median)
 *      run - the one that matters, out of numberOfRuns per URL.
 *   2. Writes each one to a fixed <slug>-report-latest.html, same pattern
 *      as the k6 scripts' `*-report-latest.html` convention.
 *   3. Deletes every raw timestamped .report.html/.report.json and
 *      manifest.json, so only the latest files remain on disk - no
 *      accumulating history to manage.
 */
const REPORTS_DIR = path.join(__dirname, 'reports');
const manifestPath = path.join(REPORTS_DIR, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest.json found at ${manifestPath} - did lhci autorun run first?`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function slugFromUrl(urlStr) {
  const { pathname } = new URL(urlStr);
  return pathname.replace(/^\/(en|ar)\//, '').replace(/\//g, '-') || 'home';
}

const representativeRuns = manifest.filter((run) => run.isRepresentativeRun);
const latestPerUrl = new Map();
for (const run of representativeRuns) {
  latestPerUrl.set(run.url, run); // manifest is append-only across runs; last write wins = most recent run
}

if (latestPerUrl.size === 0) {
  console.error('No representative runs found in manifest.json.');
  process.exit(1);
}

// Read every representative run's HTML into memory before touching the
// filesystem, since the raw files get deleted right after.
const latestReports = [...latestPerUrl].map(([url, run]) => ({
  url,
  slug: slugFromUrl(url),
  html: fs.readFileSync(run.htmlPath, 'utf8'),
  performance: run.summary.performance,
}));

for (const entry of fs.readdirSync(REPORTS_DIR)) {
  if (entry.endsWith('.report.html') || entry.endsWith('.report.json') || entry === 'manifest.json') {
    fs.unlinkSync(path.join(REPORTS_DIR, entry));
  }
}

for (const { url, slug, html, performance } of latestReports) {
  const destPath = path.join(REPORTS_DIR, `${slug}-report-latest.html`);
  fs.writeFileSync(destPath, html);
  console.log(`${url} -> ${path.relative(process.cwd(), destPath)} (performance: ${performance})`);
}

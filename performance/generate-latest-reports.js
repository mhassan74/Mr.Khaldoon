const fs = require('fs');
const path = require('path');

/**
 * LHCI's filesystem upload target only writes a new timestamped HTML/JSON
 * pair per run (see reports/lighthouse/) - there's no stable "latest"
 * filename like the k6 scripts' `*-report-latest.html` convention, so
 * opening "the report" means hunting for the newest timestamp every time.
 * This copies each URL's representative run (the median of numberOfRuns,
 * per manifest.json's isRepresentativeRun flag) to a fixed filename here
 * in performance/, overwritten every run - same pattern as k6.
 */
const REPORTS_DIR = path.join(__dirname, 'reports', 'lighthouse');
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

for (const [url, run] of latestPerUrl) {
  const slug = slugFromUrl(url);
  const destPath = path.join(__dirname, `${slug}-report-latest.html`);
  fs.copyFileSync(run.htmlPath, destPath);
  console.log(`${url} -> ${path.relative(process.cwd(), destPath)} (performance: ${run.summary.performance})`);
}

import fs from 'node:fs';
import http from 'node:http';

const root = new URL('.', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const css = fs.readFileSync(new URL('styles.css', root), 'utf8');
const js = fs.readFileSync(new URL('app.js', root), 'utf8');
const required = ['#approach', '#services', '#selected-work', '#ideas', '#work-with-zoey', 'og:title', 'canonical', 'zoey-vincent-socialmediamanager', '_zoey.vincent'];
const forbidden = ['lorem ipsum', 'ai generated', 'made by aureum', 'website sample', '80k+', '1,300+', '$100,000'];
const failures = [];
for (const value of required) if (!html.toLowerCase().includes(value.toLowerCase())) failures.push(`Missing required content: ${value}`);
for (const value of forbidden) if (html.toLowerCase().includes(value.toLowerCase())) failures.push(`Forbidden or unreviewed content present: ${value}`);
for (const asset of ['styles.css', 'app.js', 'public/favicon.svg', 'public/robots.txt']) {
  if (!fs.existsSync(new URL(asset, root))) failures.push(`Missing asset: ${asset}`);
}
if (!css.includes('prefers-reduced-motion')) failures.push('Reduced-motion support missing');
if (!js.includes('prospect_id') || !js.includes('CAP-001')) failures.push('CAP analytics identifiers missing');
const result = { passed: failures.length === 0, failures, html_bytes: html.length, css_bytes: css.length, js_bytes: js.length };
if (process.argv.includes('--http')) {
  const req = http.get('http://127.0.0.1:8790/index.html', (res) => {
    if (res.statusCode !== 200) failures.push(`HTTP status ${res.statusCode}`);
    console.log(JSON.stringify({...result, http_status: res.statusCode}, null, 2));
    process.exit(failures.length ? 1 : 0);
  });
  req.on('error', (error) => { console.error(error.message); process.exit(1); });
} else {
  console.log(JSON.stringify(result, null, 2));
  process.exit(failures.length ? 1 : 0);
}

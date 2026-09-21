import fs from 'node:fs';
import http from 'node:http';

const root = new URL('.', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const css = fs.readFileSync(new URL('styles.css', root), 'utf8');
const focusCss = fs.readFileSync(new URL('focus.css', root), 'utf8');
const js = fs.readFileSync(new URL('app.js', root), 'utf8');
const checks = [];
const check = (name, passed, detail='') => checks.push({name, passed, detail});
check('HTML document language', /<html lang="en">/.test(html));
check('Semantic main and footer', /<main>/.test(html) && /<footer/.test(html));
check('Unique page title', /<title>Zoey Vincent — Brand Strategist<\/title>/.test(html));
check('Meta description', /name="description"/.test(html));
check('Canonical metadata', /rel="canonical"/.test(html));
check('Open Graph metadata', /property="og:title"/.test(html) && /property="og:description"/.test(html));
check('Twitter metadata', /name="twitter:card"/.test(html));
check('Required sections', ['approach','services','selected-work','ideas','work-with-zoey'].every(id => html.includes(`id="${id}"`)));
check('Verified social links', html.includes('linkedin.com/in/zoey-vincent-socialmediamanager') && html.includes('instagram.com/_zoey.vincent'));
check('No visible fabrication markers', !/lorem ipsum|ai generated|made by aureum|website sample|template/i.test(html));
check('No unreviewed numeric proof', !/1,300\+|\$100,000|80K\+|76K\+/i.test(html));
check('No image tag without alt', !/<img(?![^>]*alt=)[^>]*>/i.test(html));
check('Keyboard-focus styling', /:focus-visible/.test(`${css}${focusCss}`));
check('Reduced motion', /prefers-reduced-motion/.test(css));
check('Responsive breakpoint', /@media\(max-width:800px\)/.test(css));
check('Dynamic copyright year', /getFullYear/.test(js));
check('CAP event identifiers', /prospect_id.*CAP-001/.test(js) && /demo_id/.test(js) && /campaign_id/.test(js));
check('No provider credentials', !/(TWILIO_AUTH_TOKEN|AWS_SECRET|CAP_ADMIN_PASSWORD|OPENAI_API_KEY)/i.test(`${html}${css}${js}`));
const externalLinks = [...html.matchAll(/href="(https?:\/\/[^\"]+)"/g)].map(match => match[1]);
check('External links use HTTPS', externalLinks.every(url => url.startsWith('https://')));
const failed = checks.filter(item => !item.passed);
const result = {passed: failed.length === 0, checks, external_links: externalLinks.length};
if (process.argv.includes('--http')) {
  http.get('http://127.0.0.1:8790/index.html', response => {
    check('Local HTTP response', response.statusCode === 200, `status ${response.statusCode}`);
    const finalFailed = checks.filter(item => !item.passed);
    console.log(JSON.stringify({...result, passed: finalFailed.length === 0, checks}, null, 2));
    process.exit(finalFailed.length ? 1 : 0);
  }).on('error', error => { console.error(error.message); process.exit(1); });
} else {
  console.log(JSON.stringify(result, null, 2));
  process.exit(failed.length ? 1 : 0);
}

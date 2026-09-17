const root = document.documentElement;
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuToggle?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(Boolean(open)));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
document.querySelectorAll('.nav a').forEach((link) => link.addEventListener('click', () => {
  nav?.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}));

const themeToggle = document.querySelector('.theme-toggle');
const storedTheme = localStorage.getItem('zoey-theme');
const setTheme = (theme) => {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  themeToggle?.setAttribute('aria-pressed', String(dark));
  themeToggle?.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  const label = themeToggle?.querySelector('.theme-label');
  if (label) label.textContent = dark ? 'Light' : 'Dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14111f' : '#f8f7fb');
};
setTheme(storedTheme === 'dark' ? 'dark' : 'light');
themeToggle?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem('zoey-theme', next);
  track('theme_toggle', { theme: next });
});

const sessionId = crypto.randomUUID?.() || `cap001-${Date.now()}`;
const seen = new Set();
function track(eventName, detail = {}) {
  if (seen.has(`${eventName}:${detail.href || ''}`) && eventName !== 'page_view') return;
  seen.add(`${eventName}:${detail.href || ''}`);
  const event = { prospect_id: 'CAP-001', demo_id: 'zoey-vincent-personal-brand-hq', campaign_id: 'CAP-001', event: eventName, timestamp: new Date().toISOString(), session_id: sessionId, ...detail };
  window.__CAP_EVENTS__ = [...(window.__CAP_EVENTS__ || []), event];
}
track('demo_visit');
track('page_view', { path: window.location.pathname });
track('session_start');

document.querySelectorAll('[data-track]').forEach((element) => element.addEventListener('click', () => track(element.dataset.track, { href: element.getAttribute('href') || undefined })));

const revealObserver = new IntersectionObserver((entries) => entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
  entry.target.classList.add('is-visible');
  if (entry.target.id) track(`${entry.target.id}_view`);
}), { threshold: 0.2 });
document.querySelectorAll('main section[id], .clay-card, .service-item, .work-card').forEach((element) => revealObserver.observe(element));

const scrollSlider = (id, direction) => {
  const slider = document.getElementById(id);
  if (!slider) return;
  const amount = Math.max(slider.clientWidth * 0.82, 280);
  slider.scrollBy({ left: direction === 'next' ? amount : -amount, behavior: 'smooth' });
  track('slider_interaction', { slider: id, direction });
};
document.querySelectorAll('[data-slider]').forEach((button) => button.addEventListener('click', () => scrollSlider(button.dataset.slider, button.dataset.direction)));

const ideasSlider = document.querySelector('#ideas-slider');
const ideaDots = [...document.querySelectorAll('.slider-dots i')];
ideasSlider?.addEventListener('scroll', () => {
  if (!ideaDots.length) return;
  const step = Math.max(ideasSlider.scrollWidth / ideaDots.length, 1);
  const active = Math.min(ideaDots.length - 1, Math.round(ideasSlider.scrollLeft / step));
  ideaDots.forEach((dot, index) => dot.classList.toggle('is-active', index === active));
}, { passive: true });

let startX = 0;
document.querySelectorAll('.snap-slider').forEach((slider) => {
  slider.addEventListener('pointerdown', (event) => { startX = event.clientX; slider.setPointerCapture?.(event.pointerId); });
  slider.addEventListener('pointerup', (event) => {
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 45) scrollSlider(slider.id, distance < 0 ? 'next' : 'prev');
  });
});

document.querySelectorAll('.magnetic').forEach((button) => {
  button.addEventListener('pointermove', (event) => {
    const box = button.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2) * 0.08;
    const y = (event.clientY - box.top - box.height / 2) * 0.08;
    button.style.transform = `translate(${x}px, ${y}px)`;
  });
  button.addEventListener('pointerleave', () => { button.style.transform = ''; });
});

const startedAt = Date.now();
window.addEventListener('pagehide', () => track('session_duration', { duration_ms: Date.now() - startedAt }));

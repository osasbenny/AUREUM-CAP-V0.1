const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuToggle?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(Boolean(open)));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', () => {
    nav?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
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

document.querySelectorAll('[data-track]').forEach((element) => {
  element.addEventListener('click', () => track(element.dataset.track, { href: element.getAttribute('href') || undefined }));
});

const sections = document.querySelectorAll('main section[id]');
const observer = new IntersectionObserver((entries) => {
  entries.filter((entry) => entry.isIntersecting).forEach((entry) => track(`${entry.target.id}_view`));
}, { threshold: 0.35 });
sections.forEach((section) => observer.observe(section));

(() => {
  'use strict';
  document.documentElement.classList.add('js');

  // Copy buttons for terminals and prompts.
  document.querySelectorAll('.copy').forEach((button) => {
    button.addEventListener('click', async () => {
      const box = button.closest('[data-copy-source]');
      const source = box.querySelector('pre code, p');
      const text = source.textContent.trim();
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {
        const area = document.createElement('textarea');
        area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.append(area); area.select();
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        area.remove();
      }
      button.textContent = ok ? 'Copied' : 'Select & copy';
      button.classList.toggle('done', ok);
      setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('done'); }, 1800);
    });
  });

  // Reveal sections as they scroll into view.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add('in'));

  // Route rail: highlight the current stop and show progress.
  const links = [...document.querySelectorAll('.rail-list a')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const bar = document.getElementById('rail-progress-bar');
  const onScroll = () => {
    let current = 0;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
    links.forEach((a, i) => { a.classList.toggle('active', i === current); if (i === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    const guide = document.getElementById('guide');
    const rect = guide.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - rect.top) / rect.height));
    if (bar) bar.style.width = `${Math.round(ratio * 100)}%`;
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Demo 1 output tabs (keyboard: arrow keys).
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });

  // Demo 2 playground: starter behaviour vs. reference behaviour with a filter.
  const list = document.getElementById('play-list');
  if (list) {
    const form = document.getElementById('play-add');
    const goal = document.getElementById('play-goal');
    const filterBox = document.getElementById('play-filter');
    const query = document.getElementById('play-query');
    const status = document.getElementById('play-status');
    const note = document.getElementById('play-note');
    const modes = [...document.querySelectorAll('.segmented button')];
    const initial = ['Learn Git basics', 'Write a clear README', 'Review a pull request'];
    let mode = 'starter';

    const render = (items) => {
      list.replaceChildren(...items.map((text) => { const li = document.createElement('li'); li.textContent = text; return li; }));
    };
    const applyFilter = () => {
      if (mode !== 'reference') { [...list.children].forEach((li) => { li.hidden = false; }); return; }
      const q = query.value.trim().toLowerCase();
      let shown = 0;
      [...list.children].forEach((li) => { li.hidden = !li.textContent.toLowerCase().includes(q); if (!li.hidden) shown++; });
      status.textContent = q ? (shown ? `${shown} matching goal${shown === 1 ? '' : 's'}` : 'No matching goals') : '';
    };
    const setMode = (next) => {
      mode = next;
      modes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      filterBox.hidden = mode !== 'reference';
      note.textContent = mode === 'reference'
        ? 'Reference behaviour, hand-written for comparison. Your Copilot result may look different.'
        : 'The starter you will give to Copilot.';
      query.value = '';
      status.textContent = '';
      applyFilter();
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = goal.value.trim();
      if (!value) { status.textContent = 'Enter a goal first.'; return; }
      const li = document.createElement('li');
      li.textContent = value;
      list.append(li);
      goal.value = '';
      status.textContent = 'Goal added.';
      applyFilter();
      goal.focus();
    });
    query.addEventListener('input', applyFilter);
    modes.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    render(initial);
    setMode('starter');
  }

  // Review checklist progress.
  const checks = [...document.querySelectorAll('#review-list input')];
  const progress = document.getElementById('review-progress');
  const update = () => {
    const done = checks.filter((c) => c.checked).length;
    progress.textContent = done === checks.length ? 'All 5 checked — you own this change.' : `${done} of ${checks.length} checked`;
  };
  checks.forEach((c) => c.addEventListener('change', update));
})();

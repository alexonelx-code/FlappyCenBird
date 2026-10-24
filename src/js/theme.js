(() => {
  'use strict';

  const STORAGE_KEY = 'cengames_theme_v1';
  const THEMES = ['dark', 'light'];
  const TRANSITION_MS = 460;
  let theme = 'dark';
  let transitionTimer = 0;

  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(savedTheme)) theme = savedTheme;
  } catch (error) {
    // El tema oscuro queda disponible aunque el navegador bloquee el almacenamiento.
  }

  function applyTheme(animate = false) {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.clearTimeout(transitionTimer);

    if (animate && !reduceMotion) {
      root.classList.add('theme-transitioning');
      transitionTimer = window.setTimeout(() => root.classList.remove('theme-transitioning'), TRANSITION_MS);
    } else {
      root.classList.remove('theme-transitioning');
    }

    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'light' ? 'only light' : 'dark';
    const color = theme === 'light' ? '#f3f7f5' : '#0b1b22';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }

  function setTheme(nextTheme) {
    if (!THEMES.includes(nextTheme)) return theme;
    if (theme === nextTheme) return theme;
    theme = nextTheme;
    applyTheme(true);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (error) {}
    window.dispatchEvent(new CustomEvent('cengames:theme', { detail: { theme } }));
    return theme;
  }

  applyTheme();

  window.CenTheme = Object.freeze({
    getTheme() { return theme; },
    setTheme,
    toggle() { return setTheme(theme === 'dark' ? 'light' : 'dark'); }
  });
})();

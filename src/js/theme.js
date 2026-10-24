(() => {
  'use strict';

  const STORAGE_KEY = 'cengames_theme_v1';
  const THEMES = ['dark', 'light'];
  let theme = 'dark';

  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(savedTheme)) theme = savedTheme;
  } catch (error) {
    // El tema oscuro queda disponible aunque el navegador bloquee el almacenamiento.
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const color = theme === 'light' ? '#f3f7f5' : '#0b1b22';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }

  function setTheme(nextTheme) {
    if (!THEMES.includes(nextTheme)) return theme;
    theme = nextTheme;
    applyTheme();
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

/**
 * theme.js
 *
 * Manages dark/light theme switching for the Kvanta IDE.
 * Persists the user's preference to localStorage and respects OS preference
 * on first visit.
 */

const STORAGE_KEY = 'kvanta-theme';
const THEMES = ['dark', 'light'];

let currentTheme = 'dark';
let onThemeChangeCallback = null;

// SVG icons for the theme toggle button
const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/>
  <line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/>
  <line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

/**
 * Initialize the theme system.
 * Reads from localStorage or falls back to OS preference.
 *
 * @param {(theme: string) => void} callback — called on every theme change
 *        (including initial load) so CodeMirror can swap its editor theme.
 */
export function initTheme(callback) {
  onThemeChangeCallback = callback;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && THEMES.includes(saved)) {
    currentTheme = saved;
  } else {
    currentTheme = window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark';
  }

  applyTheme(currentTheme);
}

/**
 * Toggle between dark and light themes.
 */
export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  localStorage.setItem(STORAGE_KEY, currentTheme);
}

/**
 * Get the current active theme name.
 * @returns {'dark'|'light'}
 */
export function getTheme() {
  return currentTheme;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateToggleIcon(theme);
  if (onThemeChangeCallback) onThemeChangeCallback(theme);
}

function updateToggleIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  // In dark mode show sun (switch to light), in light mode show moon (switch to dark)
  btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
  btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

/**
 * console-panel.js
 *
 * Manages the console output panel in the Kvanta IDE.
 * Provides an API for printing messages, displaying errors,
 * and a stub for future input support.
 */

let outputEl = null;
let inputEl = null;
let messageCount = 0;
const MAX_MESSAGES = 500;

/**
 * Initialize the console panel. Call once after DOM is ready.
 */
export function initConsole() {
  outputEl = document.getElementById('consoleOutput');
  inputEl = document.getElementById('consoleInput');

  const clearBtn = document.getElementById('consoleClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearConsole);
  }
}

/**
 * Append a print message to the console.
 * @param {string} text
 */
export function consolePrint(text) {
  appendMessage(text, 'print');
}

/**
 * Append an error message to the console.
 * @param {string} text
 */
export function consoleError(text) {
  appendMessage(text, 'error');
}

/**
 * Append a warning message to the console.
 * @param {string} text
 */
export function consoleWarn(text) {
  appendMessage(text, 'warn');
}

/**
 * Clear all messages from the console.
 */
export function clearConsole() {
  if (outputEl) {
    outputEl.innerHTML = '';
    messageCount = 0;
  }
}

function appendMessage(text, type = 'print') {
  if (!outputEl) return;

  // Cap message count to prevent DOM bloat in long-running animations
  if (messageCount >= MAX_MESSAGES) {
    const first = outputEl.firstChild;
    if (first) outputEl.removeChild(first);
  } else {
    messageCount++;
  }

  const line = document.createElement('div');
  line.className = `console-msg console-msg--${type}`;

  if (type === 'error') {
    const prefix = document.createElement('span');
    prefix.className = 'console-msg__prefix';
    prefix.textContent = 'Error: ';
    line.appendChild(prefix);
  } else if (type === 'warn') {
    const prefix = document.createElement('span');
    prefix.className = 'console-msg__prefix';
    prefix.textContent = 'Warning: ';
    line.appendChild(prefix);
  }

  const content = document.createTextNode(text);
  line.appendChild(content);
  outputEl.appendChild(line);

  // Auto-scroll to bottom
  outputEl.scrollTop = outputEl.scrollHeight;
}

/**
 * Enable the console input field (stub — UI ready, runtime wiring later).
 * @param {string} [promptText] — placeholder text for the input
 * @param {(value: string) => void} [onSubmit] — callback when user presses Enter
 */
export function enableInput(promptText, onSubmit) {
  if (!inputEl) return;
  inputEl.disabled = false;
  inputEl.placeholder = promptText || 'Enter input...';
  inputEl.focus();

  const handler = (e) => {
    if (e.key === 'Enter') {
      const value = inputEl.value;
      inputEl.value = '';
      inputEl.disabled = true;
      inputEl.placeholder = 'Input (not connected)';
      inputEl.removeEventListener('keydown', handler);
      if (onSubmit) onSubmit(value);
    }
  };
  inputEl.addEventListener('keydown', handler);
}

/**
 * Disable the console input field.
 */
export function disableInput() {
  if (!inputEl) return;
  inputEl.disabled = true;
  inputEl.placeholder = 'Input (not connected)';
}

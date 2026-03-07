import { vi } from 'vitest';

// Populate the DOM that canvas-runtime.js queries at module load time.
const canvas = document.createElement('canvas');
canvas.id = 'canvas';
canvas.width = 1000;
canvas.height = 1000;
document.body.appendChild(canvas);

// --------------------------------------------------------------------------
// DOM elements required by web/main.js at module load time.
// --------------------------------------------------------------------------

const runBtn = document.createElement('button');
runBtn.id = 'runBtn';
document.body.appendChild(runBtn);

const editorDiv = document.createElement('div');
editorDiv.id = 'editor';
document.body.appendChild(editorDiv);

const resizer = document.createElement('div');
resizer.id = 'resizer';
document.body.appendChild(resizer);

const panesDiv = document.createElement('div');
panesDiv.className = 'panes';
document.body.appendChild(panesDiv);

const downloadBtn = document.createElement('button');
downloadBtn.id = 'downloadBtn';
document.body.appendChild(downloadBtn);

const loadBtn = document.createElement('button');
loadBtn.id = 'loadBtn';
document.body.appendChild(loadBtn);

const saveBtn = document.createElement('button');
saveBtn.id = 'saveBtn';
document.body.appendChild(saveBtn);

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.id = 'fileInput';
document.body.appendChild(fileInput);

// --------------------------------------------------------------------------
// Console panel elements (new in redesign)
// --------------------------------------------------------------------------

const consolePanel = document.createElement('div');
consolePanel.id = 'consolePanel';
document.body.appendChild(consolePanel);

const consoleOutput = document.createElement('div');
consoleOutput.id = 'consoleOutput';
document.body.appendChild(consoleOutput);

const consoleInput = document.createElement('input');
consoleInput.id = 'consoleInput';
consoleInput.type = 'text';
consoleInput.disabled = true;
document.body.appendChild(consoleInput);

const consoleClearBtn = document.createElement('button');
consoleClearBtn.id = 'consoleClearBtn';
document.body.appendChild(consoleClearBtn);

// --------------------------------------------------------------------------
// Theme toggle + vertical resizer
// --------------------------------------------------------------------------

const themeToggle = document.createElement('button');
themeToggle.id = 'themeToggle';
document.body.appendChild(themeToggle);

const vResizer = document.createElement('div');
vResizer.id = 'vResizer';
document.body.appendChild(vResizer);

const editorPane = document.createElement('div');
editorPane.className = 'editor-pane';
document.body.appendChild(editorPane);

// ResizeObserver stub – jsdom does not provide this API but CodeMirror 6
// checks for its existence when mounting an EditorView.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Range / getClientRects stubs – jsdom does not implement these but
// CodeMirror's drawSelection() extension calls getClientRects() during
// its measure phase, causing an infinite re-measure loop and OOM without them.
if (typeof Range.prototype.getClientRects === 'undefined') {
  Range.prototype.getClientRects = () => [];
}
if (typeof Range.prototype.getBoundingClientRect === 'undefined') {
  Range.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
  });
}
if (typeof Element.prototype.getClientRects === 'undefined') {
  Element.prototype.getClientRects = () => [];
}

// Mock canvas 2D context (jsdom does not implement CanvasRenderingContext2D).
const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  drawImage: vi.fn(),
  setTransform: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  lineJoin: '',
  lineCap: '',
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
};

HTMLCanvasElement.prototype.getContext = () => mockCtx;
HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
  width: 500, height: 500, top: 0, left: 0, right: 500, bottom: 500,
});

// Expose on globalThis so drawing-commands tests can inspect calls.
globalThis.__mockCtx = mockCtx;

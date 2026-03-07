/**
 * main.js
 *
 * Entry point for the Quanta web IDE.
 *
 * Responsibilities:
 *   - Create and configure the CodeMirror 6 editor with Quanta language support.
 *   - Compile Quanta source via the Rust/WASM `Compiler` on every keystroke
 *     (debounced 1 s) and on explicit Run.
 *   - Drive the canvas runtime (`canvas-runtime.js`) frame-by-frame using the
 *     block-based command stream returned by the WASM runtime.
 *   - Wire up keyboard and mouse events so the running program can react to input.
 *   - Handle file load / save and canvas image export.
 */

// Styles
import './styles.css';

// CodeMirror core
import {EditorState, EditorSelection, Compartment} from "@codemirror/state"
import {
  EditorView, keymap, highlightSpecialChars, drawSelection,
  highlightActiveLine, lineNumbers, highlightActiveLineGutter,
} from "@codemirror/view"
import {
  indentOnInput,
  bracketMatching, foldGutter, foldKeymap, indentUnit
} from "@codemirror/language"
import {
  defaultKeymap, history, historyKeymap
} from "@codemirror/commands"
import {
  autocompletion, closeBrackets,
  closeBracketsKeymap, completionKeymap
} from "@codemirror/autocomplete"
import { setDiagnostics } from "@codemirror/lint";

// Language support (Lezer parser)
import { quantaLanguageSupport } from "./quanta-support.ts";

// Editor themes
import { darkEditorTheme } from "./themes/dark-editor";
import { lightEditorTheme } from "./themes/light-editor";

// Theme manager
import { initTheme, toggleTheme, getTheme } from "./theme.js";

// Console panel
import { initConsole, consolePrint, consoleError, clearConsole } from "./console-panel.js";

// Canvas runtime
import { drawScript, setup, checkIsCancelled, cancelNow, setIsSafari, setOnPrint, setOnError } from "./canvas-runtime.js";

// WASM glue
import initWasm, { Compiler } from "../quanta-lang/pkg/quanta_lang.js";

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const runBtn = document.getElementById("runBtn");
const canvas = document.getElementById("canvas");

/** The live WASM runtime instance; `undefined` when no program is executing. */
let runtime = undefined;
/** True while a program is running (controls the Run/Stop button state). */
let isRunning = false;

// ---------------------------------------------------------------------------
// Wire console output callbacks
// ---------------------------------------------------------------------------

setOnPrint(consolePrint);
setOnError(consoleError);

// ---------------------------------------------------------------------------
// Editor configuration
// ---------------------------------------------------------------------------

const fourSpaceIndent = indentUnit.of("    ");

const insertFourSpaces = keymap.of([{
  key: "Tab",
  run: ({ state, dispatch }) => {
    dispatch(state.replaceSelection("    "));
    return true;
  }
}]);

/** Compartment for hot-swapping the font-size theme extension. */
const fontSizeCompartment = new Compartment();

/** Compartment for hot-swapping the editor color theme. */
const themeCompartment = new Compartment();

/**
 * Keymap: preserve leading indentation on Enter.
 * Extra indent after `{`, matching brace expansion for `{}`.
 */
const newlineSameIndent = keymap.of([{
  key: "Enter",
  run: (view) => {
    const { state } = view;
    const tr = state.changeByRange(range => {
      const line = state.doc.lineAt(range.head);
      let leadingWS = (line.text.match(/^[ \t]*/) || [""])[0];
      let extra = "";
      if (line.text.trimEnd().endsWith("{")) {
          if (range.head === line.to) {
          leadingWS += "    ";
        }
      }
      if (line.text.trimEnd().endsWith("{}")) {
        if (range.head === line.to - 1) {
          extra += "\n" + leadingWS;
          leadingWS += "    "
        }
      }
      const insert = "\n" + leadingWS + extra;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + leadingWS.length + 1)
      };
    });
    view.dispatch(tr, { userEvent: "input" });
    return true;
  }
}]);

// ---------------------------------------------------------------------------
// Diagnostics helpers
// ---------------------------------------------------------------------------

/**
 * Display a compiler/runtime error as a CodeMirror inline diagnostic.
 */
export function showError(editor, err) {
  let diagnostics = [];
  const from_line = editor.state.doc.line(Math.max(1, err.start_row));
  const from = Math.min(from_line.to, from_line.from + err.start_column);
  const to_line = editor.state.doc.line(Math.max(1, err.end_row));
  const to = Math.min(to_line.to, to_line.from + err.end_column);
  diagnostics.push({
    from: from,
    to: to,
    severity: "error",
    message: err.get_error_message()
  });
  editor.dispatch(setDiagnostics(editor.state, diagnostics));
}

/**
 * Log an error to the console panel with source location.
 */
export function alertError(err) {
    const msg = err.get_error_message()
        + " at " + err.start_row + ":" + err.start_column
        + " - " + err.end_row + ":" + err.end_column;
    consoleError(msg);
}

/**
 * Clear all inline diagnostics from the editor.
 */
export function showOk(editor) {
  editor.dispatch(setDiagnostics(editor.state, []));
}

// ---------------------------------------------------------------------------
// Editor initial content
// ---------------------------------------------------------------------------

const STORAGE_KEY = "quanta-editor-code";

const savedCode = localStorage.getItem(STORAGE_KEY);
const startCode = savedCode || `func mouse(int z, int y) {
    setFigureColor(Color::Red);
    rectangle(z, y, z+100, y+100);
    x = x + 10;
}

func keyboard(int key) {
    if (key == Key::Space) {
        setFigureColor(Color::Blue);
    } else {
      if (key == Key::A) {
          setFigureColor(Color::Black);
      } else {
          setFigureColor(Color::Yellow);
      }
    }
    x = x - 10;
}

global {
    int x = 320;
}

func main() {
   setLineColor(Color::Green);
   for i in (0..10000) {
      circle(x, 240, i % 100);
   }
   rectangle(0, 0, 100, 100);
}

`;

// ---------------------------------------------------------------------------
// Background compile (on typing)
// ---------------------------------------------------------------------------

async function tryCompile(editor, src) {
  await initWasm();
  let idle_compiler = Compiler.new();
  const compilation_result = await idle_compiler.compile_code(src);
   if (compilation_result.error_code != 0) {
    const err = compilation_result.get_error();
    showError(editor.view, err);
   }
}

let typingTimer = null;

const onTyping = EditorView.updateListener.of(update => {
  if (update.docChanged) {
    update.view.dispatch(setDiagnostics(update.state, []));
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      const code = update.state.doc.toString();
      tryCompile(update, code);
      localStorage.setItem(STORAGE_KEY, editor.state.doc.toString());
    }, 1000);
  }
});

// ---------------------------------------------------------------------------
// Font-size controls
// ---------------------------------------------------------------------------

export function fontSizeTheme(sizePx) {
  return EditorView.theme({
    ".cm-content": { fontSize: sizePx + "px" },
    ".cm-line":    { fontSize: sizePx + "px" },
    ".cm-gutters": { fontSize: sizePx + "px" }
  });
}

let currentFontSize = 18;

const fontSizeKeys = keymap.of([
  {
    key: "Mod-=",
    run: (view) => {
      currentFontSize += 1;
      view.dispatch({
        effects: fontSizeCompartment.reconfigure(fontSizeTheme(currentFontSize))
      });
      return true;
    }
  },
  {
    key: "Mod--",
    run: (view) => {
      currentFontSize = Math.max(8, currentFontSize - 1);
      view.dispatch({
        effects: fontSizeCompartment.reconfigure(fontSizeTheme(currentFontSize))
      });
      return true;
    }
  }
]);

// ---------------------------------------------------------------------------
// Safari detection
// ---------------------------------------------------------------------------

let itIsSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
setIsSafari(itIsSafari);

// ---------------------------------------------------------------------------
// Editor instantiation
// ---------------------------------------------------------------------------

/** Resolve the initial editor theme based on the current theme. */
function getEditorTheme(theme) {
  return theme === 'light' ? lightEditorTheme : darkEditorTheme;
}

const editor = new EditorView({
  state: EditorState.create({
    doc: startCode,
     extensions: [
    lineNumbers(),
    foldGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    themeCompartment.of(getEditorTheme(getTheme())),
    quantaLanguageSupport,
    onTyping,
    insertFourSpaces,
    fourSpaceIndent,
    newlineSameIndent,
    fontSizeCompartment.of(fontSizeTheme(currentFontSize)),
    fontSizeKeys,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
    ])
  ]
  }),
  parent: document.getElementById("editor")
});

// ---------------------------------------------------------------------------
// Theme initialization (after editor is created)
// ---------------------------------------------------------------------------

initTheme((theme) => {
  const newTheme = getEditorTheme(theme);
  editor.dispatch({
    effects: themeCompartment.reconfigure(newTheme)
  });
});

// Theme toggle button
const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// ---------------------------------------------------------------------------
// Console initialization
// ---------------------------------------------------------------------------

initConsole();

// ---------------------------------------------------------------------------
// Execution helpers
// ---------------------------------------------------------------------------

function clearErrors() {
  editor.dispatch(setDiagnostics(editor.state, []));
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function doStop() {
  (async() => {
    runtime = undefined;
    cancelNow()
  })();
}

async function startExecution() {
  let res = runtime.execute();
}

async function executeKey(key) {
  let res = runtime.execute_key(key);
}

async function executeMouse(x, y) {
  let res = runtime.execute_mouse(x, y);
}

/**
 * Compile and execute the current editor source.
 */
function doRun() {
  (async () => {
    try {
      cancelNow(false);
      clearConsole();
      isRunning = true;
      runBtn.disabled = true;
      setup();
      await initWasm();
      const src = editor.state.doc.toString();
      let compiler = Compiler.new();
      const compilation_result = await compiler.compile_code(src);
      if (compilation_result.error_code != 0) {
        const err = compilation_result.get_error();
        showError(editor, err);
        alertError(err);
        runBtn.disabled = false;
        return;
      } else {
        showOk(editor);
      }
      setRunningUI();
      runtime = compilation_result.get_runtime();
      startExecution();
      let need_continue = true;
      while(need_continue) {
        if (checkIsCancelled()) { return; }
        let blocks = runtime.get_commands();
        for (let i = 0; i < blocks.length; i++) {
          if (checkIsCancelled()) { return; }
          const block = blocks[i];
          let commands = block.get_commands();
          let blockStatus = block.get_status();
          drawScript(commands, blockStatus == 0);
          if (blockStatus == 3) { // Error
            const err = runtime.get_runtime_error();
            showError(editor, err);
            alertError(err);
            need_continue = false;
            break;
           } else if (blockStatus == 2) { // End
            need_continue = false;
            break;
           }
          await sleep(block.sleep_for);
        }
      }
    } catch (e) {
      console.error(e);
      consoleError(e?.message ?? String(e));
    } finally {
      setIdleUI();
      runBtn.disabled = false;
    }
  })();
}

// ---------------------------------------------------------------------------
// UI state helpers
// ---------------------------------------------------------------------------

function setRunningUI() {
  isRunning = true;
  runBtn.textContent = 'Stop';
  runBtn.dataset.state = 'stop';
  runBtn.disabled = false;
  canvas.focus();
}

function setIdleUI() {
  isRunning = false;
  runBtn.textContent = 'Run';
  runBtn.dataset.state = 'run';
  runBtn.disabled = false;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

runBtn.addEventListener('click', () => {
  if (!isRunning) {
    doRun();
  } else {
    doStop();
  }
});

window.addEventListener('keydown', (e) => {
  if (!runtime) return;
  if (document.activeElement !== canvas) return;
  try {
    executeKey(e.key);
  } catch (err) {
    console.warn('Keyboard runtime error:', err);
  }
});

// ---------------------------------------------------------------------------
// Pane resizer (horizontal: between editor pane and canvas pane)
// ---------------------------------------------------------------------------

const resizer = document.getElementById('resizer');
const panes = document.querySelector('.panes');
let isDragging = false;

resizer.addEventListener('mousedown', (e) => {
  isDragging = true;
  document.body.style.cursor = 'col-resize';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const totalWidth = panes.getBoundingClientRect().width;
  const leftWidth = e.clientX;
  const rightWidth = totalWidth - leftWidth - 4;
  panes.style.gridTemplateColumns = `${leftWidth}px 4px ${rightWidth}px`;
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = '';
  }
});

// ---------------------------------------------------------------------------
// Pane resizer (vertical: between editor and console)
// ---------------------------------------------------------------------------

const vResizer = document.getElementById('vResizer');
const editorPane = document.querySelector('.editor-pane');
let isVDragging = false;

if (vResizer && editorPane) {
  vResizer.addEventListener('mousedown', (e) => {
    isVDragging = true;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isVDragging) return;
    const rect = editorPane.getBoundingClientRect();
    const editorHeight = e.clientY - rect.top;
    const consoleHeight = rect.bottom - e.clientY - 4;
    if (editorHeight < 80 || consoleHeight < 80) return;
    editorPane.style.gridTemplateRows = `${editorHeight}px 4px ${consoleHeight}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isVDragging) {
      isVDragging = false;
      document.body.style.cursor = '';
    }
  });
}

// ---------------------------------------------------------------------------
// Canvas click → mouse handler
// ---------------------------------------------------------------------------

canvas.addEventListener('click', (e) => {
  if (!runtime) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * 1000;
  const y = (e.clientY - rect.top) / rect.height * 1000;

  try {
    executeMouse(x, y);
  } catch (err) {
    console.warn('Mouse runtime error:', err);
  }
});

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

export function downloadFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("downloadBtn").addEventListener("click", () => {
  const code = editor.state.doc.toString();
  let filename = prompt("Enter filename:", "program");
  if (!filename) return;
  if (!filename.endsWith(".quanta")) {
    filename += ".quanta";
  }
  downloadFile(filename, code);
});

const fileInput = document.getElementById("fileInput");

document.getElementById("loadBtn").addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const canvas = document.getElementById("canvas");
  const image = canvas.toDataURL("image/jpeg", 0.95);
  const filename = prompt("Enter painting name:", "painting");
  if (!filename) return;
  const link = document.createElement("a");
  link.href = image;
  link.download = filename + ".jpg";
  link.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: reader.result }
    });
  };
  reader.readAsText(file);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

editor.focus();

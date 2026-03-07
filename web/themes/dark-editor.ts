/**
 * dark-editor.ts
 *
 * CodeMirror dark theme for Kvanta IDE.
 * Catppuccin Mocha / Dracula-inspired color palette.
 */

import { createTheme } from 'thememirror';
import { tags as t } from '@lezer/highlight';

export const darkEditorTheme = createTheme({
  variant: 'dark',
  settings: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    caret: '#f5e0dc',
    selection: '#45475a',
    lineHighlight: '#31324433',
    gutterBackground: '#181825',
    gutterForeground: '#6c708699',
  },
  styles: [
    { tag: t.comment, color: '#6c7086' },
    { tag: t.variableName, color: '#cdd6f4' },
    { tag: [t.string, t.special(t.brace)], color: '#a6e3a1' },
    { tag: t.number, color: '#fab387' },
    { tag: t.bool, color: '#fab387' },
    { tag: t.null, color: '#89dceb' },
    { tag: t.keyword, color: '#cba6f7' },
    { tag: t.function(t.variableName), color: '#89b4fa' },
    { tag: t.paren, color: '#f9e2af' },
    { tag: t.operator, color: '#89dceb' },
    { tag: t.moduleKeyword, color: '#a6e3a1' },
    { tag: t.definition(t.typeName), color: '#f38ba8' },
    { tag: t.typeName, color: '#f9e2af' },
    { tag: t.definitionKeyword, color: '#f9e2af' },
    { tag: t.angleBracket, color: '#f9e2af' },
    { tag: t.tagName, color: '#6c7086' },
    { tag: t.attributeName, color: '#89b4fa' },
  ],
});

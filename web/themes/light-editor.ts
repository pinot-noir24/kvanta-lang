/**
 * light-editor.ts
 *
 * CodeMirror light theme for Kvanta IDE.
 * GitHub-inspired color palette.
 */

import { createTheme } from 'thememirror';
import { tags as t } from '@lezer/highlight';

export const lightEditorTheme = createTheme({
  variant: 'light',
  settings: {
    background: '#ffffff',
    foreground: '#1f2328',
    caret: '#0969da',
    selection: '#ddf4ff',
    lineHighlight: '#f6f8fa',
    gutterBackground: '#ffffff',
    gutterForeground: '#8b949e99',
  },
  styles: [
    { tag: t.comment, color: '#6e7781' },
    { tag: t.variableName, color: '#1f2328' },
    { tag: [t.string, t.special(t.brace)], color: '#0a3069' },
    { tag: t.number, color: '#0550ae' },
    { tag: t.bool, color: '#0550ae' },
    { tag: t.null, color: '#0550ae' },
    { tag: t.keyword, color: '#cf222e' },
    { tag: t.function(t.variableName), color: '#8250df' },
    { tag: t.paren, color: '#1f2328' },
    { tag: t.operator, color: '#cf222e' },
    { tag: t.moduleKeyword, color: '#116329' },
    { tag: t.definition(t.typeName), color: '#8250df' },
    { tag: t.typeName, color: '#953800' },
    { tag: t.definitionKeyword, color: '#953800' },
    { tag: t.angleBracket, color: '#1f2328' },
    { tag: t.tagName, color: '#6e7781' },
    { tag: t.attributeName, color: '#0550ae' },
  ],
});

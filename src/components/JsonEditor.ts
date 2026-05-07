import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState, StateEffect, StateField, RangeSet } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { AppStore } from '../store/AppStore';
import { EventBus } from '../store/EventBus';
import { pathToSegments } from '../services/JsonPatchService';
import { toast } from '../utils/toast';

// ===== Temporary highlight decoration =====
const addHighlight   = StateEffect.define<{ from: number; to: number }>();
const clearHighlight = StateEffect.define<null>();

const highlightField = StateField.define<DecorationSet>({
  create: () => RangeSet.empty,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(addHighlight)) {
        deco = RangeSet.of([
          Decoration.mark({ class: 'cm-sync-highlight' }).range(e.value.from, e.value.to),
        ]);
      } else if (e.is(clearHighlight)) {
        deco = RangeSet.empty;
      }
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// ===== JSON value node names from @lezer/json =====
const JSON_VALUE_NODES = new Set([
  'Object', 'Array', 'String', 'Number', 'True', 'False', 'Null',
]);

// ===== Component =====
export class JsonEditor {
  private view: EditorView;
  private isUpdatingFromStore = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          json(),
          oneDark,
          highlightField,
          EditorView.updateListener.of(update => {
            if (update.docChanged && !this.isUpdatingFromStore) {
              this.onEditorChange();
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
            '.cm-content': { padding: '8px 0' },
          }),
        ],
      }),
      parent: container,
    });

    EventBus.on('store:change', ({ origin }) => {
      if (origin !== 'editor') {
        this.setContent(AppStore.serialize());
      }
    });

    EventBus.on('node:focus', ({ path }) => {
      this.scrollToPath(path);
    });
  }

  // ===== Public API =====

  setContent(text: string): void {
    this.isUpdatingFromStore = true;
    const current = this.view.state.doc.toString();
    if (current !== text) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: text },
      });
    }
    this.isUpdatingFromStore = false;
  }

  format(): void {
    const raw = this.view.state.doc.toString();
    try {
      const formatted = JSON.stringify(JSON.parse(raw), null, 2);
      this.setContent(formatted);
      AppStore.updateFromEditor(formatted);
      toast('JSON formattato', 'success');
    } catch {
      toast('Errore: JSON non valido', 'error');
    }
  }

  focus(): void {
    this.view.focus();
  }

  /**
   * Scroll the editor to the node at the given JSON Pointer path and
   * briefly flash a highlight so the user knows exactly where they are.
   */
  scrollToPath(path: string): void {
    const range = this.findRangeForPath(path);
    if (!range) return;

    // Clear any previous highlight timer
    if (this.highlightTimer) clearTimeout(this.highlightTimer);

    this.view.dispatch({
      effects: [
        EditorView.scrollIntoView(range.from, { y: 'center' }),
        addHighlight.of(range),
      ],
    });

    this.view.focus();

    this.highlightTimer = setTimeout(() => {
      this.view.dispatch({ effects: clearHighlight.of(null) });
    }, 1800);
  }

  // ===== Private: editor change handler =====

  private onEditorChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const raw = this.view.state.doc.toString();
      try {
        AppStore.updateFromEditor(raw);
      } catch {
        // JSON non valido durante la digitazione — non aggiornare lo store
      }
    }, 350);
  }

  // ===== Private: syntax tree navigation =====

  /**
   * Walks the CodeMirror JSON syntax tree following the path segments
   * and returns the {from, to} character range of the matching node.
   */
  private findRangeForPath(path: string): { from: number; to: number } | null {
    const segments = pathToSegments(path);
    const state = this.view.state;
    const doc = state.doc.toString();
    const tree = syntaxTree(state);

    // JsonText → first child is the root Object or Array
    const root = tree.topNode.firstChild;
    if (!root) return null;

    return this.walkNode(root, segments, doc);
  }

  private walkNode(
    node: ReturnType<typeof syntaxTree>['topNode'],
    segments: string[],
    doc: string,
  ): { from: number; to: number } | null {

    // Base case: we've consumed all segments → return this node's range
    if (segments.length === 0) {
      return { from: node.from, to: node.to };
    }

    const [head, ...rest] = segments;

    if (node.name === 'Object') {
      let child = node.firstChild;
      while (child) {
        if (child.name === 'Property') {
          const propNameNode = child.firstChild;
          if (propNameNode) {
            let key: string;
            try {
              // PropertyName includes surrounding quotes → JSON.parse strips them
              key = JSON.parse(doc.slice(propNameNode.from, propNameNode.to)) as string;
            } catch {
              key = doc.slice(propNameNode.from + 1, propNameNode.to - 1);
            }

            if (key === head) {
              if (rest.length === 0) {
                // Highlight from the key up to end of property
                return { from: propNameNode.from, to: child.to };
              }
              // Recurse into the value (last child of Property that is a value node)
              const valueNode = this.getPropertyValue(child);
              if (valueNode) {
                return this.walkNode(valueNode, rest, doc);
              }
            }
          }
        }
        child = child.nextSibling;
      }
    } else if (node.name === 'Array') {
      const targetIdx = parseInt(head, 10);
      if (isNaN(targetIdx)) return null;

      let idx = 0;
      let child = node.firstChild;
      while (child) {
        if (JSON_VALUE_NODES.has(child.name)) {
          if (idx === targetIdx) {
            return this.walkNode(child, rest, doc);
          }
          idx++;
        }
        child = child.nextSibling;
      }
    }

    return null;
  }

  /**
   * Given a Property node, returns its value child
   * (the last child that is a JSON value node, not the PropertyName).
   */
  private getPropertyValue(
    prop: ReturnType<typeof syntaxTree>['topNode'],
  ): ReturnType<typeof syntaxTree>['topNode'] | null {
    // Walk children backwards to find the last value node
    let child = prop.lastChild;
    while (child) {
      if (JSON_VALUE_NODES.has(child.name)) return child;
      child = child.prevSibling;
    }
    return null;
  }
}

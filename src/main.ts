import './styles/main.css';

import { AppStore } from './store/AppStore';
import { EventBus } from './store/EventBus';
import { JsonEditor } from './components/JsonEditor';
import { TreeView } from './components/TreeView';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FileService } from './services/FileService';
import { initSplitPanes } from './components/SplitPane';
import { toast } from './utils/toast';

// ===== Bootstrap =====
function init(): void {
  // Layout
  initSplitPanes();

  // Components
  const editorContainer = document.getElementById('cm-editor')!;
  const editor = new JsonEditor(editorContainer);
  const tree = new TreeView();
  new PropertiesPanel();

  // File service
  const fileService = new FileService();
  fileService.init();

  // ===== Toolbar =====
  const btnOpen       = document.getElementById('btn-open')!;
  const btnSave       = document.getElementById('btn-save')!       as HTMLButtonElement;
  const btnFormat     = document.getElementById('btn-format')!     as HTMLButtonElement;
  const btnExpandAll  = document.getElementById('btn-expand-all')!;
  const btnCollapseAll = document.getElementById('btn-collapse-all')!;
  const filenameDisplay = document.getElementById('filename-display')!;
  const dirtyIndicator  = document.getElementById('dirty-indicator')!;
  const searchInput     = document.getElementById('search-input')! as HTMLInputElement;

  btnOpen.addEventListener('click', () => fileService.openFile());
  btnSave.addEventListener('click', () => fileService.saveFile());
  btnFormat.addEventListener('click', () => editor.format());
  btnExpandAll.addEventListener('click', () => tree.expandAll());
  btnCollapseAll.addEventListener('click', () => tree.collapseAll());

  searchInput.addEventListener('input', () => {
    EventBus.emit('search:filter', { query: searchInput.value });
  });

  // Ctrl+Shift+F → format
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      editor.format();
    }
  });

  // ===== Paste screen =====
  const pasteScreen       = document.getElementById('paste-screen')!;
  const pasteTextarea     = document.getElementById('paste-textarea')! as HTMLTextAreaElement;
  const btnLoadPaste      = document.getElementById('btn-load-paste')!;
  const btnOpenFromPaste  = document.getElementById('btn-open-from-paste')!;
  const pasteError        = document.getElementById('paste-error')!;

  function loadFromPasteBox(): void {
    const text = pasteTextarea.value.trim();
    if (!text) return;
    try {
      JSON.parse(text);
      AppStore.loadFromString(text, 'pasted.json');
      // paste screen hides via store:change handler below
    } catch {
      pasteError.classList.remove('hidden');
      pasteTextarea.classList.add('is-invalid');
    }
  }

  btnLoadPaste.addEventListener('click', loadFromPasteBox);

  btnOpenFromPaste.addEventListener('click', () => fileService.openFile());

  // Ctrl+Enter inside textarea → load
  pasteTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      loadFromPasteBox();
    }
  });

  // Auto-load on paste if JSON is valid — no button click needed
  pasteTextarea.addEventListener('paste', () => {
    setTimeout(() => {
      const text = pasteTextarea.value.trim();
      try {
        JSON.parse(text);
        AppStore.loadFromString(text, 'pasted.json');
      } catch {
        // Not valid yet — user can still click "Carica"
      }
    }, 30);
  });

  // Clear error on typing
  pasteTextarea.addEventListener('input', () => {
    pasteError.classList.add('hidden');
    pasteTextarea.classList.remove('is-invalid');
  });

  // Focus textarea when paste screen is visible
  pasteTextarea.focus();

  // ===== React to store changes =====
  EventBus.on('store:change', () => {
    const hasJson = AppStore.json !== null;

    // Show/hide paste screen
    pasteScreen.classList.toggle('hidden', hasJson);

    // Toolbar state
    btnSave.disabled   = !hasJson;
    btnFormat.disabled = !hasJson;
    filenameDisplay.textContent = hasJson ? AppStore.filename : '';
    dirtyIndicator.classList.toggle('hidden', !AppStore.isDirty);

    document.title = hasJson
      ? `${AppStore.isDirty ? '● ' : ''}${AppStore.filename} — JSON Visualizer`
      : 'JSON Visualizer';

    // Announce filename change in paste screen if needed
    if (hasJson && AppStore.filename === 'pasted.json') {
      toast('JSON caricato dagli appunti', 'success');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

import { AppStore } from '../store/AppStore';
import { toast } from '../utils/toast';

export class FileService {
  init(): void {
    this.setupDragAndDrop();
    this.setupKeyboardShortcuts();
  }

  /** Open file via file picker. */
  async openFile(): Promise<void> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(); return; }
        await this.loadFile(file);
        resolve();
      };
      input.click();
    });
  }

  /** Save current JSON to disk. */
  saveFile(): void {
    if (!AppStore.json) {
      toast('Nessun file da salvare', 'error');
      return;
    }
    const content = AppStore.serialize();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = AppStore.filename;
    a.click();
    URL.revokeObjectURL(url);
    AppStore.markClean();
    toast(`Salvato: ${AppStore.filename}`, 'success');
  }

  private async loadFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      JSON.parse(text); // Validate before loading
      AppStore.loadFromString(text, file.name);
      toast(`Caricato: ${file.name}`, 'success');
    } catch {
      toast('Errore: JSON non valido', 'error');
    }
  }

  private setupDragAndDrop(): void {
    const overlay = document.getElementById('drop-overlay')!;

    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (hasJsonFile(e)) {
        overlay.classList.remove('hidden');
      }
    });

    document.body.addEventListener('dragleave', (e) => {
      if (!e.relatedTarget || !(document.body.contains(e.relatedTarget as Node))) {
        overlay.classList.add('hidden');
      }
    });

    document.body.addEventListener('drop', async (e) => {
      e.preventDefault();
      overlay.classList.add('hidden');
      const file = e.dataTransfer?.files[0];
      if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
        await this.loadFile(file);
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'o') { e.preventDefault(); this.openFile(); }
        if (e.key === 's') { e.preventDefault(); this.saveFile(); }
      }
    });
  }
}

function hasJsonFile(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.items ?? []).some(
    item => item.kind === 'file' && (item.type === 'application/json' || item.type === '')
  );
}

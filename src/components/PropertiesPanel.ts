import { AppStore } from '../store/AppStore';
import { EventBus } from '../store/EventBus';
import { detectType, isUuidArrayKey, isUuid, typeLabel, type JsonType } from '../utils/typeDetect';
import { pathToBreadcrumb } from '../services/JsonPatchService';
import { escHtml } from '../utils/escape';
import { toast } from '../utils/toast';

export class PropertiesPanel {
  private contentEl: HTMLElement;
  private emptyEl: HTMLElement;

  constructor() {
    this.contentEl = document.getElementById('properties-content')!;
    this.emptyEl = document.getElementById('properties-empty')!;

    EventBus.on('node:select', ({ path }) => {
      this.renderForPath(path);
    });

    EventBus.on('node:deselect', () => {
      this.showEmpty();
    });

    EventBus.on('store:change', () => {
      const path = AppStore.selectedPath;
      if (path !== null) {
        this.renderForPath(path);
      }
    });
  }

  private showEmpty(): void {
    this.emptyEl.classList.remove('hidden');
    this.contentEl.classList.add('hidden');
  }

  private renderForPath(path: string): void {
    const value = AppStore.getSelectedValue();
    if (value === undefined) { this.showEmpty(); return; }

    const type = detectType(value);
    const lastKey = AppStore.getLastSegment(path);

    this.emptyEl.classList.add('hidden');
    this.contentEl.classList.remove('hidden');

    const breadcrumb = `<div class="prop-breadcrumb" title="${escHtml(path)}">
      <span>Percorso:</span> ${escHtml(pathToBreadcrumb(path))}
    </div>`;

    let body = '';

    if (type === 'object') {
      body = this.renderObjectEditor(path, value as Record<string, unknown>);
    } else if (type === 'array') {
      if (isUuidArrayKey(lastKey)) {
        body = this.renderUuidArrayEditor(path, value as string[]);
      } else {
        body = this.renderArrayEditor(path, value as unknown[]);
      }
    } else {
      body = this.renderPrimitiveEditor(path, value, type);
    }

    const actions = this.renderActions(path);
    this.contentEl.innerHTML = breadcrumb + body + actions;
    this.attachFormEvents(path, type, value, lastKey);
  }

  // ===== PRIMITIVE =====
  private renderPrimitiveEditor(_path: string, value: unknown, type: JsonType): string {
    const types: JsonType[] = ['string', 'number', 'boolean', 'null'];
    const typeBtns = types.map(t =>
      `<button class="type-btn ${type === t ? `active-${t}` : ''}" data-switch-type="${t}">${typeLabel(t)}</button>`
    ).join('');

    let inputHtml = '';
    if (type === 'boolean') {
      inputHtml = `
        <div class="prop-checkbox-row">
          <input type="checkbox" class="prop-checkbox" id="prim-bool" ${value ? 'checked' : ''} />
          <label for="prim-bool">${value ? 'true' : 'false'}</label>
        </div>`;
    } else if (type === 'null') {
      inputHtml = `<input class="prop-input val-null" value="null" disabled />`;
    } else if (type === 'number') {
      inputHtml = `<input type="number" class="prop-input is-number" id="prim-value" value="${escHtml(String(value))}" step="any" />`;
    } else {
      inputHtml = `<input type="text" class="prop-input is-string" id="prim-value" value="${escHtml(String(value))}" />`;
    }

    return `
      <div class="prop-section">
        <div class="prop-label">Tipo <div class="type-selector">${typeBtns}</div></div>
        ${inputHtml}
      </div>`;
  }

  // ===== ARRAY (generic) =====
  private renderArrayEditor(_path: string, value: unknown[]): string {
    const itemsHtml = value.map((item, i) => {
      const t = detectType(item);
      const v = t === 'string' ? String(item) : JSON.stringify(item);
      return `<div class="array-item">
        <span class="array-item-idx">[${i}]</span>
        <input class="prop-input array-item-input" data-index="${i}" value="${escHtml(v)}" />
        <button class="btn-delete-item" data-delete-index="${i}" title="Rimuovi">×</button>
      </div>`;
    }).join('');

    return `
      <div class="prop-section">
        <div class="prop-label">Array <span style="color:var(--color-array)">[${value.length}]</span></div>
        <div class="array-items">${itemsHtml}</div>
        <button class="btn btn-sm" id="btn-add-item">+ Aggiungi elemento</button>
      </div>`;
  }

  // ===== UUID ARRAY (Columbus-specific) =====
  private renderUuidArrayEditor(path: string, uuids: string[]): string {
    const chips = uuids.map((uuid, i) =>
      `<div class="uuid-chip" title="${escHtml(uuid)}">
        <span class="uuid-chip-text">${escHtml(uuid)}</span>
        <button class="uuid-chip-delete" data-delete-uuid-index="${i}" title="Rimuovi">×</button>
      </div>`
    ).join('');

    const keyLabel = AppStore.getLastSegment(path) === 'uuid_dispatchers_create'
      ? '🟢 uuid_dispatchers_create'
      : '🔴 uuid_dispatchers_delete';

    return `
      <div class="prop-section">
        <div class="prop-label">${escHtml(keyLabel)}</div>
        <div class="uuid-chips">${chips || '<span style="color:var(--text-muted);font-size:11px">Nessun UUID</span>'}</div>
        <div class="uuid-add-row">
          <input type="text" class="uuid-add-input" id="uuid-add-input" placeholder="Incolla UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)" />
          <button class="btn btn-sm" id="btn-add-uuid">+ Aggiungi</button>
        </div>
      </div>`;
  }

  // ===== OBJECT =====
  private renderObjectEditor(_path: string, value: Record<string, unknown>): string {
    const rows = Object.entries(value).map(([k, v]) => {
      const t = detectType(v);
      const displayVal = t === 'object' || t === 'array'
        ? `[${typeLabel(t)}: ${t === 'array' ? (v as unknown[]).length : Object.keys(v as object).length} elementi]`
        : t === 'string' ? String(v) : JSON.stringify(v);
      const isComplex = t === 'object' || t === 'array';
      return `<div class="obj-row">
        <span class="obj-row-key" title="${escHtml(k)}">${escHtml(k.length > 18 ? k.substring(0, 16) + '…' : k)}</span>
        <span class="obj-row-sep">:</span>
        ${isComplex
          ? `<span class="obj-row-value" style="color:var(--text-muted);font-size:11px;flex:1">${escHtml(displayVal)}</span>
             <button class="btn btn-sm" data-navigate-key="${escHtml(k)}" title="Seleziona nodo">→</button>`
          : `<input class="prop-input obj-row-value" data-obj-key="${escHtml(k)}" value="${escHtml(String(displayVal))}" />`
        }
        <button class="btn-delete-item" data-delete-key="${escHtml(k)}" title="Elimina chiave">×</button>
      </div>`;
    }).join('');

    return `
      <div class="prop-section">
        <div class="prop-label">Oggetto <span style="color:var(--color-object)">{${Object.keys(value).length}}</span></div>
        <div class="obj-rows">${rows}</div>
        <div class="add-key-row">
          <input type="text" class="prop-input" id="new-key-input" placeholder="nuova-chiave" style="width:130px" />
          <button class="btn btn-sm" id="btn-add-key">+ Aggiungi chiave</button>
        </div>
      </div>`;
  }

  private renderActions(_path: string): string {
    return `
      <div class="prop-actions">
        <button class="btn btn-danger btn-sm" id="btn-delete-node">🗑 Elimina nodo</button>
        <button class="btn btn-sm" id="btn-copy-path">📋 Copia percorso</button>
        <button class="btn btn-sm" id="btn-copy-value">📄 Copia valore</button>
      </div>`;
  }

  // ===== EVENT WIRING =====
  private attachFormEvents(path: string, type: JsonType, value: unknown, lastKey: string): void {
    // --- Delete node ---
    this.on('btn-delete-node', 'click', () => {
      AppStore.deleteNode(path);
    });

    // --- Copy path ---
    this.on('btn-copy-path', 'click', () => {
      navigator.clipboard.writeText(path).catch(() => {});
      toast('Percorso copiato', 'info');
    });

    // --- Copy value ---
    this.on('btn-copy-value', 'click', () => {
      navigator.clipboard.writeText(JSON.stringify(value, null, 2)).catch(() => {});
      toast('Valore copiato', 'info');
    });

    if (type === 'boolean') {
      this.on('prim-bool', 'change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        AppStore.applyPatch(path, checked);
      });
    } else if (type === 'string' || type === 'number') {
      this.on('prim-value', 'change', (e) => {
        const raw = (e.target as HTMLInputElement).value;
        const coerced: unknown = type === 'number' ? Number(raw) : raw;
        AppStore.applyPatch(path, coerced);
      });
    }

    // --- Type switch buttons ---
    this.contentEl.querySelectorAll('[data-switch-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newType = (btn as HTMLElement).dataset.switchType as JsonType;
        const converted = this.convertValue(value, newType);
        AppStore.applyPatch(path, converted);
      });
    });

    // --- Generic array ---
    if (type === 'array' && !isUuidArrayKey(lastKey)) {
      const arr = value as unknown[];

      this.on('btn-add-item', 'click', () => {
        AppStore.addArrayItem(path, '');
      });

      this.contentEl.querySelectorAll('[data-delete-index]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.deleteIndex!, 10);
          const newArr = (arr as unknown[]).filter((_, i) => i !== idx);
          AppStore.applyPatch(path, newArr);
        });
      });

      this.contentEl.querySelectorAll('.array-item-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt((input as HTMLElement).dataset.index!, 10);
          const rawVal = (e.target as HTMLInputElement).value;
          let parsed: unknown = rawVal;
          try { parsed = JSON.parse(rawVal); } catch { /* keep as string */ }
          const newArr = [...arr];
          newArr[idx] = parsed;
          AppStore.applyPatch(path, newArr);
        });
      });
    }

    // --- UUID array ---
    if (type === 'array' && isUuidArrayKey(lastKey)) {
      const uuids = value as string[];

      this.on('btn-add-uuid', 'click', () => {
        const input = document.getElementById('uuid-add-input') as HTMLInputElement;
        const uuid = input.value.trim();
        if (!isUuid(uuid)) {
          toast('UUID non valido', 'error');
          return;
        }
        if (uuids.includes(uuid)) {
          toast('UUID già presente', 'error');
          return;
        }
        AppStore.applyPatch(path, [...uuids, uuid]);
        input.value = '';
      });

      this.on('uuid-add-input', 'keydown', (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          document.getElementById('btn-add-uuid')!.click();
        }
      });

      this.contentEl.querySelectorAll('[data-delete-uuid-index]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.deleteUuidIndex!, 10);
          AppStore.applyPatch(path, uuids.filter((_, i) => i !== idx));
        });
      });
    }

    // --- Object editor ---
    if (type === 'object') {
      const obj = value as Record<string, unknown>;

      this.on('btn-add-key', 'click', () => {
        const input = document.getElementById('new-key-input') as HTMLInputElement;
        const key = input.value.trim();
        if (!key) { toast('Inserisci un nome chiave', 'error'); return; }
        if (key in obj) { toast('Chiave già esistente', 'error'); return; }
        AppStore.addObjectKey(path, key, '');
        input.value = '';
      });

      this.contentEl.querySelectorAll('[data-delete-key]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = (btn as HTMLElement).dataset.deleteKey!;
          const newObj = { ...obj };
          delete newObj[key];
          AppStore.applyPatch(path, newObj);
        });
      });

      this.contentEl.querySelectorAll('[data-obj-key]').forEach(input => {
        input.addEventListener('change', (e) => {
          const key = (input as HTMLElement).dataset.objKey!;
          const rawVal = (e.target as HTMLInputElement).value;
          let parsed: unknown = rawVal;
          try { parsed = JSON.parse(rawVal); } catch { /* keep as string */ }
          AppStore.applyPatch(path, { ...obj, [key]: parsed });
        });
      });

      this.contentEl.querySelectorAll('[data-navigate-key]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = (btn as HTMLElement).dataset.navigateKey!;
          const childPath = `${path}/${key}`;
          AppStore.selectNode(childPath);
        });
      });
    }
  }

  private on(id: string, event: string, handler: (e: Event) => void): void {
    const el = document.getElementById(id);
    el?.addEventListener(event, handler);
  }

  private convertValue(value: unknown, toType: JsonType): unknown {
    switch (toType) {
      case 'string':  return value === null ? '' : String(value);
      case 'number':  return Number(value) || 0;
      case 'boolean': return Boolean(value);
      case 'null':    return null;
      case 'array':   return [];
      case 'object':  return {};
    }
  }
}

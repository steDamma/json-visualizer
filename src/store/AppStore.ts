import { EventBus, type ChangeOrigin } from './EventBus';
import {
  getByPath,
  setByPath,
  deleteByPath,
  pathToSegments,
} from '../services/JsonPatchService';

class AppStoreClass {
  private _json: unknown = null;
  private _selectedPath: string | null = null;
  private _filename: string = 'untitled.json';
  private _isDirty: boolean = false;

  get json(): unknown { return this._json; }
  get selectedPath(): string | null { return this._selectedPath; }
  get filename(): string { return this._filename; }
  get isDirty(): boolean { return this._isDirty; }

  /** Load from a raw JSON string (file open or drag & drop). */
  loadFromString(raw: string, filename?: string): void {
    this._json = JSON.parse(raw);
    if (filename) this._filename = filename;
    this._isDirty = false;
    this._selectedPath = null;
    EventBus.emit('store:change', { json: this._json, origin: 'file' });
    EventBus.emit('node:deselect', undefined);
  }

  /** Called when the CodeMirror editor changes. */
  updateFromEditor(raw: string): void {
    this._json = JSON.parse(raw);
    this._isDirty = true;
    EventBus.emit('store:change', { json: this._json, origin: 'editor' });
  }

  /** Set a value at a JSON Pointer path. */
  applyPatch(path: string, value: unknown, origin: ChangeOrigin = 'properties'): void {
    if (this._json === null) return;
    this._json = setByPath(this._json, path, value);
    this._isDirty = true;
    EventBus.emit('store:change', { json: this._json, origin });
  }

  /** Delete the node at a JSON Pointer path. */
  deleteNode(path: string): void {
    if (this._json === null) return;
    this._json = deleteByPath(this._json, path);
    this._isDirty = true;
    if (this._selectedPath === path) {
      this._selectedPath = null;
      EventBus.emit('node:deselect', undefined);
    }
    EventBus.emit('store:change', { json: this._json, origin: 'tree' });
  }

  /** Append an item to an array at path. */
  addArrayItem(path: string, item: unknown = null): void {
    const arr = getByPath(this._json, path);
    if (!Array.isArray(arr)) return;
    this.applyPatch(path, [...arr, item]);
  }

  /** Add a key to an object at path. */
  addObjectKey(path: string, key: string, value: unknown = ''): void {
    const obj = getByPath(this._json, path);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    this.applyPatch(path, { ...(obj as Record<string, unknown>), [key]: value });
  }

  /** Select a node by JSON Pointer path. */
  selectNode(path: string | null): void {
    this._selectedPath = path;
    if (path !== null) {
      EventBus.emit('node:select', { path });
    } else {
      EventBus.emit('node:deselect', undefined);
    }
  }

  /** Get the value at the currently selected path. */
  getSelectedValue(): unknown {
    if (!this._selectedPath || !this._json) return undefined;
    if (this._selectedPath === '') return this._json;
    return getByPath(this._json, this._selectedPath);
  }

  /** Get the parent path of a JSON Pointer. */
  getParentPath(path: string): string {
    const segments = pathToSegments(path);
    if (segments.length <= 1) return '';
    return '/' + segments.slice(0, -1).join('/');
  }

  /** Get the last key segment of a path. */
  getLastSegment(path: string): string {
    const segments = pathToSegments(path);
    return segments[segments.length - 1] ?? '';
  }

  serialize(): string {
    return JSON.stringify(this._json, null, 2);
  }

  markClean(): void {
    this._isDirty = false;
  }
}

export const AppStore = new AppStoreClass();

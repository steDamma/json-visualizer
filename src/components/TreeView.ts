import { AppStore } from '../store/AppStore';
import { EventBus } from '../store/EventBus';
import { detectType, typeBadge, isMaybeUuid, type JsonType } from '../utils/typeDetect';
import { escHtml } from '../utils/escape';
import { segmentsToPath, pathToSegments } from '../services/JsonPatchService';

interface FlatNode {
  key: string | number;
  type: JsonType;
  value: unknown;
  path: string;
  level: number;
  hasChildren: boolean;
  childCount: number;
  isExpanded: boolean;
}

export class TreeView {
  private nodesEl: HTMLElement;
  private emptyEl: HTMLElement;
  private expandedPaths = new Set<string>();
  private searchQuery = '';
  private contextPath: string | null = null;

  constructor() {
    this.nodesEl = document.getElementById('tree-nodes')!;
    this.emptyEl = document.getElementById('tree-empty')!;

    // Event delegation — attached once, survive innerHTML re-renders
    this.nodesEl.addEventListener('click', this.handleClick);
    this.nodesEl.addEventListener('dblclick', this.handleDblClick);
    this.nodesEl.addEventListener('contextmenu', this.handleRightClick);

    EventBus.on('store:change', ({ json }) => {
      if (json !== null) this.render();
      else this.showEmpty();
    });

    EventBus.on('search:filter', ({ query }) => {
      this.searchQuery = query.toLowerCase().trim();
      this.render();
    });

    this.setupContextMenu();
    this.setupKeyboard();
  }

  // ===== PUBLIC =====

  expandAll(): void {
    const json = AppStore.json;
    if (!json) return;
    this.collectAllExpandable(json, []);
    this.render();
  }

  collapseAll(): void {
    this.expandedPaths.clear();
    this.render();
  }

  // ===== RENDER =====

  private showEmpty(): void {
    this.emptyEl.classList.remove('hidden');
    this.nodesEl.classList.add('hidden');
  }

  private render(): void {
    const json = AppStore.json;
    if (!json) { this.showEmpty(); return; }

    this.emptyEl.classList.add('hidden');
    this.nodesEl.classList.remove('hidden');

    // Build full flat list
    const allNodes: FlatNode[] = [];
    this.buildFlat(json, [], 0, allNodes);

    // Apply search filter if active
    const visible = this.searchQuery
      ? this.filterBySearch()
      : allNodes;

    this.nodesEl.innerHTML = visible.map(n => this.renderNode(n)).join('');
  }

  /**
   * Recursively builds a flat list of visible nodes.
   * Children are included only if the parent is expanded.
   */
  private buildFlat(
    value: unknown,
    pathSegments: (string | number)[],
    level: number,
    out: FlatNode[],
  ): void {
    const type = detectType(value);
    const isRoot = pathSegments.length === 0;

    if (isRoot) {
      if (type === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          this.buildFlat(v, [k], 0, out);
        }
      }
      return;
    }

    const path = segmentsToPath(pathSegments);
    const key = pathSegments[pathSegments.length - 1];
    const hasChildren = type === 'object' || type === 'array';
    const childCount = hasChildren
      ? Array.isArray(value)
        ? (value as unknown[]).length
        : Object.keys(value as Record<string, unknown>).length
      : 0;
    const isExpanded = this.expandedPaths.has(path);

    out.push({ key, type, value, path, level, hasChildren, childCount, isExpanded });

    if (hasChildren && isExpanded) {
      if (Array.isArray(value)) {
        (value as unknown[]).forEach((item, i) => {
          this.buildFlat(item, [...pathSegments, i], level + 1, out);
        });
      } else {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          this.buildFlat(v, [...pathSegments, k], level + 1, out);
        }
      }
    }
  }

  /**
   * When a search query is active:
   * 1. Build a FULL flat list (all nodes, all expanded) to find all matches.
   * 2. Collect matching paths + their ancestors.
   * 3. Return only those nodes, with ancestors auto-expanded.
   */
  private filterBySearch(): FlatNode[] {
    const q = this.searchQuery;
    const matchSet = new Set<string>();

    // Build full tree ignoring current expand state
    const fullList: FlatNode[] = [];
    this.buildFlatFull(AppStore.json, [], 0, fullList);

    for (const node of fullList) {
      const keyStr = String(node.key).toLowerCase();
      const valStr = this.valueAsString(node.value).toLowerCase();
      if (keyStr.includes(q) || valStr.includes(q)) {
        matchSet.add(node.path);
        // Add all ancestors
        const segs = pathToSegments(node.path);
        for (let i = 1; i < segs.length; i++) {
          matchSet.add('/' + segs.slice(0, i).join('/'));
        }
      }
    }

    if (matchSet.size === 0) return [];

    // Temporarily expand all ancestor paths so buildFlat renders them
    const savedExpanded = new Set(this.expandedPaths);
    for (const p of matchSet) {
      const node = fullList.find(n => n.path === p);
      if (node?.hasChildren) {
        this.expandedPaths.add(p);
      }
    }

    const visibleNodes: FlatNode[] = [];
    this.buildFlat(AppStore.json, [], 0, visibleNodes);

    // Restore original expand state
    this.expandedPaths = savedExpanded;

    // Filter to only matched paths, marking non-direct matches as dimmed
    return visibleNodes
      .filter(n => matchSet.has(n.path))
      .map(n => ({
        ...n,
        isExpanded: true, // show as expanded in search results
      }));
  }

  /** Same as buildFlat but always recurses into children (ignores expandedPaths). */
  private buildFlatFull(
    value: unknown,
    pathSegments: (string | number)[],
    level: number,
    out: FlatNode[],
  ): void {
    const type = detectType(value);
    const isRoot = pathSegments.length === 0;

    if (isRoot) {
      if (type === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          this.buildFlatFull(v, [k], 0, out);
        }
      }
      return;
    }

    const path = segmentsToPath(pathSegments);
    const key = pathSegments[pathSegments.length - 1];
    const hasChildren = type === 'object' || type === 'array';
    const childCount = hasChildren
      ? Array.isArray(value)
        ? (value as unknown[]).length
        : Object.keys(value as Record<string, unknown>).length
      : 0;

    out.push({ key, type, value, path, level, hasChildren, childCount, isExpanded: true });

    if (hasChildren) {
      if (Array.isArray(value)) {
        (value as unknown[]).forEach((item, i) => {
          this.buildFlatFull(item, [...pathSegments, i], level + 1, out);
        });
      } else {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          this.buildFlatFull(v, [...pathSegments, k], level + 1, out);
        }
      }
    }
  }

  private valueAsString(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value !== 'object') return String(value);
    return '';
  }

  // ===== RENDERING =====

  private renderNode(node: FlatNode): string {
    const indent = node.level * 16;
    const isSelected = node.path === AppStore.selectedPath;

    const toggle = node.hasChildren
      ? `<span class="tree-toggle" data-toggle="${escHtml(node.path)}">${node.isExpanded ? '▼' : '▶'}</span>`
      : '<span class="tree-toggle-spacer"></span>';

    const badge = `<span class="tree-type-badge">${escHtml(typeBadge(node.type))}</span>`;
    const keyHtml = `<span class="tree-key">${escHtml(this.formatKey(node.key))}</span>`;

    const valueHtml = node.hasChildren
      ? `<span class="val-count">${node.childCount} ${node.type === 'array' ? 'el.' : 'k.'}</span>`
      : this.renderInlineValue(node.value, node.type);

    const classes = ['tree-node', `type-${node.type}`, isSelected ? 'selected' : '']
      .filter(Boolean).join(' ');

    return `<div class="${classes}"
      data-path="${escHtml(node.path)}"
      style="padding-left:${indent + 8}px"
      title="${escHtml(node.path)}"
      tabindex="-1">
      ${toggle}${badge}${keyHtml}<span class="tree-sep">:</span>${valueHtml}
    </div>`;
  }

  private formatKey(key: string | number): string {
    const s = String(key);
    return isMaybeUuid(s) ? `${s.substring(0, 8)}…` : s;
  }

  private renderInlineValue(value: unknown, type: JsonType): string {
    switch (type) {
      case 'null':    return '<span class="tree-value val-null">null</span>';
      case 'boolean': return `<span class="tree-value val-bool">${value}</span>`;
      case 'number':  return `<span class="tree-value val-num">${value}</span>`;
      case 'string': {
        const s = String(value);
        const display = s.length > 60 ? s.substring(0, 57) + '…' : s;
        return `<span class="tree-value val-str">"${escHtml(display)}"</span>`;
      }
      default: return '';
    }
  }

  // ===== EVENTS (delegated to stable container) =====

  private handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;

    // Toggle expand/collapse
    const toggle = target.closest('[data-toggle]') as HTMLElement | null;
    if (toggle) {
      this.toggleExpand(toggle.dataset.toggle!);
      return;
    }

    // Select node
    const node = target.closest('.tree-node') as HTMLElement | null;
    if (node) {
      const path = node.dataset.path!;
      AppStore.selectNode(path);
      // Re-render to update selected highlight
      const prev = this.nodesEl.querySelector('.tree-node.selected');
      prev?.classList.remove('selected');
      node.classList.add('selected');
    }
  };

  private handleDblClick = (e: MouseEvent): void => {
    const node = (e.target as HTMLElement).closest('.tree-node') as HTMLElement | null;
    if (!node) return;
    const path = node.dataset.path;
    if (path !== undefined) {
      EventBus.emit('node:focus', { path });
    }
  };

  private handleRightClick = (e: MouseEvent): void => {
    const node = (e.target as HTMLElement).closest('.tree-node') as HTMLElement | null;
    if (!node) return;
    e.preventDefault();
    this.contextPath = node.dataset.path ?? null;
    this.showContextMenu(e.clientX, e.clientY);
  };

  private toggleExpand(path: string): void {
    if (this.expandedPaths.has(path)) {
      for (const p of [...this.expandedPaths]) {
        if (p === path || p.startsWith(path + '/')) {
          this.expandedPaths.delete(p);
        }
      }
    } else {
      this.expandedPaths.add(path);
    }
    this.render();
  }

  private collectAllExpandable(value: unknown, segments: (string | number)[]): void {
    const type = detectType(value);
    if (segments.length > 0 && (type === 'object' || type === 'array')) {
      this.expandedPaths.add(segmentsToPath(segments));
    }
    if (type === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        this.collectAllExpandable(v, [...segments, k]);
      }
    } else if (type === 'array') {
      (value as unknown[]).forEach((item, i) => {
        this.collectAllExpandable(item, [...segments, i]);
      });
    }
  }

  // ===== CONTEXT MENU =====

  private setupContextMenu(): void {
    const menu = document.getElementById('context-menu')!;

    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.context-menu')) {
        menu.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') menu.classList.add('hidden');
    });

    menu.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!btn || !this.contextPath) return;
      const action = btn.dataset.action;
      menu.classList.add('hidden');

      if (action === 'copy-path') {
        navigator.clipboard.writeText(this.contextPath).catch(() => {});
      } else if (action === 'copy-value') {
        const val = AppStore.json
          ? JSON.stringify(this.getValueAtPath(AppStore.json, this.contextPath), null, 2)
          : '';
        navigator.clipboard.writeText(val).catch(() => {});
      } else if (action === 'delete-node') {
        AppStore.deleteNode(this.contextPath);
        this.contextPath = null;
      }
    });
  }

  private showContextMenu(x: number, y: number): void {
    const menu = document.getElementById('context-menu')!;
    menu.classList.remove('hidden');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    // Clamp to viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  menu.style.left  = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top  = `${y - rect.height}px`;
  }

  private getValueAtPath(json: unknown, path: string): unknown {
    const segs = pathToSegments(path);
    let cur: unknown = json;
    for (const seg of segs) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      const menu = document.getElementById('context-menu')!;
      if (e.key === 'Delete' && AppStore.selectedPath && menu.classList.contains('hidden')) {
        // Only delete when focus is in the tree area, not in an input
        if (document.activeElement?.tagName !== 'INPUT' &&
            document.activeElement?.tagName !== 'TEXTAREA') {
          AppStore.deleteNode(AppStore.selectedPath);
        }
      }
    });
  }
}

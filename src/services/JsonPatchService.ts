/**
 * JSON Pointer (RFC 6901) utilities for reading and writing nested JSON values.
 * All set/delete operations return a new root object (structural sharing).
 */

export function pathToSegments(path: string): string[] {
  if (!path || path === '/') return [];
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return normalized.split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function segmentsToPath(segments: (string | number)[]): string {
  if (segments.length === 0) return '/';
  return '/' + segments.map(s => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

export function getByPath(obj: unknown, path: string): unknown {
  const segments = pathToSegments(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function setByPath(root: unknown, path: string, value: unknown): unknown {
  const segments = pathToSegments(path);
  if (segments.length === 0) return value;
  return _set(root, segments, value);
}

function _set(node: unknown, segments: string[], value: unknown): unknown {
  const [head, ...rest] = segments;
  if (Array.isArray(node)) {
    const idx = parseInt(head, 10);
    const clone = [...node];
    clone[idx] = rest.length === 0 ? value : _set(clone[idx], rest, value);
    return clone;
  } else {
    const obj = (node ?? {}) as Record<string, unknown>;
    return {
      ...obj,
      [head]: rest.length === 0 ? value : _set(obj[head], rest, value),
    };
  }
}

export function deleteByPath(root: unknown, path: string): unknown {
  const segments = pathToSegments(path);
  if (segments.length === 0) return root;
  return _delete(root, segments);
}

function _delete(node: unknown, segments: string[]): unknown {
  const [head, ...rest] = segments;
  if (Array.isArray(node)) {
    const idx = parseInt(head, 10);
    if (rest.length === 0) {
      return node.filter((_, i) => i !== idx);
    }
    const clone = [...node];
    clone[idx] = _delete(clone[idx], rest);
    return clone;
  } else {
    const obj = { ...(node as Record<string, unknown>) };
    if (rest.length === 0) {
      delete obj[head];
    } else {
      obj[head] = _delete(obj[head], rest);
    }
    return obj;
  }
}

/** Converts a path string to a human-readable breadcrumb. */
export function pathToBreadcrumb(path: string): string {
  const segments = pathToSegments(path);
  if (segments.length === 0) return 'root';
  return segments.join(' › ');
}

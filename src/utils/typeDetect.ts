export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export function detectType(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'object') return 'object';
  return t as JsonType;
}

export function typeBadge(type: JsonType): string {
  const map: Record<JsonType, string> = {
    object: '{}',
    array: '[]',
    string: '"a"',
    number: '##',
    boolean: 'B',
    null: 'Ø',
  };
  return map[type];
}

export function typeLabel(type: JsonType): string {
  const map: Record<JsonType, string> = {
    object: 'Oggetto',
    array: 'Array',
    string: 'Stringa',
    number: 'Numero',
    boolean: 'Booleano',
    null: 'Null',
  };
  return map[type];
}

/** Returns true when this key name signals a UUID array (Columbus-specific). */
export function isUuidArrayKey(key: string): boolean {
  return key === 'uuid_dispatchers_create' || key === 'uuid_dispatchers_delete';
}

/** Loose UUID validation. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function isMaybeUuid(key: string): boolean {
  return isUuid(key);
}

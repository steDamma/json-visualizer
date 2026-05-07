export type ChangeOrigin = 'editor' | 'tree' | 'properties' | 'file';

export interface StoreChangePayload {
  json: unknown;
  origin: ChangeOrigin;
}

export interface NodeSelectPayload {
  path: string;
}

export interface SearchFilterPayload {
  query: string;
}

interface EventMap {
  'store:change': StoreChangePayload;
  'node:select': NodeSelectPayload;
  'node:focus': NodeSelectPayload;   // double-click → scroll editor to node
  'node:deselect': undefined;
  'search:filter': SearchFilterPayload;
}

type EventKey = keyof EventMap;
type Handler<T> = (payload: T) => void;

class EventBusClass {
  private listeners = new Map<EventKey, Set<Handler<unknown>>>();

  on<K extends EventKey>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: Handler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach(h => h(payload));
  }
}

export const EventBus = new EventBusClass();

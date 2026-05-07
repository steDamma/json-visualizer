# CLAUDE.md — JSON Visualizer

Guida per Claude Code su questo progetto.

## Stack

- **TypeScript + Vite** (no framework UI)
- **CodeMirror 6** per l'editor JSON (left panel)
- **DOM vanilla** per tree view e properties panel
- **CSS custom** con variabili CSS per il dark theme

## Struttura del progetto

```
src/
├── main.ts                    # Entry point, wiring dei componenti
├── store/
│   ├── AppStore.ts            # Singleton: unica sorgente di verità
│   └── EventBus.ts            # Pub/sub tipizzato
├── services/
│   ├── JsonPatchService.ts    # JSON Pointer RFC 6901
│   └── FileService.ts         # File I/O, drag & drop
├── components/
│   ├── JsonEditor.ts          # CodeMirror wrapper
│   ├── TreeView.ts            # Albero interattivo
│   ├── PropertiesPanel.ts     # Form per nodo selezionato
│   └── SplitPane.ts           # Divisori ridimensionabili
└── utils/
    ├── typeDetect.ts
    ├── toast.ts
    └── escape.ts
```

## Comandi

```bash
npm install                    # Prima installazione
npm run dev                    # Dev server su http://localhost:5173
npm run build                  # Build produzione in dist/
npm run preview                # Anteprima build

npm run electron:dev           # App desktop con hot-reload
npm run electron:build         # Installer + portabile Windows in release/
npm run electron:build:portable  # Solo portabile (più veloce)
```

## Principi architetturali fondamentali

### Unica sorgente di verità

`AppStore` in `src/store/AppStore.ts` è l'unico posto dove vive il JSON parsato. **Non** duplicare lo stato nei componenti.

### EventBus per la comunicazione

I componenti comunicano solo attraverso `EventBus`. Non chiamare metodi di un componente da un altro componente direttamente.

```typescript
// Corretto
EventBus.emit('store:change', { json, origin: 'properties' });

// Sbagliato
treeView.render(); // non chiamare metodi pubblici tra componenti
```

### Guard sull'origin per prevenire loop

`JsonEditor` ignora gli eventi `store:change` con `origin === 'editor'`.
`TreeView` e `PropertiesPanel` ignorano i propri aggiornamenti tramite origin.
Rispettare sempre questo pattern quando si aggiungono nuovi componenti.

### Event delegation nel TreeView

Il `TreeView` usa event delegation su `this.nodesEl` (stabile, non ri-creato).
**Non** attaccare listener ai singoli nodi dentro `innerHTML` — vengono persi a ogni re-render.

```typescript
// Corretto — listener sul container stabile
this.nodesEl.addEventListener('click', this.handleClick); // nel constructor

// Sbagliato — listener sui figli creati da innerHTML
this.nodesEl.querySelectorAll('.tree-node').forEach(el => el.addEventListener('click', ...));
```

### Immutabilità in JsonPatchService

`setByPath` e `deleteByPath` restituiscono sempre un **nuovo oggetto root** (structural sharing).
Non modificare mai `AppStore.json` direttamente.

## Pattern di modifica JSON

```typescript
// Leggere un valore
const val = getByPath(AppStore.json, '/Watchdog/columbus/all/0');

// Modificare (restituisce nuovo root)
AppStore.applyPatch('/Watchdog/columbus/all/0/uuid_dispatchers_create', newArray);

// Eliminare un nodo
AppStore.deleteNode('/Watchdog/columbus/all/1');

// Aggiungere item a un array
AppStore.addArrayItem('/Watchdog/columbus/all', newEntry);

// Aggiungere chiave a un oggetto
AppStore.addObjectKey('/Watchdog/job', 'nuova_chiave', 'valore');
```

## Aggiungere un nuovo tipo di editor speciale (come UUID chips)

1. Aggiungere il rilevamento in `src/utils/typeDetect.ts`:
```typescript
export function isSpecialArrayKey(key: string): boolean {
  return key === 'mia_lista_speciale';
}
```

2. In `PropertiesPanel.ts`, aggiungere il branch nel metodo `renderForPath`:
```typescript
} else if (type === 'array') {
  if (isUuidArrayKey(lastKey)) {
    body = this.renderUuidArrayEditor(path, value as string[]);
  } else if (isSpecialArrayKey(lastKey)) {
    body = this.renderMiaListaEditor(path, value as unknown[]);
  } else {
    body = this.renderArrayEditor(path, value as unknown[]);
  }
}
```

## Convenzioni CSS

- Tutte le variabili di colore sono in `src/styles/main.css` nella sezione `:root`
- I colori per tipo JSON: `--color-string`, `--color-number`, `--color-boolean`, `--color-null`, `--color-object`, `--color-array`
- Dark theme: `--bg-0` (più scuro) → `--bg-4` (più chiaro)
- **Non** usare colori hardcoded: sempre variabili CSS

## Struttura Columbus attesa

Il progetto è ottimizzato per configurazioni nel formato:

```json
{
  "NomeJob": {
    "job": { "...": "..." },
    "columbus": {
      "all": [
        {
          "type": "SV_S2S",
          "create_empty": true,
          "virtual_attr": { "name": "vs.esempio" },
          "last_status_filter": { "...": "..." },
          "uuid_dispatchers_create": ["uuid1"],
          "uuid_dispatchers_delete": ["uuid2"]
        }
      ],
      "<uuid-customer>": [ "... stessa struttura ..." ]
    }
  }
}
```

Le chiavi UUID a livello `columbus.*` vengono abbreviate nell'albero (es. `8b8d63d2…`). Il tooltip mostra l'UUID completo.

## Electron — note importanti

- Il main process è in `electron/main.cjs` (CommonJS obbligatorio per Electron)
- `app.isPackaged` distingue dev (false) da produzione (true) — **non usare** `process.env.NODE_ENV` per questo
- `vite.config.ts` usa `base: './'` solo in build (necessario per `file://` protocol), `'/'` in dev
- Il menu nativo (File/Modifica/Visualizza) è definito in `buildMenu()` in `main.cjs`
- Per accedere a file system nativo in futuro: aggiungere IPC in `main.cjs` + `preload.cjs`, non usare `nodeIntegration: true`
- La cartella `release/` è in `.gitignore` (file binari grandi, non vanno in git)

## Cosa NON fare

- Non usare `console.log` nel codice committed (usa toast per feedback utente)
- Non fare `JSON.parse` al di fuori di `AppStore.loadFromString` e `JsonEditor.onEditorChange`
- Non modificare `AppStore._json` direttamente (è privato per un motivo)
- Non aggiungere dipendenze UI pesanti (React, Vue, ecc.) — il progetto è volutamente vanilla

## Test manuali prima di un commit

1. Aprire `examples/watchdog_config.json` tramite drag & drop
2. Verificare che l'albero mostri i 3 job di primo livello
3. Espandere `Watchdog > columbus > all > 0`
4. Cliccarci sopra: il pannello proprietà mostra i chip UUID
5. Rimuovere un UUID e verificare che il JSON a sinistra si aggiorni
6. Modificare un valore nell'editor: l'albero deve aggiornarsi entro ~400ms
7. Salvare e riaprire il file: il contenuto deve essere identico

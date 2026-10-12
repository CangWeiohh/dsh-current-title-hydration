import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const SOURCE = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
const ID = 'session-00000000-0000-4000-8000-000000000001'

/** Materialize the browser bundle with the globals its factory closes over. */
function loadBundle({ selection, workspace, rows = {}, listCurrent } = {}) {
  const factories = new Map()
  const storage = new Map()
  if (selection !== undefined) storage.set('dsh.sessions.current', JSON.stringify(selection))
  const applied = []

  const window = { __ModuleLoader__: { load: ({ id, factory }) => factories.set(id, factory) } }
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
  }
  const fetch = async () => ({ ok: true, json: async () => ({ ok: true, title: { title: 'durable title', seq: 42 } }) })
  new Function('window', 'localStorage', 'fetch', 'queueMicrotask', SOURCE)(window, localStorage, fetch, queueMicrotask)

  const factory = factories.get('dsh-current-title-hydration')
  assert.equal(typeof factory, 'function', 'client bundle registers its module id')

  const stores = new Map()
  const storeFor = (id) => {
    let store = stores.get(id)
    if (store === undefined) {
      const map = new Map(Object.entries(rows).map(([key, value]) => [key, { kind: 'sequenced', value, seq: 1 }]))
      store = {
        rows: map,
        get: (key) => map.get(key)?.value,
        apply: (key, value, seq) => {
          applied.push(value)
          map.set(key, { kind: 'sequenced', value, seq })
        },
      }
      stores.set(id, store)
    }
    return store
  }

  const manager = {
    refreshList: () => {},
    // DSH 0.2.0 list snapshot: no `current` field unless a build publishes one.
    getListSnapshot: () => ({
      items: [{ sessionId: ID }],
      state: 'ready',
      phase: 'ready',
      error: null,
      projectionsBySession: {},
      ...(listCurrent === undefined ? {} : { current: listCurrent }),
    }),
    projectionStore: storeFor,
    projectionStores: stores,
    subscribe: () => () => {},
  }
  const sessions = { manager }
  const ctx = {
    get: (name) => {
      if (name === 'sessions') return sessions
      if (name === 'uiWorkspace') return workspace
      return undefined
    },
    inject: () => {},
    effect: () => {},
  }

  return { ctx, applied, module: factory(), storage }
}

const flush = async () => {
  for (let index = 0; index < 8; index += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

test('0.2.0: reconciles the selected session from the persisted selection store', async () => {
  const { ctx, applied, module } = loadBundle({ selection: { sessionId: ID }, rows: { title: 'stale title' } })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, ['durable title'])
})

test('0.2.0: reconciles the selected session from the workspace UI service', async () => {
  const workspace = { selection: { getSnapshot: () => ({ sessionId: ID }) } }
  const { ctx, applied, module } = loadBundle({ workspace, rows: { title: 'stale title' } })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, ['durable title'])
})

test('0.2.0: falls back to the workspace main reference when the store is empty', async () => {
  const workspace = { selection: { getSnapshot: () => ({}) }, mainReference: { sessionId: ID } }
  const { ctx, applied, module } = loadBundle({ workspace, rows: { title: 'stale title' } })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, ['durable title'])
})

test('legacy: snapshot.current still selects the authoritative session', async () => {
  const { ctx, applied, module } = loadBundle({ rows: { title: 'stale title' }, listCurrent: ID })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, ['durable title'])
})

test('0.2.0: with no readable selection the plugin stays safe and writes nothing', async () => {
  const { ctx, applied, module } = loadBundle({ rows: { title: 'stale title' } })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, [])
})

test('0.2.0: an unselected session with a usable title row is left alone', async () => {
  const { ctx, applied, module } = loadBundle({ selection: { sessionId: 'session-other' }, rows: { title: 'already fine' } })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, [])
})

test('0.2.0: a missing title row is hydrated for every listed session', async () => {
  const { ctx, applied, module } = loadBundle({ selection: { sessionId: 'session-other' }, rows: {} })
  module.apply(ctx)
  await flush()
  assert.deepEqual(applied, ['durable title'])
})

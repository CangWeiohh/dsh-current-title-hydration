window.__ModuleLoader__.load({
  id: 'dsh-current-title-hydration',
  factory: () => {
    const STORAGE_PREFIX = 'dsh.current-title-hydration.v1:'
    const ROUTE = '/__dsh/current-title-hydration/title'
    const VALID_TITLE = (value) => typeof value === 'string' && value.trim() !== ''

    function readCached(id) {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id) || 'null')
        return VALID_TITLE(value?.title) && Number.isInteger(value?.seq) && value.seq >= 0 ? value : null
      } catch {
        return null
      }
    }

    function writeCached(id, title, seq) {
      if (!VALID_TITLE(title) || !Number.isInteger(seq) || seq < 0) return
      try {
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({ title, seq }))
      } catch {
        // Storage can be disabled or full; the server route remains the repair path.
      }
    }

    async function readDurableTitle(sessionId) {
      const response = await fetch(`${ROUTE}?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) return null
      const result = await response.json()
      return result?.ok === true && VALID_TITLE(result.title?.title) && Number.isInteger(result.title?.seq)
        ? result.title
        : null
    }

    function install(sessions) {
      const manager = sessions?.manager
      if (!manager || manager.__dshCurrentTitleHydration) return
      if (typeof manager.refreshList !== 'function' || typeof manager.getListSnapshot !== 'function' || typeof manager.projectionStore !== 'function') return

      const installation = { active: true, pending: new Set() }
      manager.__dshCurrentTitleHydration = installation

      const remember = () => {
        if (!installation.active) return
        try {
          const snapshot = manager.getListSnapshot()
          const id = snapshot.current
          if (!id) return
          const store = manager.projectionStores?.get?.(id)
          const row = store?.rows?.get?.('title')
          if (VALID_TITLE(row?.value) && Number.isInteger(row.seq) && row.seq >= 0) writeCached(id, row.value, row.seq)
        } catch {
          // This optional cache must never interfere with normal session rendering.
        }
      }

      /**
       * The client projection store keeps one `title` row under the higher-seq-
       * wins rule (`seq <= row.seq` drops the write). The durable event seq read
       * from the stored log can sit BELOW the row the server already seeded
       * (seeded/migrated sessions carry a much larger logical seq space, and the
       * cold list may deliver `title: null` at that higher watermark), so the
       * repair must write at least one past the current row watermark — otherwise
       * the empty row outranks the restored title forever.
       */
      function repairSeq(existingRow, durableSeq) {
        const current = existingRow && Number.isInteger(existingRow.seq) ? existingRow.seq : -1
        return Math.max(current + 1, Number.isInteger(durableSeq) ? durableSeq : 0)
      }

      function rowSeqOf(store) {
        try {
          const row = store?.rows?.get?.('title')
          return row && Number.isInteger(row.seq) ? row : undefined
        } catch {
          return undefined
        }
      }

      const hydrate = async () => {
        if (!installation.active) return
        let sessionId
        let store
        try {
          const snapshot = manager.getListSnapshot()
          sessionId = snapshot.current
          if (!sessionId) return
          store = manager.projectionStore(sessionId)
          const liveTitle = store.get('title')
          if (VALID_TITLE(liveTitle)) {
            remember()
            return
          }
          const cached = readCached(sessionId)
          if (cached) store.apply('title', cached.title, repairSeq(rowSeqOf(store), cached.seq))
        } catch {
          return
        }

        if (installation.pending.has(sessionId)) return
        installation.pending.add(sessionId)
        try {
          const durable = await readDurableTitle(sessionId)
          if (!installation.active || !durable) return
          store.apply('title', durable.title, repairSeq(rowSeqOf(store), durable.seq))
          writeCached(sessionId, durable.title, repairSeq(undefined, durable.seq))
        } catch {
          // A transient read error leaves the stock cwd fallback intact and retries next refresh.
        } finally {
          installation.pending.delete(sessionId)
        }
      }

      const onListChanged = () => {
        remember()
        queueMicrotask(hydrate)
      }
      const unsubscribe = typeof manager.subscribe === 'function' ? manager.subscribe(onListChanged) : () => {}
      queueMicrotask(hydrate)

      // Cordis disposal removes only this listener; no core runtime method or DSH log is changed.
      return () => {
        installation.active = false
        unsubscribe()
        if (manager.__dshCurrentTitleHydration === installation) delete manager.__dshCurrentTitleHydration
      }
    }

    function apply(ctx) {
      const installWhenReady = (sub) => {
        const dispose = install(sub.sessions)
        if (typeof dispose === 'function') ctx.effect(() => dispose, 'current-title-hydration: restore runtime patch')
      }
      const sessions = ctx.get('sessions')
      if (sessions) installWhenReady({ sessions })
      else ctx.inject(['sessions'], installWhenReady)
    }

    return { apply, inject: [] }
  },
})

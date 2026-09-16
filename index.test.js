import assert from 'node:assert/strict'
import test from 'node:test'
import { lastTitleFromEvents, readLogEvents } from './index.js'

test('uses the last nonblank durable session title', () => {
  const result = lastTitleFromEvents([
    { seq: 3, type: 'session/title', data: { title: 'Fallback' } },
    { seq: 4, type: 'assistant/message', data: {} },
    { seq: 7, type: 'session/title', data: { title: '测试 Full Access 是否可用' } },
  ])
  assert.deepEqual(result, { title: '测试 Full Access 是否可用', seq: 7 })
})

test('ignores blank titles and returns null when no durable title exists', () => {
  assert.equal(lastTitleFromEvents([
    { seq: 0, type: 'session/title', data: { title: '  ' } },
    { seq: 1, type: 'user/message', data: {} },
  ]), null)
})

test('prefers the DSH 0.1.5+ open/read handle API and closes the handle', async () => {
  const events = [{ seq: 5, type: 'session/title', data: { title: 'T' } }]
  let closed = 0
  const persistence = {
    async open(id, access) {
      assert.equal(id, 'session-52d35108-05d7-4a97-8f41-b4caff5b66bf')
      assert.equal(access, 'read')
      return {
        async read(offset) {
          assert.equal(offset, 0)
          return { eventState: 'detached', events }
        },
        close() { closed += 1 },
      }
    },
  }
  assert.deepEqual(await readLogEvents(persistence, 'session-52d35108-05d7-4a97-8f41-b4caff5b66bf'), events)
  assert.equal(closed, 1)
})

test('falls back to the legacy readFrom API and refuses unknown persistence seams', async () => {
  const events = [{ seq: 2, type: 'session/title', data: { title: 'Legacy' } }]
  const legacy = {
    async readFrom(id, offset) {
      assert.equal(offset, 0)
      return { events }
    },
  }
  assert.deepEqual(await readLogEvents(legacy, 'session-52d35108-05d7-4a97-8f41-b4caff5b66bf'), events)
  await assert.rejects(readLogEvents({}, 'session-52d35108-05d7-4a97-8f41-b4caff5b66bf'), /no supported session persistence read API/)
})

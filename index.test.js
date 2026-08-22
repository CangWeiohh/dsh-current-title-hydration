import assert from 'node:assert/strict'
import test from 'node:test'
import { lastTitleFromEvents } from './index.js'

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

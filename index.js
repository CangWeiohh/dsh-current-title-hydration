export const name = 'dsh-current-title-hydration'
export const inject = ['sessionPersistence']

export const TITLE_PATH = '/__dsh/current-title-hydration/title'
const SESSION_ID = /^(?:session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function lastTitleFromEvents(events) {
  if (!Array.isArray(events)) return null
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const title = event?.type === 'session/title' ? event.data?.title : undefined
    if (typeof title === 'string' && title.trim() !== '') {
      return { title, seq: event.seq }
    }
  }
  return null
}

function trusted(req) {
  const address = req.socket?.remoteAddress
  return (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1')
    && !req.headers.forwarded
    && !req.headers['x-forwarded-for']
    && !req.headers['x-real-ip']
}

function send(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function register(ctx, webServer, owner) {
  owner.effect(() => webServer.register({
    kind: 'exact',
    path: TITLE_PATH,
    handler: async (req, res) => {
      if (req.method !== 'GET' || !trusted(req)) {
        send(res, req.method === 'GET' ? 403 : 405, { ok: false, error: 'request rejected' })
        return
      }
      const id = new URL(req.url, 'http://localhost').searchParams.get('sessionId')?.trim() ?? ''
      if (!SESSION_ID.test(id)) {
        send(res, 400, { ok: false, error: 'invalid session id' })
        return
      }
      try {
        const inspected = await ctx.sessionPersistence.readFrom(id, 0)
        const title = lastTitleFromEvents(inspected.events)
        send(res, 200, { ok: true, title })
      } catch (error) {
        send(res, 404, { ok: false, error: 'session not found' })
      }
    },
  }), 'current-title-hydration: read-only title route')
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer) register(ctx, webServer, ctx)
  else ctx.inject(['webServer'], (sub) => register(ctx, sub.webServer, sub))
}

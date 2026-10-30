import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow, EngineInterface, On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// Run on its own, ak-session-id finds no ak-mods: the mod is on (fail-open) and draws its own band.
const HOST = 'local_0a1b2c3d4e5f'
const ENGINE = 'c0ffee00-0000-4000-8000-00000000beef'

const BAND = {
  plugin: 'ak-session-id',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

// The engine beneath the plugin: the two ids, a clipboard, and the toasts. `host` null is a
// session outside the desktop app; `clipboard` false is a surface that cannot copy.
const engine = (on: On, { host = HOST as string | null, clipboard = true } = {}) => {
  const toasts: string[] = []
  const copied: { text: string; surface?: string }[] = []
  let id = ENGINE
  const clock = mock.clock(on, { now: 0 })
  on('session.id', () => ({ value: id }))
  on('env.get', (_, e) => ({ value: e.name === 'CLAUDE_CODE_HOST_SESSION_ID' && host !== null ? host : undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.copy', (_, e) => {
    if (!clipboard) return { value: { isCopied: false, reason: 'no-clipboard' } }
    copied.push(e.surface === undefined ? { text: e.text } : { text: e.text, surface: e.surface })

    return { value: { isCopied: true } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })

  return { clock, toasts, copied, renew: (next: string) => (id = next) }
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

const sessionId = ($: Engine, args = '') =>
  $.command.run({
    command: 'session-id',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

test('/session-id copies the desktop id and says so', async ($, on) => {
  const { toasts, copied } = engine(on)
  await start($)

  const answer = await sessionId($)
  expect(answer.text).toBe(`Copied session id ${HOST}`)
  expect(copied).toEqual([{ text: HOST }])
  expect(toasts).toEqual([`Copied session id ${HOST}`])
})

test('/session-id engine copies the engine id even in the desktop app', async ($, on) => {
  const { copied } = engine(on)
  await start($)

  expect((await sessionId($, 'engine')).text).toBe(`Copied session id ${ENGINE}`)
  expect(copied).toEqual([{ text: ENGINE }])
})

test('outside the desktop app /session-id copies the engine id', async ($, on) => {
  const { copied } = engine(on, { host: null })
  await start($)

  await sessionId($)
  expect(copied).toEqual([{ text: ENGINE }])
})

test('a surface that cannot copy gets the whole id and why', async ($, on) => {
  engine(on, { clipboard: false })
  await start($)

  expect((await sessionId($)).text).toBe(`Session id ${HOST} (not copied: no-clipboard)`)
})

test('an unknown argument copies nothing and names the usage', async ($, on) => {
  const { copied } = engine(on)
  await start($)

  expect((await sessionId($, 'foo')).text).toBe('Usage: /session-id [engine]')
  expect(copied).toEqual([])
})

test('without ak-mods the own band shows the end of the id and copies it on the pressing surface', async ($, on) => {
  const { clock, copied, toasts } = engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: `id …${HOST.slice(-6)}` })).toBeDefined()
    expect((await ui.find({ key: 'session-id' }))?.text).toBe('copy')
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.press({ key: 'session-id' })
    await ui.unmount()
  }
  await clock.settle()
  expect(copied.map(one => one.text)).toEqual([HOST, HOST])
  expect(toasts.at(-1)).toBe(`Copied session id ${HOST}`)
})

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it: declaring switches the
// mod on, the switch lives where ak-mods keeps it, and each published segment comes out as a toast,
// as does the clear ak-mods makes when the mod is switched off. An inline plugin is loaded as a
// module of its own: it names nothing of this file, and reaches the test only through `$`.
const owner: Register = on => {
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const set = async ({ name, on: isOn }: { name: string; on: boolean }) => {
      const held = await built.state.get({ plugin: 'ak-mods', key: 'on' })
      await built.state.set({ plugin: 'ak-mods', key: 'on' }, { ...held.value, [name]: isOn })
      if (!isOn) await built.ui.toast('segment null')
    }

    return {
      ...built,
      mods: {
        declare: async ({ name }: { name: string }) => {
          await set({ name, on: true })

          return true
        },
        isOn: async ({ name }: { name: string }) =>
          (await built.state.get({ plugin: 'ak-mods', key: 'on' })).value?.[name] === true,
        set,
        setStandard: async () => {},
        move: async () => {},
        resetOrder: async () => {},
        isOrderMoved: async () => false,
        list: async () => [],
        segment: async (segment: Segment) => {
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })

  // `/stand-in on|off` is the test's control: the test's `$` carries no plugin's nouns.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    await $.mods.set({ name: 'ak-session-id', on: e.args === 'on' })

    return {}
  })
}

// Named ak-mods: the switches it writes are that plugin's state.
const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): Segment[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)

const standIn = ($: Engine, args: 'on' | 'off') =>
  $.command.run({
    command: 'stand-in',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

const COPY = { label: 'copy', hotkey: 'c', command: 'session-id', isOnText: true }

test('publishes the end of the desktop id with the copy button', OWNED, async ($, on) => {
  const { toasts } = engine(on)
  await start($)

  expect(segments(toasts).at(-1)).toEqual({
    text: `id …${HOST.slice(-6)}`,
    rich: [{ text: 'id', icon: 'id' }, { text: ` …${HOST.slice(-6)}` }],
    compact: { text: `#…${HOST.slice(-4)}`, rich: [{ text: 'id', icon: 'id' }, { text: ` …${HOST.slice(-4)}` }] },
    card: [
      { label: 'Desktop id', value: HOST },
      { label: 'Engine id', value: ENGINE },
    ],
    tone: 'dim',
    priority: 2,
    button: COPY,
  })
})

test('a copy shows a check mark for two seconds, then the id again', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on)
  await start($)

  await sessionId($)
  await clock.advance(10)
  expect(segments(toasts).at(-1)).toMatchObject({
    text: '✓ copied',
    rich: [{ text: 'copied', icon: 'check' }, { text: ' copied' }],
    // Compact, only the icon changes: the same width, so the band keeps its layout.
    compact: { text: `✓…${HOST.slice(-4)}`, rich: [{ text: 'copied', icon: 'check' }, { text: ` …${HOST.slice(-4)}` }] },
  })
  await clock.advance(2100)
  expect(segments(toasts).at(-1)?.text).toBe(`id …${HOST.slice(-6)}`)
})

test('outside the desktop app the card holds the engine id alone', OWNED, async ($, on) => {
  const { toasts } = engine(on, { host: null })
  await start($)

  expect(segments(toasts).at(-1)?.card).toEqual([{ label: 'Engine id', value: ENGINE }])
})

test('draws no band of its own while ak-mods owns the drawing', OWNED, async ($, on) => {
  engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await start($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'session-id' })).toBeUndefined()
  await ui.unmount()
})

test('after a chat ends it publishes the new id once the end has passed', OWNED, async ($, on) => {
  const { clock, toasts, renew } = engine(on, { host: null })
  await start($)
  await clock.settle()
  const before = segments(toasts).length

  renew('aaaaaaaa-0000-4000-8000-000000123456')
  await $.session.end({ reason: 'clear', sessionId: ENGINE, resume: { id: ENGINE } })
  expect(segments(toasts).length).toBe(before)
  await clock.settle()
  expect(segments(toasts).at(-1)?.text).toBe('id …123456')
})

test('switched off it publishes nothing; switched on again it publishes', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on)
  await start($)
  await clock.settle()

  await standIn($, 'off')
  expect(segments(toasts).at(-1)).toBeUndefined()
  await $.session.end({ reason: 'clear', sessionId: ENGINE, resume: { id: ENGINE } })
  await clock.settle()
  expect(segments(toasts).at(-1)).toBeUndefined()

  await standIn($, 'on')
  await clock.settle()
  expect(segments(toasts).at(-1)?.text).toBe(`id …${HOST.slice(-6)}`)
})

test('/session-id turns the mod on when it is off', OWNED, async ($, on) => {
  const { clock, toasts, copied } = engine(on)
  await start($)
  await standIn($, 'off')

  await sessionId($)
  await clock.settle()
  expect(copied).toEqual([{ text: HOST }])
  // Switched on and published: the check mark first, the id once it has been read.
  expect(segments(toasts).at(-1)?.text).toBe('✓ copied')
  await clock.advance(2100)
  expect(segments(toasts).at(-1)?.text).toBe(`id …${HOST.slice(-6)}`)
})

test('with Claude Code set to German, the button and the answer are German', OWNED, async ($, on) => {
  const { toasts } = engine(on)
  on('config.list', () => ({ value: [{ key: 'language', label: 'Language', value: 'German' }] as unknown as ConfigRow[] }))
  await start($)

  expect(segments(toasts).at(-1)?.button).toEqual({ ...COPY, label: 'kopieren' })
  expect((await sessionId($)).text).toBe(`Session-ID ${HOST} kopiert`)
  expect((await sessionId($, 'what')).text).toBe('Aufruf: /session-id [engine]')
})

test('an id that turns current only after the end is published by the next turn', OWNED, async ($, on) => {
  const { clock, toasts, renew } = engine(on, { host: null })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await start($)
  await clock.settle()

  // The end's republish still reads the ended chat's id; the new one turns current after it.
  await $.session.end({ reason: 'clear', sessionId: ENGINE, resume: { id: ENGINE } })
  await clock.settle()
  renew('aaaaaaaa-0000-4000-8000-000000123456')
  await $.turn.start({ turnId: 'T1', text: 'hi' })
  await clock.settle()
  expect(segments(toasts).at(-1)?.text).toBe('id …123456')
})

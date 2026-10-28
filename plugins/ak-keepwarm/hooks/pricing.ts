// Dollars per million tokens: Anthropic's list prices. Cache writes cost 1.25x input on the
// 5-minute TTL and 2x input on the 1-hour TTL. Longer ids come first so that 'opus-5' does not
// swallow 'opus-5-5'. A model with a second rate card for long prompts names it under `long`: it
// applies to a request whose input is over `above` tokens.
type Rates = { input: number; output: number; read: number }
type Price = Rates & { long?: Rates & { above: number } }

const TABLE: readonly (readonly [string, Price])[] = [
  ['fable-5-1', { input: 10, output: 50, read: 0.25 }],
  ['mythos-5-1', { input: 10, output: 50, read: 0.25 }],
  ['fable-5', { input: 10, output: 50, read: 1.0 }],
  ['opus-5-5', { input: 4, output: 20, read: 0.2 }],
  ['opus-5', { input: 5, output: 25, read: 0.5 }],
  ['opus-4-8', { input: 5, output: 25, read: 0.5 }],
  ['opus-4-7', { input: 5, output: 25, read: 0.5 }],
  ['opus-4-6', { input: 5, output: 25, read: 0.5 }],
  ['sonnet-5-5', { input: 2, output: 10, read: 0.2 }],
  ['sonnet-5', { input: 2, output: 10, read: 0.2 }],
  ['sonnet-4-6', { input: 3, output: 15, read: 0.3 }],
  ['haiku-5-5', { input: 0.1, output: 0.5, read: 0.01, long: { above: 100000, input: 0.5, output: 2.5, read: 0.05 } }],
  ['haiku-4-5', { input: 1, output: 5, read: 0.1 }],
]

const FALLBACK: Rates = { input: 4, output: 20, read: 0.2 }

// A model the table does not know is priced by family; an unknown family gets the fallback.
const FAMILY: Record<string, string> = {
  fable: 'fable-5-1',
  mythos: 'mythos-5-1',
  opus: 'opus-5-5',
  sonnet: 'sonnet-5-5',
  haiku: 'haiku-5-5',
}

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

const normalize = (model: string): string =>
  String(model || '')
    .toLowerCase()
    .replace(/^claude-/, '')
    .replace(/\[.*?\]/g, '')
    .replace(/-\d{8}$/, '')
    .trim()

const priceOf = (model: string): Price => {
  const id = normalize(model)
  const hit = TABLE.find(([key]) => id.startsWith(key))
  if (hit) return hit[1]
  const family = Object.keys(FAMILY).find(f => id.includes(f))
  const byFamily = family && TABLE.find(([key]) => key === FAMILY[family])

  return byFamily ? byFamily[1] : FALLBACK
}

/** The rates of a request of `inputTokens` on `model`: its long-prompt card past that card's size. */
export const priceFor = (model: string, inputTokens = 0): Rates => {
  const price = priceOf(model)

  return price.long && inputTokens > price.long.above ? price.long : price
}

const writeRate = (model: string, ttlMinutes: number, inputTokens: number): number =>
  priceFor(model, inputTokens).input * (ttlMinutes >= 60 ? 2 : 1.25)

export const requestCost = (usage: Usage, model: string, ttlMinutes: number): number => {
  const total = totalInput(usage)
  const p = priceFor(model, total)

  return (
    ((usage.input_tokens || 0) * p.input +
      (usage.cache_read_input_tokens || 0) * p.read +
      (usage.cache_creation_input_tokens || 0) * writeRate(model, ttlMinutes, total) +
      (usage.output_tokens || 0) * p.output) /
    1e6
  )
}

export const rewriteCost = (tokenCount: number, model: string, ttlMinutes: number): number =>
  ((tokenCount || 0) * writeRate(model, ttlMinutes, tokenCount || 0)) / 1e6

export const totalInput = (usage: Usage): number =>
  (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)

// Share of a request's input served from the cache, 0 to 1.
export const cachedShare = (usage: Usage): number => {
  const total = totalInput(usage)

  return total > 0 ? (usage.cache_read_input_tokens || 0) / total : 0
}

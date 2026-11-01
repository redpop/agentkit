import { clean, numbered } from './list'
import type { TodoList } from './list'

// The most items one answer adds.
const MAX_DETECTED = 5

/** The detection call's instruction. */
export const DETECT_SYSTEM = [
  "You read one answer of a coding assistant and list what it leaves open: work it defers or sets",
  'aside, and questions it leaves for the user. Skip what the list already holds and what the answer',
  'finished. Reply with a JSON array of at most 5 short strings, each one line under 100 characters,',
  'and nothing else; [] when there is nothing.',
].join(' ')

/** The answer, then the list's entries the detection must not repeat. */
export const detectPrompt = (answer: string, list: TodoList): string => {
  const { tasks, notes } = numbered(list)
  const known = [...tasks, ...notes].map(n => `- ${n.entry.text}`)

  return [`Answer:\n${answer}`, known.length > 0 ? `Already on the list (skip these):\n${known.join('\n')}` : ''].filter(Boolean).join('\n\n')
}

/** The strings of the JSON array in the reply, cleaned, at most 5; none for anything else. */
export const parseDetected = (reply: string): string[] => {
  const match = /\[[\s\S]*\]/.exec(reply)
  if (!match) return []
  let value: unknown
  try {
    value = JSON.parse(match[0])
  } catch {
    return []
  }
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return []

  return value.map(clean).filter(text => text !== '').slice(0, MAX_DETECTED)
}

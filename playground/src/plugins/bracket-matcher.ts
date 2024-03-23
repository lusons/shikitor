import { definePlugin } from '../editor'

const bracketMap: Record<string, string | undefined> = {
  '(': ')',
  '[': ']',
  '{': '}',
  ')': '(',
  ']': '[',
  '}': '{'
}
const lBrackets = ['(', '[', '{']

const name = 'shikitor-bracket-matcher'
export default definePlugin({
  name,
  onCursorChange(cursor) {
    const value = this.value
    const prev = value[cursor.offset - 1]
    const next = value[cursor.offset]

    const prevBracket = bracketMap[prev]
    const nextBracket = bracketMap[next]
    const relativeBracket = prevBracket || nextBracket
    let newDecorations = [
      ...(this.options.decorations ?? [])
        .filter(d => !d.tagName?.includes(name))
    ]
    if (relativeBracket) {
      const bracket = prevBracket ? prev : next

      const bracketOffset = prevBracket
        ? cursor.offset - 1
        : cursor.offset
      newDecorations.push({
        start: bracketOffset,
        end: bracketOffset + 1,
        tagName: `shikitor-bg-lighting ${name}`
      })
      const increase = lBrackets.includes(relativeBracket) ? -1 : 1
      const stack = []
      // TODO `console.log(")")`
      for (let i = bracketOffset + increase; ; i += increase) {
        if (i < 0 || i >= value.length) {
          break
        }
        const char = value[i]
        if (char === bracket) {
          stack.push(char)
        }
        if (char === relativeBracket) {
          if (stack.length === 0) {
            newDecorations.push({
              start: i,
              end: i + 1,
              tagName: `shikitor-bg-lighting ${name}`
            })
            break
          }
          stack.pop()
        }
      }
    } else {
      newDecorations = []
    }
    this.updateOptions({ decorations: newDecorations })
  }
})

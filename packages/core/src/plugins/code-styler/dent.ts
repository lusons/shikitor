export interface DentOptions {
  /**
   * Number of spaces to insert when pressing the Tab key.
   */
  tabSize?: number
  /**
   * Whether to insert spaces when pressing the Tab key.
   */
  insertSpaces?: boolean
}

interface ReplacementRangeText {
  replacement: string
  range: [start: number, end: number]
  selection: [start: number, end: number]
  selectionMode?: SelectionMode
}

function updateSelection(
  text: string,
  [start, end]: [start: number, end: number],
  padding: number,
  {
    replacement,
    range,
    selectionMode
  }: Omit<ReplacementRangeText, 'selection'>
): [number, number] {
  const originalLength = range[1] - range[0]
  const newLength = replacement.length
  const insertCharCount = newLength - originalLength
  const newEndOffset = end + insertCharCount
  if (start === end) {
    if (newEndOffset < 0) {
      if (start === 0 || text[start - 1] === '\n')
        return [start, start]
      else
        return [0, 0]
    }
    return [newEndOffset, newEndOffset]
  }

  const firstLine = getLine(text, start)
  const firstLineForReplacement = getLine(replacement, 0)
  let firstLineInsertCharCount
  if (selectionMode === 'select') {
    firstLineInsertCharCount = firstLineForReplacement.length - firstLine.length
  } else {
    if (insertCharCount < 0) {
      firstLineInsertCharCount = firstLineForReplacement.length - firstLine.length
    } else {
      firstLineInsertCharCount = padding
    }
  }
  return [
    Math.max(start + firstLineInsertCharCount, 0),
    Math.max(newEndOffset, 0)
  ]
}

export function indent(
  text: string,
  selection: [start: number, end?: number],
  options: DentOptions = {}
): ReplacementRangeText {
  const [start, end = start] = selection
  const {
    tabSize = 2,
    insertSpaces = true
  } = options
  const valueLength = text.length

  const [
    startLineOffset, endLineOffset
  ] = [
    getLineStart(text, start), getLineEnd(text, end)
  ]

  const startAtLineStart = start === 0 || text[start - 1] === '\n'
  const endAtLineEnd = end === valueLength || text[end] === '\n' || text[end] === '\r'
  const selectBothEnds = start !== end && startAtLineStart && endAtLineEnd

  const item = insertSpaces
    ? ' '.repeat(tabSize)
    : '\t'
  const insertStrItemLength = item.length

  let replacement: string
  let range: [number, number]
  let selectionMode: SelectionMode
  let padding = insertStrItemLength
  if (selectBothEnds || start !== end) {
    replacement = text
      .slice(startLineOffset, endLineOffset)
      .replaceAll(/^[ \t]*/gm, (leading, offset, str) => {
        if (str[offset] === '\n' || str[offset] === '\r' || offset === endLineOffset) return leading

        const tabCount = 1 + ~~(countLeadingSpaces(leading, 0, tabSize) / tabSize)
        return item.repeat(tabCount)
      })
    range = [startLineOffset, endLineOffset]
    selectionMode = 'select'
  } else {
    replacement = '\t'
    range = [start, end]
    selectionMode = 'end'
    if (insertSpaces) {
      padding = tabSize - ((start - startLineOffset) % tabSize)
      replacement = ' '.repeat(padding)
    }
  }

  return {
    replacement, range,
    selection: updateSelection(text, [start, end], padding, {
      replacement,
      range,
      selectionMode
    }),
    selectionMode
  }
}

export function outdent(
  text: string,
  selection: [start: number, end?: number],
  options: DentOptions = {}
): ReplacementRangeText {
  const [start, end = start] = selection
  const {
    tabSize = 2,
    insertSpaces = true
  } = options
  const valueLength = text.length
  const item = insertSpaces
    ? ' '.repeat(tabSize)
    : '\t'
  const insertStrItemLength = item.length

  const [
    startLineOffset, endLineOffset
  ] = [
    getLineStart(text, start), getLineEnd(text, end)
  ]

  const startAtLineStart = start === 0 || text[start - 1] === '\n'
  const endAtLineEnd = end === valueLength || text[end] === '\n' || text[end] === '\r'
  const selectBothEnds = start !== end && startAtLineStart && endAtLineEnd

  const selectLinesContent = text.slice(startLineOffset, endLineOffset)
  const replacement = selectLinesContent.replaceAll(/^[ \t]*/gm, (leading) => {
    // TODO https://t.me/c/1066867565/1736194
    const leadingSpaces = countLeadingSpaces(leading, 0, tabSize) - tabSize
    const tabCount = ~~(leadingSpaces / tabSize)
    const tabCountRemainder = leadingSpaces % tabSize
    const tabCountRemainderSpaces = tabCountRemainder < 1
      ? ''
      : ' '.repeat(tabCountRemainder)
    if (tabCount <= 0) return tabCountRemainderSpaces

    return item.repeat(tabCount) + tabCountRemainderSpaces
  })
  if (replacement === selectLinesContent) throw new Error('No outdent')

  const range: [number, number] = [startLineOffset, endLineOffset]
  let selectionMode: SelectionMode
  if (selectBothEnds || start !== end) {
    selectionMode = 'select'
  } else {
    selectionMode = 'end'
  }

  return {
    replacement, range,
    selection: updateSelection(text, [start, end], insertStrItemLength, {
      replacement,
      range
    }),
    selectionMode
  }
}

export function getLineStart(value: string, index: number) {
  while (index > 0 && value[index - 1] !== '\n') {
    index--
  }
  return index
}

export function getLineEnd(value: string, index: number) {
  if (index > 0 && value[index - 1] === '\n') {
    return index - 1
  }

  while (index < value.length && value[index] !== '\n' && value[index] !== '\r') {
    index++
  }
  return index
}

export function getLine(value: string, index: number) {
  return value.slice(getLineStart(value, index), getLineEnd(value, index))
}

export function countLeadingSpaces(value: string, start: number, tabSize: number) {
  let count = 0
  for (let i = start; i < value.length; i++) {
    if (value[i] === ' ') {
      count++
    } else if (value[i] === '\t') {
      count += tabSize
    } else {
      break
    }
  }

  return count
}
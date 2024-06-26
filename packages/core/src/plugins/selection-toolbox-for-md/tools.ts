import type { ResolvedTextRange } from '../../base'
import type { Shikitor } from '../../editor'
import type { ToolInner } from '../provide-selection-toolbox'

// TODO move cursor near when update selection

export const NoToolsError = new Error('No tools provided')

export function headingSelectTool(
  shikitor: Shikitor,
  selectionText: string,
  selection: ResolvedTextRange,
  lineText: string,
  lineStartOffset: number
): ToolInner & { type?: 'select' } {
  const headingCount = (lineText.match(/^#+ /)?.[0].length ?? 1) - 1
  return {
    type: 'select',
    disabled: selectionText.includes('\n'),
    activatable: true,
    prefixIcon: headingCount === 0 ? 'text_fields' : `format_h${headingCount}`,
    options: [
      { label: 'Normal', icon: 'text_fields', value: 'p', activated: headingCount === 0 },
      { label: 'Heading 1', icon: 'format_h1', value: 'h1', activated: headingCount === 1 },
      { label: 'Heading 2', icon: 'format_h2', value: 'h2', activated: headingCount === 2 },
      { label: 'Heading 3', icon: 'format_h3', value: 'h3', activated: headingCount === 3 },
      { label: 'Heading 4', icon: 'format_h4', value: 'h4', activated: headingCount === 4 },
      { label: 'Heading 5', icon: 'format_h5', value: 'h5', activated: headingCount === 5 },
      { label: 'Heading 6', icon: 'format_h6', value: 'h6', activated: headingCount === 6 }
    ],
    async onSelect(value) {
      if (!value) return
      if (value === 'p') {
        await shikitor.setRangeText({
          start: lineStartOffset,
          end: lineStartOffset + headingCount + 1
        }, '')
        shikitor.updateSelection(0, {
          start: selection.start.offset - headingCount - 1,
          end: selection.end.offset - headingCount - 1
        })
      } else {
        const repeatCount = Number(value.slice(1))
        const crease = repeatCount - headingCount
        await shikitor.setRangeText({
          start: lineStartOffset,
          end: lineStartOffset + headingCount + (
            headingCount === 0 ? 0 : 1
          )
        }, `${'#'.repeat(repeatCount)} `)
        shikitor.updateSelection(0, {
          start: selection.start.offset + crease + (
            headingCount === 0 ? 1 : 0
          ),
          end: selection.end.offset + crease + (
            headingCount === 0 ? 1 : 0
          )
        })
      }
    }
  }
}

function getRangeLines(
  shikitor: Shikitor,
  range: ResolvedTextRange
) {
  const lines = [] as [number, string][]
  for (let line = range.start.line; line <= range.end.line; line++) {
    lines.push([
      line,
      shikitor.rawTextHelper.line({
        line,
        character: 1
      })
    ])
  }
  return lines
}

export function quoteTool(
  shikitor: Shikitor,
  range: ResolvedTextRange
) {
  const lines = getRangeLines(shikitor, range)
  // when all lines are quoted, unquote them
  const activated = lines.every(([, text]) => text.startsWith('> '))
  return {
    type: 'toggle',
    activated,
    icon: 'format_quote',
    async onToggle() {
      if (activated) {
        for await (const [line, text] of lines) {
          await shikitor.setRangeText(
            shikitor.rawTextHelper.resolveTextRange({
              start: { line, character: 0 },
              end: { line, character: text.length }
            }),
            text.slice(2)
          )
        }
        shikitor.updateSelection(0, {
          start: range.start.offset - 2,
          end: range.end.offset - lines.length * 2
        })
      } else {
        for await (const [line, text] of lines) {
          await shikitor.setRangeText(
            shikitor.rawTextHelper.resolveTextRange({
              start: { line, character: 0 },
              end: { line, character: text.length }
            }),
            `> ${text}`
          )
        }
        shikitor.updateSelection(0, {
          start: range.start.offset + 2,
          end: range.end.offset + lines.length * 2
        })
      }
    }
  } satisfies ToolInner
}

export function linkTool(
  shikitor: Shikitor,
  selectionText: string,
  range: ResolvedTextRange
) {
  const { start, end } = range
  const value = shikitor.value
  let activated = false
  let textStart = -1
  for (let i = start.offset; i >= 0; i--) {
    if (value[i] === '\n' || value[i] === '\r') break
    if (value[i] === '[') {
      textStart = i + 1
      break
    }
  }
  let textEnd = -1
  let linkEnd = -1
  if (textStart !== -1) {
    a: for (
      let i = textStart;
      i < value.length;
      i++
    ) {
      if (value[i] === '\n' || value[i] === '\r') break
      if (value.slice(i, i + ']('.length) === '](') {
        textEnd = i
        for (let j = i + 2; j < value.length; j++) {
          if (value[j] === '\n' || value[j] === '\r') break
          if (value[j] === ')') {
            linkEnd = j
            activated = true
            break a
          }
        }
      }
    }
  }
  // [a](bcd)
  //    ^^^^^
  // don't support tools in this case
  if (activated && start.offset >= textEnd && end.offset <= linkEnd) {
    throw NoToolsError
  }

  const text = activated
    ? value.slice(textStart, textEnd)
    : selectionText
  return {
    type: 'toggle',
    activated,
    icon: 'link',
    async onToggle() {
      if (!activated) {
        await shikitor.setRangeText(range, `[${text}]()`)
        shikitor.updateSelection(0, {
          start: range.start.offset + 1,
          end: range.end.offset + 1
        })
      } else {
        await shikitor.setRangeText({
          start: textStart - 1,
          end: linkEnd + 1
        }, text)
        shikitor.updateSelection(0, {
          start: textStart - 1,
          end: textEnd - 1
        })
      }
    }
  } satisfies ToolInner
}

export function formatTool(
  prefix: string,
  suffix: string,
  shikitor: Shikitor,
  selectionText: string,
  range: ResolvedTextRange,
  tool: Omit<ToolInner & { type?: 'toggle' }, 'type'>
) {
  const { start, end } = range
  const value = shikitor.value
  let activated = false
  let textStart = -1
  for (let i = start.offset; i >= 0; i--) {
    if (value[i] === '\n' || value[i] === '\r') break
    if (value.slice(i, i + prefix.length) === prefix) {
      textStart = i + prefix.length
      break
    }
  }
  let textEnd = -1
  if (textStart !== -1) {
    for (
      let i = Math.max(
        end.offset - suffix.length,
        start.offset
      );
      i < value.length;
      i++
    ) {
      if (value[i] === '\n' || value[i] === '\r') break
      if (value.slice(i, i + suffix.length) === suffix) {
        textEnd = i
        activated = true
        break
      }
    }
  }
  const text = activated
    ? value.slice(textStart, textEnd)
    : selectionText
  return {
    ...tool,
    type: 'toggle',
    activated,
    onToggle() {
      if (!activated) {
        shikitor.setRangeText(range, `${prefix}${text}${suffix}`)
        shikitor.updateSelection(0, {
          start: range.start.offset + prefix.length,
          end: range.end.offset + prefix.length
        })
      } else {
        shikitor.setRangeText({
          start: textStart - prefix.length,
          end: textEnd + suffix.length
        }, text)
        shikitor.updateSelection(0, {
          start: textStart - prefix.length,
          end: textEnd - prefix.length
        })
      }
    }
  } satisfies ToolInner
}

export function listFormatTool(
  shikitor: Shikitor,
  selectionText: string,
  range: ResolvedTextRange
) {
  const lines = getRangeLines(shikitor, range)
  let activeIcon: string | undefined
  if (lines.every(([, text]) => text.match(/^\s*[-+*] (?!\[[ x]]\s)/)?.[0])) {
    activeIcon = 'format_list_bulleted'
  }
  if (lines.every(([, text]) => text.match(/^\s*\d+\. (?!\[[ x]]\s)/)?.[0])) {
    activeIcon = 'format_list_numbered'
  }
  if (lines.every(([, text]) => text.match(/^\s*([-+*]|\d+\.) \[[ x]] /)?.[0])) {
    activeIcon = 'checklist'
  }
  return {
    type: 'select',
    direction: 'row',
    prefixIcon: activeIcon ?? 'format_list_bulleted',
    noMoreIcon: true,
    options: [
      {
        icon: 'format_list_bulleted',
        value: 'ul',
        activated: activeIcon === 'format_list_bulleted'
      },
      {
        icon: 'format_list_numbered',
        value: 'ol',
        activated: activeIcon === 'format_list_numbered'
      },
      {
        icon: 'checklist',
        value: 'task',
        activated: activeIcon === 'checklist'
      }
    ],
    async onSelect(value) {
      switch (value) {
        case 'ul': {
          if (!activeIcon) {
            let firstStartOffset: number | undefined
            for await (const [line, text] of lines) {
              let spaces = text.match(/^\s*/)![0]
              if (spaces.length === text.length) {
                spaces = ''
              }
              const pos = shikitor.rawTextHelper.resolveTextRange({
                start: { line, character: spaces.length },
                end: { line, character: spaces.length }
              })
              if (firstStartOffset === undefined) {
                firstStartOffset = pos.start.offset
              }
              // TODO configurable
              await shikitor.setRangeText(pos, '- ')
            }
            shikitor.updateSelection(0, {
              start: firstStartOffset! > range.start.offset
                ? firstStartOffset! + 2
                : range.start.offset + 2,
              end: range.end.offset + lines.length * 2
            })
          } else {
            alert('Unimplemented')
            // TODO
          }
          break
        }
        case 'ol': {
          alert('Unimplemented')
          // TODO
          break
        }
        case 'task': {
          alert('Unimplemented')
          // TODO
          break
        }
      }
    }
  } satisfies ToolInner
}

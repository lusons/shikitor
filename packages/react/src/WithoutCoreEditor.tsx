import type { Shikitor } from '@shikitor/core'
import type { create } from '@shikitor/core'
import React, { forwardRef, useCallback, useEffect, useRef } from 'react'

import type { EditorProps, EditorRef } from './type'

export interface WithoutCoreEditorProps extends EditorProps {
  create?: typeof create
}

export const WithoutCoreEditor = forwardRef<
  EditorRef, WithoutCoreEditorProps
>(function WithoutCoreEditor(props, ref) {
  const {
    options,
    defaultOptions,
    create,
    onMounted,
    onColorChange
  } = props
  const mount = useCallback((shikitor: Shikitor) => {
    shikitorRef.current = shikitor
    if (ref) {
      if (typeof ref === 'function') {
        ref(shikitor)
      } else {
        ref.current = shikitor
      }
    }
    onMounted?.(shikitor)
  }, [onMounted, ref])

  const defaultOptionsRef = useRef(defaultOptions)
  const initialOptionsRef = useRef(Object.assign({}, defaultOptions, options))
  const shikitorRef = useRef<Shikitor | null>(null)
  const eleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initialOptionsRef.current = Object.assign({}, defaultOptionsRef.current, options)
  }, [options])
  useEffect(() => {
    if (!eleRef.current) return
    const ele = eleRef.current

    const observer = new MutationObserver(mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.attributeName === 'style') {
          const bg = getComputedStyle(ele).backgroundColor
          const fg = getComputedStyle(ele).color
          onColorChange?.({ bg, fg })
        }
      }
    })
    observer.observe(ele, { attributes: true, attributeFilter: ['style'] })
    const abortController = new AbortController()
    const abortSignal = abortController.signal
    create?.(ele, initialOptionsRef.current, { abort: abortSignal })
      .then(mount)
      .catch(e => {
        if (e instanceof Error && e.message === 'Aborted') return
        console.error(e)
      })
    return () => {
      abortController.abort()
      shikitorRef.current?.[Symbol.dispose]()
    }
  }, [create, mount, onColorChange])
  useEffect(() => {
    const shikitor = shikitorRef.current
    if (!shikitor) return

    options && shikitor.updateOptions(options)
  }, [options])
  return <div ref={eleRef} />
})
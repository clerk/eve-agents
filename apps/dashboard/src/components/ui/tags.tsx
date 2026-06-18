'use client'

import * as React from 'react'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'

export type TagsProps = {
  /** The selected values. */
  value: string[]
  /** Called with the next selection. */
  onValueChange: (value: string[]) => void
  /** Selectable options shown in the dropdown. */
  options?: string[]
  /** Allow typing a value that isn't in `options` (Enter or the Create row). */
  creatable?: boolean
  placeholder?: string
  emptyText?: string
  /**
   * Portal target for the popup. Pass a ref to an element inside a modal Dialog
   * so the popup stays clickable (a modal blocks pointer events outside its
   * subtree). Omit outside dialogs.
   */
  container?: React.RefObject<HTMLElement | null>
}

/**
 * Tags is a multi-select tag input built on the combobox. Use it for free-form,
 * creatable sets (permissions, labels) or a fixed list of options (task names).
 */
export function Tags({
  value,
  onValueChange,
  options = [],
  creatable = false,
  placeholder,
  emptyText = 'No matches.',
  container,
}: TagsProps) {
  const anchor = useComboboxAnchor()
  const [query, setQuery] = React.useState('')

  // Options plus any selected values not in `options` (e.g. created ones), so
  // every selected chip also exists as a list item.
  const items = React.useMemo(
    () => [...new Set([...options, ...value])],
    [options, value]
  )

  const trimmed = query.trim()
  const canCreate =
    creatable &&
    trimmed.length > 0 &&
    !items.some(i => i.toLowerCase() === trimmed.toLowerCase())

  const create = () => {
    if (!canCreate) return
    onValueChange([...value, trimmed])
    setQuery('')
  }

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      onValueChange={next => {
        onValueChange(next as string[])
        setQuery('')
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map(item => (
                <ComboboxChip key={item}>{item}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={placeholder}
                onKeyDown={e => {
                  if (e.key === 'Enter' && canCreate) {
                    e.preventDefault()
                    create()
                  }
                }}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor} container={container}>
        {!canCreate && <ComboboxEmpty>{emptyText}</ComboboxEmpty>}
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
        {canCreate && (
          <div className="border-t p-1">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={create}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              Create
              <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
            </button>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  )
}

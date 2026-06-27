import { beforeEach, describe, expect, it } from 'vitest'
import { useTablePrefs } from './tablePrefs'

const emptyPrefs = { order: [], hidden: [], sizing: {} }

// Mirrors how ResourceTable reads prefs: byKind[kind], defaulting to empty.
const prefsOf = (kind: string) => useTablePrefs.getState().byKind[kind] ?? emptyPrefs

function reset() {
  localStorage.clear()
  useTablePrefs.setState({ byKind: {} })
}

describe('useTablePrefs', () => {
  beforeEach(reset)

  it('returns empty defaults for unknown kinds', () => {
    expect(prefsOf('Pod')).toEqual(emptyPrefs)
  })

  it('persists order, hidden and sizing per kind', () => {
    const { setOrder, setHidden, setSizing } = useTablePrefs.getState()
    setOrder('Pod', ['name', 'status'])
    setHidden('Pod', ['age'])
    setSizing('Pod', { name: 200 })

    const prefs = prefsOf('Pod')
    expect(prefs.order).toEqual(['name', 'status'])
    expect(prefs.hidden).toEqual(['age'])
    expect(prefs.sizing).toEqual({ name: 200 })
  })

  it('persists sorting per kind and distinguishes unset from cleared', () => {
    const { setSorting } = useTablePrefs.getState()
    setSorting('Pod', [{ id: 'age', desc: true }])
    expect(prefsOf('Pod').sorting).toEqual([{ id: 'age', desc: true }])
    // An unknown kind has no sorting key, so the view falls back to its default sort.
    expect(prefsOf('Service').sorting).toBeUndefined()
    // An explicit clear persists as an empty array, distinct from unset.
    setSorting('Pod', [])
    expect(prefsOf('Pod').sorting).toEqual([])
  })

  it('keeps kinds isolated from each other', () => {
    useTablePrefs.getState().setOrder('Pod', ['a', 'b'])
    useTablePrefs.getState().setOrder('Service', ['x'])

    expect(prefsOf('Pod').order).toEqual(['a', 'b'])
    expect(prefsOf('Service').order).toEqual(['x'])
  })

  it('reset removes prefs for a single kind only', () => {
    useTablePrefs.getState().setOrder('Pod', ['a'])
    useTablePrefs.getState().setOrder('Service', ['x'])

    useTablePrefs.getState().reset('Pod')

    expect(prefsOf('Pod')).toEqual(emptyPrefs)
    expect(prefsOf('Service').order).toEqual(['x'])
  })

  it('writes through zustand/persist to localStorage', () => {
    useTablePrefs.getState().setOrder('Pod', ['name'])
    const raw = localStorage.getItem('klustr.tablePrefs')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? '{}') as { state: { byKind: Record<string, unknown> } }
    expect(parsed.state.byKind.Pod).toMatchObject({ order: ['name'] })
  })
})

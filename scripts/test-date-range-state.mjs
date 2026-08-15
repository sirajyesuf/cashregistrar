/**
 * Simulates dashboard date-range state to verify deselect behavior.
 * Run: node scripts/test-date-range-state.mjs
 */

function handleRangeChange(state, range) {
  const next = { ...state, preset: "custom" }
  if (!range?.from) {
    next.pendingRange = undefined
    next.from = ""
    next.to = ""
    return next
  }
  if (!range.to) {
    next.pendingRange = range
    return next
  }
  next.pendingRange = undefined
  next.from = formatDate(range.from)
  next.to = formatDate(range.to)
  return next
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

function selectedRange(state) {
  const applied =
    state.from || state.to
      ? {
          from: state.from ? new Date(state.from + "T00:00:00Z") : undefined,
          to: state.to ? new Date(state.to + "T00:00:00Z") : undefined,
        }
      : undefined
  return state.pendingRange ?? applied
}

let state = {
  preset: "today",
  from: "2026-08-15",
  to: "2026-08-15",
  pendingRange: undefined,
}

console.log("Initial selected:", fmt(selectedRange(state)))

// User clicks same day to deselect (react-day-picker sends undefined)
state = handleRangeChange(state, undefined)
const afterDeselect = selectedRange(state)
console.log("After deselect attempt:", fmt(afterDeselect))
console.log(
  "BUG:",
  afterDeselect?.from ? "selection still visible (from/to not cleared)" : "deselect works"
)

function fmt(range) {
  if (!range?.from) return "empty"
  const f = range.from.toISOString().slice(0, 10)
  const t = range.to?.toISOString().slice(0, 10) ?? "?"
  return `${f} – ${t}`
}

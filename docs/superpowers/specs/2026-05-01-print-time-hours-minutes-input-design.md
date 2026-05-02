# Print Time Hours/Minutes Split Input

**Date:** 2026-05-01

## Summary

Replace the single `printTimeMinutes` number input with two adjacent inputs (`h` + `min`) in both the Add Model form and the Edit Model parts table. The DB and API remain unchanged — storage and calculations continue to use total minutes.

## Scope

- `frontend/src/pages/dashboard/Models.tsx` only
- No backend, DB, or API changes

## UI Changes

### Add Model Form

Replace:
```
<Input label="Print Time (minutes)" ... value={addForm.printTimeMinutes} />
```

With two inputs side by side:
- `[__] h` — integer, min 0
- `[__] min` — integer, 0–59

State shape changes from `printTimeMinutes: string` to `printTimeHours: string, printTimeMinutesRemainder: string`.

On submit: `parseFloat(printTimeHours || '0') * 60 + parseFloat(printTimeMinutesRemainder || '0')` → sent as `printTimeMinutes`.

On .3mf parse result populate: convert `result.printTimeMinutes` → hours + remainder.

### Edit Model Parts Table

Each part row currently has a single `printTimeMinutes` input.

Replace with two inputs per part row: `h` and `min`.

Part form state changes from `printTimeMinutes: string` to `printTimeHours: string, printTimeMinutesRemainder: string`.

On save: reduce parts → `hours * 60 + minutes` per part → `printTimeMinutes` sent to API.

On load (from API or .3mf parse): convert minutes → hours + remainder.

## Conversion Helpers (frontend only)

```ts
function minutesToHoursAndMins(totalMinutes: number): { hours: number; mins: number } {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return { hours: h, mins: m };
}

function hoursAndMinsToMinutes(hours: string, mins: string): number {
  return (parseFloat(hours) || 0) * 60 + (parseFloat(mins) || 0);
}
```

## Display (no change)

`formatTime(model.printTimeMinutes)` in the model list and cost summary continues to work as-is since it reads from the API response (total minutes).

## Constraints

- `min` field: integer, 0–59
- `h` field: integer, 0+
- Both default to `0` / empty string
- On .3mf file parse result, pre-fill the split fields from `parseResult.printTimeMinutes`

## Out of Scope

- No DB migration
- No API changes
- No changes to `formatTime` display helper
- No changes to `recalc.ts`

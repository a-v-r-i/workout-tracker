/**
 * planner.js — turns routine data + the user's history into a concrete workout.
 *
 * Pure functions only. No DOM, no storage, no imports beyond the data file, so
 * this module runs in Node for testing:
 *
 *   node --input-type=module -e "import('./js/planner.js').then(m => console.log(m.validateData()))"
 *
 * The one export the rest of the app really cares about is resolveWorkout().
 * Its ResolvedItem shape is a contract shared with js/views/workout.js — see
 * the block comment above resolveItem() before changing a field.
 */

import {
  EXERCISES,
  ROUTINES,
  PAIN_THRESHOLDS,
  CARDIO_FOCUS_STRENGTH_POOL,
} from '../data/routines.js';

/** Keys on a routine item that steer the planner rather than describe the set. */
const CONTROL_KEYS = new Set(['ex', 'day', 'slot']);

const AXIAL_NOTICE = 'Substituted (skip axial loading)';

const DEFAULT_INTENSITIES = ['easy', 'moderate', 'intervals', 'hard'];

/* ------------------------------------------------------------ pain check-in */

/**
 * Map a 0-10 pain score to a suggested session shape.
 *
 * Nothing here is a rule: Home pre-selects the suggestion and lets the user
 * override it in one tap. The copy is deliberately gentle, because the person
 * reading it is having a bad back day and does not need to be scolded.
 *
 * @param {number|null} painLevel
 * @returns {{variant: 'regular'|'pain', stretchOnly: boolean, message: string}}
 */
export function suggestVariant(painLevel) {
  const p = Number(painLevel);
  if (!Number.isFinite(p)) {
    return { variant: 'regular', stretchOnly: false, message: 'Pick a number when you are ready.' };
  }
  const pain = Math.max(0, Math.min(10, p));

  if (pain >= PAIN_THRESHOLDS.suggestStretchOnly) {
    return {
      variant: 'pain',
      stretchOnly: true,
      message: 'Today sounds rough. Stretching alone is plenty, and it still counts.',
    };
  }
  if (pain >= PAIN_THRESHOLDS.suggestPainVariant) {
    return {
      variant: 'pain',
      stretchOnly: false,
      message: 'Rough day. Easy cardio and stretches instead?',
    };
  }
  if (pain >= 4) {
    // ROUTINES.md treats 4-5 as the grey zone. A regular session is fine here,
    // just steered toward machines and away from anything that loads the spine.
    return {
      variant: 'regular',
      stretchOnly: false,
      message: 'A bit sore. A regular session is fine, favor machines and skip the axial work.',
    };
  }
  if (pain >= 2) {
    return {
      variant: 'regular',
      stretchOnly: false,
      message: 'Mild today. Train as normal and keep listening as you go.',
    };
  }
  return {
    variant: 'regular',
    stretchOnly: false,
    message: 'Back is quiet today. Good day to train.',
  };
}

/* ------------------------------------------------------------------ picker */

/**
 * Routine metadata for the Home session picker. No exercises resolved, so this
 * is cheap enough to call on every render.
 * @returns {Array<{id:string,name:string,kind:string,estMinutes:number,description:string}>}
 */
export function getRoutines() {
  return ROUTINES.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    estMinutes: r.estMinutes,
    description: r.description || '',
  }));
}

/* ------------------------------------------------------------ alternatives */

/**
 * The swap list for one exercise, as full definitions ready to render.
 * With "skip axial loading" on, axial alternatives are filtered out rather than
 * shown and refused.
 *
 * @param {string} exerciseId
 * @param {{settings?: object}} [opts]
 * @returns {Array<object>} [{ id, name, type, ... }]
 */
export function getAlternatives(exerciseId, { settings } = {}) {
  const def = EXERCISES[exerciseId];
  if (!def) return [];
  const noAxial = !!(settings && settings.noAxialLoading);
  return (def.alternatives || [])
    .filter((id) => EXERCISES[id])
    .filter((id) => !(noAxial && EXERCISES[id].axialLoading))
    .map((id) => Object.assign({ id }, EXERCISES[id]));
}

/* --------------------------------------------------------------- resolution */

function firstNonAxialAlternative(def) {
  for (const id of def.alternatives || []) {
    const alt = EXERCISES[id];
    if (alt && !alt.axialLoading) return id;
  }
  return null;
}

function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return null;
}

/**
 * Resolve one routine item into a ResolvedItem.
 *
 * FROZEN CONTRACT — js/views/workout.js reads exactly these fields:
 *   uid, exerciseId, swappedFrom, name, type, measure, perSide,
 *   sets, reps, weight, holdSec, durationMin, intensities,
 *   weightStep, axialLoading, cues, alternatives, notice
 *
 * Order of operations:
 *   1. routine item overrides sit on top of the exercise defaults
 *   2. a saved preferredSwap replaces the exercise (records swappedFrom)
 *   3. "skip axial loading" substitutes the first non-axial alternative
 *      (records swappedFrom + notice); with no non-axial option the item is
 *      dropped, which validateData() exists to make impossible
 *   4. prefill sets/reps/weight from what was logged last time
 *
 * perSide items are NOT expanded here. The workout player splits them into a
 * left and a right leg at run time so the uid stays stable.
 *
 * @returns {object|null} null means "drop this item"
 */
function resolveItem(raw, uid, ctx) {
  const originalId = raw.ex;
  let id = originalId;
  let def = EXERCISES[id];
  if (!def) return null;

  let swappedFrom = null;
  let notice = null;

  // 2. user's remembered preference for this slot
  const preferred = ctx.exerciseState[id] && ctx.exerciseState[id].preferredSwap;
  if (preferred && EXERCISES[preferred] && preferred !== id) {
    swappedFrom = originalId;
    id = preferred;
    def = EXERCISES[id];
  }

  // 3. axial-loading substitution
  if (ctx.noAxial && def.axialLoading) {
    const altId = firstNonAxialAlternative(def);
    if (!altId) return null;
    swappedFrom = originalId;
    id = altId;
    def = EXERCISES[id];
    notice = AXIAL_NOTICE;
  }

  // 1. overrides: everything on the routine item that is not a control key
  const over = {};
  for (const [k, v] of Object.entries(raw)) if (!CONTROL_KEYS.has(k)) over[k] = v;

  const defaults = def.defaults || {};
  const state = ctx.exerciseState[id] || {};
  const isCardio = (over.type || def.type) === 'cardio';

  // 4. prefill. Overrides win (they carry the session's prescription, e.g. two
  // sets on a short day); history wins over the generic starting numbers.
  const sets = pick(over.sets, state.lastSetCount, defaults.sets);
  const reps = pick(over.reps, state.lastReps, defaults.reps);
  const weight = pick(over.weight, state.lastWeight, defaults.weight);

  return {
    uid,
    exerciseId: id,
    swappedFrom,
    name: def.name,
    type: over.type || def.type,
    measure: over.measure || def.measure || 'reps',
    perSide: over.perSide !== undefined ? !!over.perSide : !!def.perSide,
    sets,
    reps,
    weight,
    holdSec: pick(over.holdSec, defaults.holdSec),
    durationMin: pick(over.durationMin, defaults.durationMin),
    intensities: isCardio ? over.intensities || def.intensities || DEFAULT_INTENSITIES : null,
    weightStep: pick(def.weightStep),
    axialLoading: !!def.axialLoading,
    cues: def.cues || '',
    alternatives: (def.alternatives || []).slice(),
    notice,
  };
}

/**
 * Build a complete, ready-to-log workout.
 *
 * @param {string} routineId
 * @param {'regular'|'pain'} variant
 * @param {{
 *   exerciseState?: object,   // from store.getExerciseState()
 *   settings?: object,        // from store.getSettings()
 *   lastDayLabel?: 'A'|'B'|null,
 *   cardioFocusCount?: number // how many cardio-focus sessions are already logged
 * }} [opts]
 * @returns {{routineId,routineName,variant,dayLabel,blocks}|null}
 */
export function resolveWorkout(routineId, variant, opts = {}) {
  const routine = ROUTINES.find((r) => r.id === routineId);
  if (!routine) return null;

  const wanted = variant === 'pain' ? 'pain' : 'regular';
  const chosen = routine.variants[wanted] || routine.variants.regular;
  const resolvedVariant = routine.variants[wanted] ? wanted : 'regular';

  const ctx = {
    exerciseState: opts.exerciseState || {},
    noAxial: !!(opts.settings && opts.settings.noAxialLoading),
  };

  const sourceBlocks = chosen.blocks || [];

  // Day split: alternate A/B, starting at A when there is no history.
  const hasDaySplit =
    routine.kind === 'gym' &&
    sourceBlocks.some((b) => (b.items || []).some((i) => i.day));
  const nextDay = opts.lastDayLabel === 'A' ? 'B' : 'A';
  const dayLabel = hasDaySplit ? nextDay : null;

  // Cardio Focus rotates two suggestions out of the pool by session count.
  const cfCount = Number(opts.cardioFocusCount) || 0;
  let slotOrdinal = 0;

  const blocks = [];
  for (const block of sourceBlocks) {
    const kept = (block.items || []).filter((i) => !i.day || i.day === dayLabel);

    const items = [];
    for (const raw of kept) {
      let item = raw;
      if (raw.slot === 'strength-rotation') {
        const poolIndex = (cfCount + slotOrdinal) % CARDIO_FOCUS_STRENGTH_POOL.length;
        slotOrdinal += 1;
        item = Object.assign({}, raw, { ex: CARDIO_FOCUS_STRENGTH_POOL[poolIndex] });
      }
      const uid = 'b' + blocks.length + 'i' + items.length;
      const resolved = resolveItem(item, uid, ctx);
      if (resolved) items.push(resolved);
    }

    if (!items.length) continue; // whole block belonged to the other day
    const out = { title: block.title, items };
    if (block.note) out.note = block.note;
    blocks.push(out);
  }

  return {
    routineId: routine.id,
    routineName: routine.name,
    variant: resolvedVariant,
    dayLabel,
    blocks,
  };
}

/* ---------------------------------------------------------------- dev check */

/**
 * Consistency check over the data file. Returns [] when everything lines up.
 * Not shipped behind a flag: it is cheap, and a silent content bug here shows up
 * as a missing exercise mid-workout.
 *
 * @returns {string[]} human-readable problems
 */
export function validateData() {
  const problems = [];

  for (const [id, def] of Object.entries(EXERCISES)) {
    if (!def || typeof def !== 'object') {
      problems.push(`exercise "${id}": not an object`);
      continue;
    }
    if (!def.name) problems.push(`exercise "${id}": missing name`);
    if (!def.type) problems.push(`exercise "${id}": missing type`);
    if (!def.defaults || typeof def.defaults !== 'object') {
      problems.push(`exercise "${id}": missing defaults`);
    }
    if (!Array.isArray(def.alternatives)) {
      problems.push(`exercise "${id}": alternatives is not an array`);
      continue;
    }
    for (const alt of def.alternatives) {
      if (!EXERCISES[alt]) problems.push(`exercise "${id}": unknown alternative "${alt}"`);
      if (alt === id) problems.push(`exercise "${id}": lists itself as an alternative`);
    }
    if (def.axialLoading && !firstNonAxialAlternative(def)) {
      problems.push(
        `exercise "${id}": axial but has no non-axial alternative, so "skip axial loading" would drop it`
      );
    }
  }

  for (const poolId of CARDIO_FOCUS_STRENGTH_POOL) {
    if (!EXERCISES[poolId]) {
      problems.push(`CARDIO_FOCUS_STRENGTH_POOL: unknown exercise "${poolId}"`);
    }
  }

  const seenIds = new Set();
  for (const routine of ROUTINES) {
    if (seenIds.has(routine.id)) problems.push(`routine "${routine.id}": duplicate id`);
    seenIds.add(routine.id);
    if (!routine.variants || !routine.variants.regular) {
      problems.push(`routine "${routine.id}": missing regular variant`);
      continue;
    }
    for (const [vName, v] of Object.entries(routine.variants)) {
      const blocks = (v && v.blocks) || [];
      if (!blocks.length) problems.push(`routine "${routine.id}" (${vName}): no blocks`);
      for (const block of blocks) {
        if (!block.title) problems.push(`routine "${routine.id}" (${vName}): block with no title`);
        for (const item of block.items || []) {
          if (item.slot === 'strength-rotation') continue;
          if (!item.ex) {
            problems.push(`routine "${routine.id}" (${vName}) / ${block.title}: item with no ex`);
          } else if (!EXERCISES[item.ex]) {
            problems.push(
              `routine "${routine.id}" (${vName}) / ${block.title}: unknown exercise "${item.ex}"`
            );
          }
          if (item.day && item.day !== 'A' && item.day !== 'B') {
            problems.push(
              `routine "${routine.id}" (${vName}) / ${block.title}: bad day "${item.day}"`
            );
          }
        }
      }
    }
  }

  // Every routine must still produce a workout with the strictest settings on.
  const strict = { settings: { noAxialLoading: true }, exerciseState: {} };
  for (const routine of ROUTINES) {
    for (const v of Object.keys(routine.variants)) {
      for (const last of [null, 'A', 'B']) {
        const w = resolveWorkout(routine.id, v, Object.assign({ lastDayLabel: last }, strict));
        if (!w || !w.blocks.length) {
          problems.push(`routine "${routine.id}" (${v}, after day ${last}): resolves to nothing`);
          continue;
        }
        const uids = new Set();
        for (const b of w.blocks) {
          for (const i of b.items) {
            if (uids.has(i.uid)) problems.push(`routine "${routine.id}" (${v}): duplicate uid ${i.uid}`);
            uids.add(i.uid);
          }
        }
      }
    }
  }

  return problems;
}

/**
 * data/routines.js — the content layer. Pure data, no imports, no DOM.
 *
 * Everything here is a direct encoding of ROUTINES.md. If the two disagree,
 * ROUTINES.md is the source of truth and this file is the bug.
 *
 * Conventions
 * -----------
 *   - Weights are ALWAYS kilograms. The lb conversion happens at render time.
 *   - `weight: null` means bodyweight (or a machine where the load is the
 *     assist, in which case the number is still the machine's stack value).
 *   - `axialLoading: true` marks exercises that compress the spine even when
 *     performed well. Settings has a "skip axial loading" toggle; the planner
 *     swaps those out for the first non-axial entry in `alternatives`, so every
 *     axial exercise MUST list at least one non-axial alternative.
 *     `validateData()` in js/planner.js enforces that.
 *   - `measure: "hold"` means the item is timed (planks, stretches); anything
 *     else is counted in reps. Cardio items are driven by `durationMin` +
 *     `intensities` and ignore `measure`.
 *   - `perSide: true` means the dose is per side; the workout player expands
 *     it into a left and a right leg of the same item.
 *
 * A few exercises legitimately appear in more than one role (cat-camel is both
 * movement prep and stretch step 1; bird dog is prep, core, and a Pallof
 * alternative). Rather than duplicate them under near-identical ids, routine
 * items may override `type` (and any dose field) per usage. The planner applies
 * item overrides on top of the exercise defaults.
 *
 * Starting weights are deliberately conservative: the athlete is 41, returning
 * to consistency after a break, and training around chronic lower back pain.
 * Under-shooting week one costs nothing; over-shooting costs a flare-up.
 */

/* ------------------------------------------------------------------ exercises */

export const EXERCISES = {
  /* ---------------------------------------------------------- movement prep */

  'cat-camel': {
    name: 'Cat-camel',
    type: 'warmup',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 1, reps: 8, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: [],
    cues: 'Gentle full range, no forcing end-range.',
  },
  'glute-bridge': {
    name: 'Glute bridge',
    type: 'warmup',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 1, reps: 10, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: ['bw-glute-bridge'],
    cues: "Squeeze the glutes, don't arch the lower back.",
  },
  'bw-squat': {
    name: 'Bodyweight squat',
    type: 'warmup',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 1, reps: 8, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: ['leg-swings'],
    cues: 'Easy depth, just greasing the pattern.',
  },
  'leg-swings': {
    name: 'Leg swings',
    type: 'warmup',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 1, reps: 10, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: true,
    alternatives: ['bw-squat'],
    cues: 'Relaxed swing, let the hip open. No forcing height.',
  },
  'easy-walking': {
    name: 'Easy walking',
    type: 'cardio',
    equipment: 'none',
    axialLoading: false,
    defaults: { durationMin: 3 },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: [],
    cues: 'Loosen up. Conversational, nothing to prove.',
  },

  /* --------------------------------------------------------- Day A strength */

  'leg-press': {
    name: 'Leg press',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 60 },
    weightStep: 5,
    measure: 'reps',
    perSide: false,
    alternatives: ['single-leg-leg-press', 'leg-extension'],
    cues: "Feet mid-platform. Don't let the lower back round off the pad at depth.",
  },
  'single-leg-leg-press': {
    name: 'Single-leg leg press',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 30 },
    weightStep: 5,
    measure: 'reps',
    perSide: true,
    alternatives: ['leg-press', 'leg-extension'],
    cues: 'Hips stay square on the seat. Same depth both sides.',
  },
  'leg-extension': {
    name: 'Leg extension',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 25 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['leg-press', 'single-leg-leg-press'],
    cues: 'Back against the pad, pause briefly at the top.',
  },
  'chest-press': {
    name: 'Chest press',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 20 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['db-bench-press', 'push-ups'],
    cues: 'Shoulder blades set, feet planted.',
  },
  'db-bench-press': {
    name: 'DB bench press',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 12 },
    weightStep: 2,
    measure: 'reps',
    perSide: false,
    alternatives: ['chest-press', 'push-ups'],
    cues: 'Weight per dumbbell. Ribs down, feet planted.',
  },
  'push-ups': {
    name: 'Push-ups',
    type: 'strength',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: ['chest-press', 'db-bench-press'],
    cues: 'One line from head to heels. Elevate the hands if the back sags.',
  },
  'seated-cable-row': {
    name: 'Seated cable row',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 30 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['chest-supported-row', 'single-arm-db-row'],
    cues: 'Tall neutral spine, pull to the belly, no torso heave.',
  },
  'chest-supported-row': {
    name: 'Chest-supported machine row',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 25 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['seated-cable-row', 'single-arm-db-row'],
    cues: 'Chest stays on the pad. The pad does the spine-stabilizing for you.',
  },
  'single-arm-db-row': {
    name: 'Single-arm DB row',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 12 },
    weightStep: 2,
    measure: 'reps',
    perSide: true,
    alternatives: ['chest-supported-row', 'seated-cable-row'],
    cues: 'Hand on the bench, flat back, no twisting to finish the rep.',
  },
  'db-hip-thrust': {
    name: 'DB hip thrust',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 20 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['bw-glute-bridge', 'glute-kickback-machine'],
    cues: "Posterior tilt at the top, squeeze the glutes, ribs down. Don't hyperextend the back.",
  },
  'bw-glute-bridge': {
    name: 'Bodyweight or single-leg glute bridge',
    type: 'strength',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: ['db-hip-thrust', 'glute-kickback-machine'],
    cues: 'Drive through the heels. Go single-leg when both legs feel easy.',
  },
  'glute-kickback-machine': {
    name: 'Glute kickback machine',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 15 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: true,
    alternatives: ['db-hip-thrust', 'bw-glute-bridge'],
    cues: 'Move from the hip, not the lower back. Small honest range.',
  },
  'lat-pulldown': {
    name: 'Lat pulldown',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 30 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['assisted-pullup-machine', 'straight-arm-pulldown'],
    cues: 'A slight lean is fine, no lumbar arch-yank.',
  },
  'assisted-pullup-machine': {
    name: 'Assisted pull-up machine',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 8, weight: 35 },
    weightStep: 5,
    measure: 'reps',
    perSide: false,
    alternatives: ['lat-pulldown', 'straight-arm-pulldown'],
    cues: 'The number is the assist: higher is easier. Ribs down at the top.',
  },
  'straight-arm-pulldown': {
    name: 'Straight-arm pulldown',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 15 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['lat-pulldown', 'assisted-pullup-machine'],
    cues: 'Hinge stays out of it. Arms move, torso stays quiet.',
  },
  'pallof-press': {
    name: 'Cable Pallof press',
    type: 'core',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 10 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: true,
    alternatives: ['dead-bug', 'bird-dog'],
    cues: 'Resist the rotation, breathe, hips square.',
  },

  /* --------------------------------------------------------- Day B strength */

  'goblet-squat': {
    name: 'Goblet or guided squat',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: true,
    defaults: { sets: 3, reps: 10, weight: 12 },
    weightStep: 2,
    measure: 'reps',
    perSide: false,
    alternatives: ['leg-press', 'db-split-squat'],
    cues: 'Chest tall, sit between the hips, depth stays pain-free.',
  },
  'db-split-squat': {
    name: 'DB split squat',
    type: 'strength',
    equipment: 'dumbbell',
    // Light DBs at the sides still load the spine from above. Flagged honestly:
    // with "skip axial loading" on, leg press is picked first anyway.
    axialLoading: true,
    defaults: { sets: 3, reps: 8, weight: 8 },
    weightStep: 2,
    measure: 'reps',
    perSide: true,
    alternatives: ['leg-press', 'single-leg-leg-press'],
    cues: 'Light dumbbells at the sides. Torso upright, back knee travels down.',
  },
  'incline-db-press': {
    name: 'Incline DB press',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 12 },
    weightStep: 2,
    measure: 'reps',
    perSide: false,
    alternatives: ['incline-machine-press', 'chest-press'],
    cues: '30 to 45 degree incline, feet planted.',
  },
  'incline-machine-press': {
    name: 'Incline machine press',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 20 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['incline-db-press', 'chest-press'],
    cues: 'Back flat on the pad, no arching to move more weight.',
  },
  'seated-row-wide': {
    name: 'Seated row, wide grip',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 30 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['wide-machine-row', 'face-pull'],
    cues: 'Elbows a little high, squeeze the mid-back.',
  },
  'wide-machine-row': {
    name: 'Wide machine row',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 10, weight: 25 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['seated-row-wide', 'face-pull'],
    cues: 'Chest on the pad, pull wide and slightly high.',
  },
  'face-pull': {
    name: 'Face pull',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 15, weight: 12 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['seated-row-wide', 'wide-machine-row'],
    cues: 'Rope to the forehead, elbows high, light weight and clean reps.',
  },
  'seated-leg-curl': {
    name: 'Seated leg curl',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 25 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['lying-leg-curl', 'single-leg-curl'],
    cues: 'Control the negative.',
  },
  'lying-leg-curl': {
    name: 'Lying leg curl',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 25 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['seated-leg-curl', 'single-leg-curl'],
    cues: 'Hips stay down on the pad, no lifting to finish the rep.',
  },
  'single-leg-curl': {
    name: 'Single-leg curl',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 12 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: true,
    alternatives: ['seated-leg-curl', 'lying-leg-curl'],
    cues: 'Useful for evening out the weaker side. Match reps, not weight.',
  },
  'seated-db-shoulder-press': {
    name: 'Seated DB shoulder press',
    type: 'strength',
    equipment: 'dumbbell',
    axialLoading: true,
    defaults: { sets: 3, reps: 10, weight: 8 },
    weightStep: 2,
    measure: 'reps',
    perSide: false,
    alternatives: ['cable-lateral-raise', 'machine-lateral-raise', 'face-pull'],
    cues: "Back against the pad, don't flare the ribs.",
  },
  'cable-lateral-raise': {
    name: 'Cable lateral raise',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 5 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: true,
    alternatives: ['machine-lateral-raise', 'face-pull'],
    cues: 'Pair it with face pulls to cover the whole shoulder. Light and strict.',
  },
  'machine-lateral-raise': {
    name: 'Machine lateral raise',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 10 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: false,
    alternatives: ['cable-lateral-raise', 'face-pull'],
    cues: 'Lead with the elbows, stop at shoulder height.',
  },
  'hip-abduction-machine': {
    name: 'Hip abduction machine',
    type: 'strength',
    equipment: 'machine',
    axialLoading: false,
    defaults: { sets: 3, reps: 15, weight: 30 },
    weightStep: 5,
    measure: 'reps',
    perSide: false,
    alternatives: ['cable-glute-kickback', 'banded-clamshells', 'side-lying-leg-raises'],
    cues: 'Slow. Feel it in the side of the hip.',
  },
  'cable-glute-kickback': {
    name: 'Cable glute kickback',
    type: 'strength',
    equipment: 'cable',
    axialLoading: false,
    defaults: { sets: 3, reps: 12, weight: 10 },
    weightStep: 2.5,
    measure: 'reps',
    perSide: true,
    alternatives: ['hip-abduction-machine', 'banded-clamshells'],
    cues: 'Stand tall. The leg moves, the lower back does not.',
  },
  'banded-clamshells': {
    name: 'Banded clamshells',
    type: 'strength',
    equipment: 'band',
    axialLoading: false,
    defaults: { sets: 3, reps: 15, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: true,
    alternatives: ['side-lying-leg-raises', 'hip-abduction-machine'],
    cues: 'Feet together, knees open. Pelvis stays still.',
  },
  'side-lying-leg-raises': {
    name: 'Side-lying leg raises',
    type: 'strength',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 3, reps: 15, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: true,
    alternatives: ['banded-clamshells', 'hip-abduction-machine'],
    cues: 'Lead with the heel, toe slightly down. Small range, honest work.',
  },

  /* ------------------------------------------------------------------- core */

  'front-plank': {
    name: 'Front plank',
    type: 'core',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 2, holdSec: 40 },
    weightStep: null,
    measure: 'hold',
    perSide: false,
    alternatives: ['dead-bug', 'bird-dog'],
    cues: 'Ribs down, glutes on, one straight line. Drop to the knees if the back complains.',
  },
  'side-plank': {
    name: 'Side plank',
    type: 'core',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 2, holdSec: 30 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['side-plank-knees', 'pallof-press'],
    cues: 'A little extra on the weaker side is fine, pain-guided. Hips stacked and lifted.',
  },
  'side-plank-knees': {
    name: 'Side plank, knees down',
    type: 'core',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 2, holdSec: 20 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['side-plank', 'dead-bug'],
    cues: 'Knees bent takes most of the load off. Stop if anything sharpens.',
  },
  'dead-bug': {
    name: 'Dead bug',
    type: 'core',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 2, reps: 10, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    alternatives: ['bird-dog', 'front-plank'],
    cues: 'Lower back stays flat on the floor. Exhale as the limbs reach out.',
  },
  'bird-dog': {
    name: 'Bird dog',
    type: 'core',
    equipment: 'bodyweight',
    axialLoading: false,
    defaults: { sets: 2, reps: 8, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: true,
    alternatives: ['dead-bug', 'front-plank'],
    cues: 'Slow, hips level, reach long not high.',
  },

  /* ----------------------------------------------------------------- cardio */

  'bike-elliptical': {
    name: 'Bike or elliptical',
    type: 'cardio',
    equipment: 'machine',
    axialLoading: false,
    defaults: { durationMin: 15 },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    intensities: ['easy', 'moderate', 'intervals', 'hard'],
    alternatives: [],
    cues: 'Steady or intervals, whatever feels right today. No treadmill running.',
  },
  'easy-cardio': {
    name: 'Easy bike or elliptical',
    type: 'cardio',
    equipment: 'machine',
    axialLoading: false,
    defaults: { durationMin: 20 },
    weightStep: null,
    measure: 'reps',
    perSide: false,
    intensities: ['easy', 'moderate'],
    alternatives: [],
    cues: 'Conversational pace. Moving today still counts.',
  },

  /* ---------------------------------------------------------------- stretch */

  'childs-pose-side-reach': {
    name: "Child's pose with side reach",
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 45 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: [],
    cues: 'Sink the hips back, walk the hands to each side, breathe into the tight side.',
  },
  'lizard-pose': {
    name: 'Lizard pose',
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 60 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['hip-flexor-couch'],
    cues: 'Back knee down is fine. Sink the hips, front knee tracks out.',
  },
  'hip-90-90': {
    name: '90/90 hip switch and hold',
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 45 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['figure-4-stretch'],
    cues: 'Tall chest over the front shin.',
  },
  'figure-4-stretch': {
    name: 'Figure-4 glute stretch',
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 45 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['hip-90-90'],
    cues: 'Lying down. Pull the leg in gently, head stays down.',
  },
  'hip-flexor-couch': {
    name: 'Hip flexor / couch stretch',
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 45 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: ['lizard-pose'],
    cues: 'Tuck the pelvis first, then shift forward slightly. Small motion, big stretch.',
  },
  'hamstring-stretch': {
    name: 'Hamstring stretch',
    type: 'stretch',
    equipment: 'strap',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 45 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: [],
    cues: 'Strap or a ledge. Knee soft, hinge from the hip.',
  },
  'open-book-rotation': {
    name: 'Open-book thoracic rotation',
    type: 'stretch',
    equipment: 'mat',
    axialLoading: false,
    defaults: { sets: 1, reps: 8, weight: null },
    weightStep: null,
    measure: 'reps',
    perSide: true,
    alternatives: [],
    cues: 'Rotate from the mid-back, hips stacked and still.',
  },
  'ql-side-bend': {
    name: 'QL side-bend stretch',
    type: 'stretch',
    equipment: 'none',
    axialLoading: false,
    defaults: { sets: 1, holdSec: 30 },
    weightStep: null,
    measure: 'hold',
    perSide: true,
    alternatives: [],
    cues: 'Gentle. This one sits near the painful area, so back off if it bites.',
  },
};

/* -------------------------------------------------------------- thresholds */

/** Pain score at or above `suggestPainVariant` proposes the pain-day variant;
 *  at or above `suggestStretchOnly` the suggestion drops to stretching only.
 *  Both are suggestions. Home always lets the user override. */
export const PAIN_THRESHOLDS = { suggestPainVariant: 5, suggestStretchOnly: 8 };

/** The rotating strength suggestions on a Cardio Focus day (ROUTINES.md §Cardio
 *  Focus step 2). The planner walks this list by session count so the same two
 *  do not come up every time. */
export const CARDIO_FOCUS_STRENGTH_POOL = [
  'leg-press',
  'db-hip-thrust',
  'seated-cable-row',
  'chest-press',
  'side-plank',
  'pallof-press',
];

/* --------------------------------------------------------- block factories */
/* Fresh arrays each call so no two routines can share (and mutate) an object. */

const movementPrep = () => ({
  title: 'Movement prep',
  note: 'Three to four minutes. This is prep, not cardio.',
  items: [
    { ex: 'cat-camel', type: 'warmup', sets: 1, reps: 8 },
    { ex: 'glute-bridge', type: 'warmup', sets: 1, reps: 10 },
    { ex: 'bird-dog', type: 'warmup', sets: 1, reps: 6 },
    { ex: 'bw-squat', type: 'warmup', sets: 1, reps: 8 },
  ],
});

/** The five ● stretches: the short routine, and the gym cool-downs. */
const coreStretchSet = () => [
  { ex: 'cat-camel', type: 'stretch', sets: 1, reps: 8 },
  { ex: 'lizard-pose' },
  { ex: 'hip-90-90' },
  { ex: 'figure-4-stretch' },
  { ex: 'hip-flexor-couch' },
];

/** All nine stretches, in ROUTINES.md order. */
const fullStretchSet = () => [
  { ex: 'cat-camel', type: 'stretch', sets: 1, reps: 8 },
  { ex: 'childs-pose-side-reach' },
  { ex: 'lizard-pose' },
  { ex: 'hip-90-90' },
  { ex: 'figure-4-stretch' },
  { ex: 'hip-flexor-couch' },
  { ex: 'hamstring-stretch' },
  { ex: 'open-book-rotation' },
  { ex: 'ql-side-bend' },
];

/** Hip mobility tail of a Cardio Focus day: lizard, 90/90, figure-4. */
const hipMobility = () => ({
  title: 'Hip mobility',
  note: 'Three to five minutes to finish.',
  items: [{ ex: 'lizard-pose' }, { ex: 'hip-90-90' }, { ex: 'figure-4-stretch' }],
});

/** Every gym routine shares the same pain-day shape; only the cardio dose moves. */
const painDayBlocks = (easyCardioMin) => ({
  blocks: [
    {
      title: 'Gentle warm-up',
      items: [
        { ex: 'cat-camel', type: 'warmup', sets: 1, reps: 8 },
        { ex: 'easy-walking', durationMin: 3 },
        { ex: 'bird-dog', type: 'warmup', sets: 1, reps: 6 },
      ],
    },
    {
      title: 'Easy cardio',
      note: 'Conversational pace. Bike or elliptical.',
      items: [{ ex: 'easy-cardio', durationMin: easyCardioMin }],
    },
    {
      title: 'Optional isometrics',
      note: 'Only if it feels fine. Skipping this block is a normal outcome.',
      items: [
        { ex: 'bird-dog', sets: 1, reps: 6 },
        { ex: 'side-plank-knees', sets: 1, holdSec: 20 },
      ],
    },
    {
      title: 'Extended mobility',
      note: 'Gentle end-ranges only.',
      items: fullStretchSet(),
    },
  ],
});

const gentleStretchNote = 'Gentle end-ranges only today. Back off anything that bites.';

/* ------------------------------------------------------------------ routines */

export const ROUTINES = [
  {
    id: 'gym-short',
    name: 'Gym Short',
    kind: 'gym',
    estMinutes: 25,
    description: 'Three lifts, two sets, one core piece.',
    variants: {
      regular: {
        blocks: [
          movementPrep(),
          {
            title: 'Strength',
            note: 'Ramp-in set first at about half the working weight.',
            items: [
              // Day A: first three.
              { ex: 'leg-press', day: 'A', sets: 2 },
              { ex: 'chest-press', day: 'A', sets: 2 },
              { ex: 'seated-cable-row', day: 'A', sets: 2 },
              // Day B: first three.
              { ex: 'goblet-squat', day: 'B', sets: 2 },
              { ex: 'incline-db-press', day: 'B', sets: 2 },
              { ex: 'seated-row-wide', day: 'B', sets: 2 },
            ],
          },
          {
            title: 'Core',
            items: [
              { ex: 'front-plank', day: 'A', sets: 2, holdSec: 40 },
              { ex: 'side-plank', day: 'B', sets: 2, holdSec: 30 },
            ],
          },
          {
            title: 'Cool-down',
            items: [{ ex: 'lizard-pose' }, { ex: 'figure-4-stretch' }],
          },
        ],
      },
      pain: painDayBlocks(15),
    },
  },

  {
    id: 'gym-medium',
    name: 'Gym Medium',
    kind: 'gym',
    estMinutes: 45,
    description: 'Five lifts, two core pieces, short cardio finisher.',
    variants: {
      regular: {
        blocks: [
          movementPrep(),
          {
            title: 'Strength',
            note: 'Ramp-in set first at about half the working weight.',
            items: [
              { ex: 'leg-press', day: 'A', sets: 3 },
              { ex: 'chest-press', day: 'A', sets: 3 },
              { ex: 'seated-cable-row', day: 'A', sets: 3 },
              { ex: 'db-hip-thrust', day: 'A', sets: 3 },
              { ex: 'lat-pulldown', day: 'A', sets: 3 },
              { ex: 'goblet-squat', day: 'B', sets: 3 },
              { ex: 'incline-db-press', day: 'B', sets: 3 },
              { ex: 'seated-row-wide', day: 'B', sets: 3 },
              { ex: 'seated-leg-curl', day: 'B', sets: 3 },
              { ex: 'seated-db-shoulder-press', day: 'B', sets: 3 },
            ],
          },
          {
            title: 'Core',
            items: [
              { ex: 'front-plank', day: 'A', sets: 2, holdSec: 40 },
              { ex: 'bird-dog', day: 'A', sets: 2, reps: 8 },
              { ex: 'side-plank', day: 'B', sets: 2, holdSec: 30 },
              { ex: 'dead-bug', day: 'B', sets: 2, reps: 10 },
            ],
          },
          {
            title: 'Cardio finisher',
            items: [{ ex: 'bike-elliptical', durationMin: 10 }],
          },
          {
            title: 'Cool-down',
            items: [
              { ex: 'lizard-pose' },
              { ex: 'hip-90-90' },
              { ex: 'figure-4-stretch' },
              { ex: 'hip-flexor-couch' },
            ],
          },
        ],
      },
      pain: painDayBlocks(25),
    },
  },

  {
    id: 'gym-long',
    name: 'Gym Long',
    kind: 'gym',
    estMinutes: 70,
    description: 'The full six, three core pieces, cardio, full stretch.',
    variants: {
      regular: {
        blocks: [
          movementPrep(),
          {
            title: 'Strength',
            note: 'Ramp-in set first at about half the working weight.',
            items: [
              { ex: 'leg-press', day: 'A', sets: 3 },
              { ex: 'chest-press', day: 'A', sets: 3 },
              { ex: 'seated-cable-row', day: 'A', sets: 3 },
              { ex: 'db-hip-thrust', day: 'A', sets: 3 },
              { ex: 'lat-pulldown', day: 'A', sets: 3 },
              { ex: 'pallof-press', day: 'A', sets: 3 },
              { ex: 'goblet-squat', day: 'B', sets: 3 },
              { ex: 'incline-db-press', day: 'B', sets: 3 },
              { ex: 'seated-row-wide', day: 'B', sets: 3 },
              { ex: 'seated-leg-curl', day: 'B', sets: 3 },
              { ex: 'seated-db-shoulder-press', day: 'B', sets: 3 },
              { ex: 'hip-abduction-machine', day: 'B', sets: 3 },
            ],
          },
          {
            // Day A's core pool ends with Pallof "if not done in strength". On a
            // long day it already ran as lift 6, so dead bug takes the slot.
            title: 'Core',
            items: [
              { ex: 'front-plank', day: 'A', sets: 2, holdSec: 40 },
              { ex: 'bird-dog', day: 'A', sets: 2, reps: 8 },
              { ex: 'dead-bug', day: 'A', sets: 2, reps: 10 },
              { ex: 'side-plank', day: 'B', sets: 2, holdSec: 30 },
              { ex: 'dead-bug', day: 'B', sets: 2, reps: 10 },
              { ex: 'bird-dog', day: 'B', sets: 2, reps: 8 },
            ],
          },
          {
            title: 'Cardio finisher',
            items: [{ ex: 'bike-elliptical', durationMin: 18 }],
          },
          {
            title: 'Cool-down',
            note: 'Optional. Worth it on a long day.',
            items: coreStretchSet(),
          },
        ],
      },
      pain: painDayBlocks(40),
    },
  },

  {
    id: 'cardio-focus',
    name: 'Cardio Focus',
    kind: 'gym',
    estMinutes: 50,
    description: 'A long ride or elliptical, with two lifts to keep the habit.',
    variants: {
      regular: {
        blocks: [
          movementPrep(),
          {
            title: 'Strength',
            note: 'Two rotating suggestions. Swap either one freely.',
            items: [
              { slot: 'strength-rotation', sets: 3 },
              { slot: 'strength-rotation', sets: 3 },
            ],
          },
          {
            title: 'Cardio',
            note: 'Thirty to forty-five minutes. Steady or variable intervals, your call.',
            items: [{ ex: 'bike-elliptical', durationMin: 35 }],
          },
          hipMobility(),
        ],
      },
      pain: painDayBlocks(25),
    },
  },

  {
    id: 'stretch-full',
    name: 'Stretch Full',
    kind: 'stretch',
    estMinutes: 14,
    description: 'All nine stretches, timer-guided.',
    variants: {
      regular: {
        blocks: [
          { title: 'Stretch sequence', items: fullStretchSet() },
          {
            title: 'Optional core add-on',
            note: 'The physio work. Skip freely.',
            items: [
              { ex: 'dead-bug', sets: 1, reps: 10 },
              { ex: 'bird-dog', sets: 1, reps: 8 },
              { ex: 'front-plank', sets: 1, holdSec: 40 },
              { ex: 'side-plank', sets: 1, holdSec: 30 },
            ],
          },
        ],
      },
      pain: {
        blocks: [{ title: 'Stretch sequence', note: gentleStretchNote, items: fullStretchSet() }],
      },
    },
  },

  {
    id: 'stretch-short',
    name: 'Stretch Short',
    kind: 'stretch',
    estMinutes: 7,
    description: 'The five that matter most for the hips and lower back.',
    variants: {
      regular: {
        blocks: [{ title: 'Stretch sequence', items: coreStretchSet() }],
      },
      pain: {
        blocks: [{ title: 'Stretch sequence', note: gentleStretchNote, items: coreStretchSet() }],
      },
    },
  },
];

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
 *   - `cues` is the terse mid-set reminder shown on the card. `howTo` is the
 *     fuller beginner explanation behind the ⓘ button: setup, the movement,
 *     what it should feel like, and where relevant what to do if the lower back
 *     complains. Every exercise needs both.
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
    howTo:
      'Start on your hands and knees, hands under your shoulders and knees under your hips. ' +
      'Slowly round your back up toward the ceiling, then let it sag gently as you lift your ' +
      'chest and tailbone. It should feel like an easy wave travelling through the spine, not a' +
      ' stretch you push into. Stay in the range that stays smooth: if the lower back pinches ' +
      'at either end, use a smaller range.',
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
    howTo:
      'Lie on your back with your knees bent and your feet flat on the floor, about hip width ' +
      'apart and close enough that your fingertips nearly reach your heels. Push through your ' +
      'heels and lift your hips until your body is a straight line from knees to shoulders, ' +
      'then lower slowly. You should feel this in the back of the hips. If you feel it in your ' +
      'lower back, lift a little less high and tuck your tailbone slightly before you rise.',
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
    howTo:
      'Stand with your feet about shoulder width apart, toes turned out slightly. Bend your ' +
      'knees and sit down as if lowering onto a chair, only as far as feels easy, then stand ' +
      'back up. Arms can reach forward for balance. This is a warmup, so stay well short of ' +
      'your deepest squat.',
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
    howTo:
      'Hold a wall or a machine frame for balance and stand on one leg. Swing the other leg ' +
      'forward and back like a pendulum, letting it relax rather than kicking hard. Keep your ' +
      'torso upright and still so the movement comes from the hip. All reps on one leg, then ' +
      'switch.',
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
    howTo:
      'Just walk at an easy pace, on the gym floor or a treadmill set to a slow walk. Nothing ' +
      'strenuous: this is only here to warm up and loosen the hips.',
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
    howTo:
      'Sit in the leg press machine with your back and hips flat against the padded seat and ' +
      'your feet flat on the platform, about hip width apart and roughly in the middle of it. ' +
      'Push the platform away until your legs are almost straight, keeping a slight bend in the' +
      ' knees, then lower under control. You should feel it in the thighs and glutes. Stop ' +
      'lowering the moment your hips start to curl up off the seat, because that rounding is ' +
      'what your lower back does not like.',
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
    howTo:
      'The same leg press machine, one leg at a time. Put one foot in the middle of the ' +
      'platform, rest the other foot to the side or on the floor, and press. Keep both hips ' +
      'flat on the seat so your pelvis cannot twist. Use much less weight than the two-legged ' +
      'version, and match the depth between sides rather than chasing the number.',
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
    howTo:
      'Sit in the leg extension machine with your back against the pad and the padded roller ' +
      'resting on the front of your ankles. Straighten your knees to lift the roller, pause for' +
      ' a beat at the top, then lower slowly. You should feel it in the front of the thighs. ' +
      'Keep your back on the pad: if you are leaning backward to move the weight, it is too ' +
      'heavy.',
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
    howTo:
      'Sit in the chest press machine and set the seat height so the handles line up with the ' +
      'middle of your chest. Feet flat, back and shoulders against the pad. Push the handles ' +
      'away until your arms are nearly straight, then bring them back slowly until your hands ' +
      'are beside your chest. Keep your shoulder blades pulled back into the pad instead of ' +
      'letting your shoulders roll forward.',
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
    howTo:
      'Lie on a flat bench with a dumbbell in each hand and your feet flat on the floor. Start ' +
      'with the weights just outside your chest, elbows about 45 degrees away from your body, ' +
      'and press them up until your arms are almost straight, then lower slowly. Keep your ribs' +
      ' down and your back resting normally on the bench. Arching hard to press a heavier ' +
      'weight is exactly what to avoid here.',
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
    howTo:
      'Hands on the floor a little wider than your shoulders, body in one straight line from ' +
      'head to heels. Bend your elbows to lower your chest toward the floor, then push back up.' +
      ' Squeeze your glutes so your hips do not sag. If your lower back sags or aches, put your' +
      ' hands on a bench or a bar in a rack so your body is at an angle: that makes it easier ' +
      'straight away.',
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
    howTo:
      'Sit at the low cable row station facing the pulley, feet on the footplates, knees ' +
      'slightly bent. Take the handle, sit up tall, and pull it in to your belly button, ' +
      'leading with your elbows and letting your shoulder blades squeeze together. Return ' +
      'slowly without letting your upper back round forward. Your torso stays upright the whole' +
      ' time: no rocking backward and forward to move the weight.',
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
    howTo:
      'Use the seated row machine with a chest pad, the one where you sit facing the pad rather' +
      ' than facing away from it. Set the seat so the handles are in front of your chest, rest ' +
      'your chest against the pad, and pull the handles back toward you, then return slowly. ' +
      'Because your chest stays on the pad, the machine holds your spine steady for you, which ' +
      'is why this is a good pick on a stiff day.',
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
    howTo:
      'Put one knee and the same-side hand on a flat bench, other foot on the floor, so your ' +
      'back is flat and roughly parallel to the ground. Hold a dumbbell in the free hand, let ' +
      'it hang, then pull it up toward your hip and lower it slowly. Keep your shoulders level:' +
      ' no twisting to finish the rep. If the bent-over position bothers your back, use the ' +
      'chest-supported row machine instead.',
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
    howTo:
      'Sit on the floor with your upper back against the long side of a bench, knees bent and ' +
      'feet flat. Rest a dumbbell across your hips, with a pad or a folded towel so it is ' +
      'comfortable. Push through your heels and lift your hips until your body is level from ' +
      'knees to shoulders, squeeze the glutes, then lower. Stop the lift when you are level. ' +
      'Tucking your tailbone slightly at the top keeps the work in the glutes, and if you feel ' +
      'it in your lower back you are arching past the top.',
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
    howTo:
      'Lie on your back with your knees bent and feet flat on the floor. Push through your ' +
      'heels to lift your hips into a straight line from knees to shoulders, hold for a second,' +
      ' then lower slowly. Once two legs feel easy, straighten one leg and do the same with ' +
      'just the other foot down. You should feel it in the glutes: if your hamstrings cramp ' +
      'instead, walk your feet a little closer to you.',
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
    howTo:
      'Stand at the glute kickback machine facing the pad, with your chest and hands supported ' +
      'and one foot against the lever or in the strap. Push that leg back and slightly up, then' +
      ' return slowly. One side at a time. Keep the movement in the hip and stop before your ' +
      'lower back starts arching to add range, which is easy to do without noticing.',
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
    howTo:
      'Sit at the lat pulldown, tuck your thighs under the pads, and take a wide overhand grip ' +
      'on the bar. Pull the bar down to your upper chest, leading with your elbows, then let it' +
      ' rise back up under control. Leaning back a few degrees is fine, but hold that lean ' +
      'steady rather than yanking your whole back into every rep.',
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
    howTo:
      'This is the machine with a padded platform that helps push you up. The number you set is' +
      ' the assistance, so a higher number makes it easier. Take the overhead handles, put your' +
      ' knees or feet on the pad, and pull yourself up until your chin is near your hands, then' +
      ' lower slowly. Keep your ribs down rather than arching at the top.',
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
    howTo:
      'Stand facing a cable machine with the pulley set high and a straight bar or a rope ' +
      'attached. With your arms straight, pull the bar down in an arc from head height to your ' +
      'thighs, then let it float back up. Hinge forward slightly at the hips and then hold that' +
      ' position: only your arms move, your torso and lower back stay quiet.',
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
    howTo:
      'Set a cable at about chest height and stand side-on to the machine, feet shoulder width ' +
      'apart, holding the handle at your chest with both hands. Press your hands straight out ' +
      'in front of you, hold a second, then bring them back in. The cable is trying to twist ' +
      'you toward the machine and the whole exercise is refusing to let it. Keep your hips ' +
      'square and breathe normally instead of holding your breath.',
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
    howTo:
      'Hold one dumbbell or kettlebell upright against your chest with both hands, feet a ' +
      'little wider than your shoulders. Sit down between your hips with your chest tall, then ' +
      'stand back up. Go only as deep as stays comfortable. This one presses load down through ' +
      'the spine, so keep the weight modest, and switch to the leg press on a day when your ' +
      'back is talking to you.',
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
    howTo:
      'Stand with one foot forward and the other a long step behind you, a light dumbbell ' +
      'hanging at each side. Lower straight down so the back knee travels toward the floor, ' +
      'then press back up through the front foot. Torso stays upright rather than leaning over.' +
      ' Hold a rack or a wall with one hand if balance is the limiting factor. All reps on one ' +
      'side, then switch.',
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
    howTo:
      'Set an adjustable bench to about a 30 to 45 degree incline and sit back with a dumbbell ' +
      'in each hand, feet flat on the floor. Start with the weights at chest level and press ' +
      'them up until your arms are nearly straight, then lower slowly. Keep your back resting ' +
      'on the pad and your ribs down instead of arching away from it.',
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
    howTo:
      'The pressing machine whose seat leans back, so you push up and away at an angle. Set the' +
      ' seat so the handles sit around upper-chest height, back flat on the pad, feet planted. ' +
      'Press out until your arms are nearly straight, then return under control. If you have to' +
      ' arch off the pad to finish a rep, take some weight off.',
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
    howTo:
      'The same seated cable row station, but with a wide bar instead of the close handle. Sit ' +
      'tall, take the bar with your hands wider than your shoulders, and pull it toward the top' +
      ' of your belly with your elbows travelling out and a little high. Squeeze the muscles ' +
      'between your shoulder blades, then return slowly. The torso stays upright: no rowing ' +
      'back and forth from the hips.',
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
    howTo:
      'The chest-supported row machine, using the wide handles. Set the seat so the handles are' +
      ' in reach with your chest against the pad, then pull them back and slightly out, ' +
      'squeezing your shoulder blades together, and return slowly. The pad does the spine-' +
      'stabilizing for you, which makes this a comfortable choice when the lower back is ' +
      'grumpy.',
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
    howTo:
      'Attach a rope to a cable set at about head height. Stand tall, take one end of the rope ' +
      'in each hand, and pull it toward your forehead so your hands finish beside your ears ' +
      'with your elbows high. Return slowly. Keep the weight light: this is for the small ' +
      'muscles of the upper back and shoulders, and clean reps beat heavy ones every time.',
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
    howTo:
      'Sit in the seated leg curl machine with the thigh pad clamped down over your legs and ' +
      'the roller behind your lower calves. Curl your heels down and back toward the seat, ' +
      'pause, then let the weight travel back up slowly. You should feel it in the hamstrings, ' +
      'at the back of the thighs. Keep your back against the pad rather than pushing yourself ' +
      'away from it.',
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
    howTo:
      'Lie face down on the leg curl bench with the roller across the back of your lower calves' +
      ' and your knees just past the edge of the pad. Curl your heels toward your backside, ' +
      'then lower slowly. Keep your hips pressed down into the bench. Lifting them to finish a ' +
      'rep arches the lower back, so if your hips keep popping up, drop the weight.',
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
    howTo:
      'Either leg curl machine, one leg at a time, with the other foot resting out of the way. ' +
      'Curl the working heel in, pause, and lower slowly. This is mainly a tool for evening out' +
      ' a weaker side, so match the number of reps between sides rather than the weight.',
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
    howTo:
      'Sit on a bench with the backrest set upright, a dumbbell in each hand at shoulder ' +
      'height, palms facing forward. Press them up until your arms are nearly straight, then ' +
      'lower back to shoulder height. Keep your back against the pad and your ribs down. ' +
      'Pressing overhead sends load down through the spine, so keep it light, and swap to ' +
      'lateral raises if your back objects.',
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
    howTo:
      'Stand side-on to a cable machine with the pulley set low, and take the handle in the ' +
      'hand furthest from the machine, so the cable crosses in front of you. Raise that arm out' +
      ' to the side up to about shoulder height, arm nearly straight, then lower slowly. Stand ' +
      'tall and resist swinging your body to launch the weight. One side at a time.',
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
    howTo:
      'Sit in the lateral raise machine with your upper arms against the pads and your torso ' +
      'upright against the backrest. Push your arms out and up to about shoulder height, ' +
      'leading with the elbows, then lower slowly. Stop at shoulder height. Light weight and ' +
      'smooth reps work far better here than heavy ones.',
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
    howTo:
      'Sit in the hip abduction machine, the one with pads on the outside of your knees, and ' +
      'push your knees apart against the resistance. Return slowly instead of letting the pads ' +
      'snap back. You should feel it on the outer side of the hips and glutes. Sit back against' +
      ' the backrest: leaning forward and heaving turns it into a lower back exercise.',
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
    howTo:
      'Set a cable low and fasten an ankle strap around one ankle. Face the machine, hold the ' +
      'frame for balance, stand tall, and push that leg straight back behind you, then return ' +
      'slowly. Keep the range small and honest. If your lower back arches to get the leg ' +
      'higher, you have gone past the useful range.',
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
    howTo:
      'Lie on your side with a loop band around both thighs just above the knees, knees bent to' +
      ' about 90 degrees and hips stacked one over the other. Keeping your feet touching, open ' +
      'the top knee away from the bottom one, then close it slowly. You should feel it on the ' +
      'outer hip and glute. Your pelvis should not roll backward as the knee opens: if it does,' +
      ' use a lighter band.',
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
    howTo:
      'Lie on your side with your legs straight and stacked, bottom arm under your head. Lift ' +
      'the top leg toward the ceiling, leading with the heel and letting the toe point slightly' +
      ' down, then lower slowly. Keep the range small and controlled. Your hips stay stacked: ' +
      'rolling backward turns it into a different exercise.',
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
    howTo:
      'Lie face down, then prop yourself on your forearms with your elbows under your shoulders' +
      ' and rise onto your toes, so your body makes one straight line. Squeeze your glutes and ' +
      'keep your ribs pulled down so your hips do not sag. Hold and keep breathing. If you feel' +
      ' it in your lower back, drop your knees to the floor and hold that version: short and ' +
      'clean beats long and sagging.',
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
    howTo:
      'Lie on your side and prop yourself on the bottom forearm, elbow directly under the ' +
      'shoulder, with your feet stacked. Lift your hips so your body is a straight line from ' +
      'head to feet, and hold. Keep the top hip pointing at the ceiling rather than rolling ' +
      'forward. A little extra time on your weaker side is fine, guided by how it feels rather ' +
      'than by evening up the numbers.',
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
    howTo:
      'The same as the side plank, but with your knees bent and resting on the floor, so you ' +
      'lift from knees to shoulders instead of feet to shoulders. That takes most of the load ' +
      'off. Elbow under the shoulder, hips lifted and stacked. This is the version for sore ' +
      'days, and stopping early is a perfectly good outcome.',
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
    howTo:
      'Lie on your back with your arms pointing at the ceiling and your hips and knees bent to ' +
      '90 degrees, like a dog lying on its back. Slowly lower one arm overhead and the opposite' +
      ' leg toward the floor, then bring them back and switch sides. Your lower back stays flat' +
      ' against the floor the whole time: the moment it starts to arch away, that is your ' +
      'range, so reach a little less far.',
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
    howTo:
      'On your hands and knees, hands under your shoulders and knees under your hips. Reach one' +
      ' arm forward and the opposite leg back until both are roughly level with your body, hold' +
      ' for a moment, then return and switch sides. Reach long rather than high, and keep your ' +
      'hips level, as if you were balancing a glass of water on your lower back.',
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
    howTo:
      'Any stationary bike or elliptical trainer. Set the seat or handles so you are ' +
      'comfortable and go at whatever pace suits today, steady or with harder bursts mixed in. ' +
      'Not a treadmill run.',
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
    howTo:
      'Stationary bike or elliptical at a gentle pace, easy enough that you could hold a ' +
      'conversation. On a sore day this is the session, so there is nothing here to push.',
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
    howTo:
      'Kneel on the floor, bring your big toes together, sit your hips back toward your heels, ' +
      'and reach both arms out along the floor in front of you. Then walk both hands over to ' +
      'the left and hold, feeling a long stretch down the right side of your back, then walk ' +
      'them across to the right. It should feel like a broad, easy opening down the side of ' +
      'your ribs, never a sharp pull. Breathe into whichever side feels tighter.',
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
    howTo:
      'Start on your hands and knees. Step your right foot forward so it lands just outside ' +
      'your right hand, then lower your left knee to the floor behind you and let your hips ' +
      'sink toward the ground. Keep the front knee tracking out over the foot. You should feel ' +
      'a deep but comfortable stretch at the front of the back hip and the inside of the front ' +
      'thigh. Coming down onto your forearms deepens it, so stay on your hands if that is ' +
      'already plenty. Then switch sides.',
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
    howTo:
      'Sit on the floor with your front leg bent to about 90 degrees with the shin across your ' +
      'body, and the back leg out to the side, also bent to about 90 degrees behind you. Sit up' +
      ' tall and lean your chest gently out over the front shin until you feel it in the outer ' +
      'hip and glute. Propping your hands on the floor behind you is fine if sitting upright is' +
      ' hard. To switch, lift both knees and rotate them across to the other side.',
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
    howTo:
      'Lie on your back with both knees bent and your feet on the floor. Cross your right ankle' +
      ' over your left thigh just above the knee, so the legs make a figure four. Reach through' +
      ' the gap, hold behind your left thigh, and gently draw that leg toward your chest. Keep ' +
      'your head and shoulders resting on the floor. You should feel a broad stretch in the ' +
      'right glute: ease off if it pinches at the front of the hip. Then switch sides.',
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
    howTo:
      'Kneel on one knee with the other foot flat on the floor in front of you, back knee on a ' +
      'mat or a folded towel. Before you move at all, tuck your tailbone under so your lower ' +
      'back flattens, and squeeze the glute on the kneeling side. Then shift your weight ' +
      'forward just a couple of centimeters. The tuck does most of the work, so a small motion ' +
      'already gives a strong stretch at the front of the kneeling hip. If you feel it as a ' +
      'pinch in your lower back, you have lost the tuck.',
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
    howTo:
      'Lie on your back with one knee bent and that foot on the floor. Loop a strap, belt, or ' +
      'towel around the other foot and raise that leg toward the ceiling until you feel a ' +
      'stretch down the back of the thigh. Keep a soft bend in the raised knee and keep your ' +
      'head and lower back resting on the floor. If you prefer standing, put your heel on a low' +
      ' ledge and lean forward from the hips, not by rounding your back.',
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
    howTo:
      'Lie on your side with your knees bent and stacked in front of you and both arms straight' +
      ' out together at shoulder height. Keeping the knees exactly where they are, sweep the ' +
      'top arm up and over to the other side, opening your chest toward the ceiling, then bring' +
      ' it back. Let your head follow your hand. The turn comes from the mid-back and ribs ' +
      'while your hips and knees stay still and stacked.',
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
    howTo:
      'Stand tall with your feet hip width apart. Reach one arm overhead and lean gently to the' +
      ' opposite side, sliding the other hand down your leg, until you feel a stretch along the' +
      ' side of your torso just above the hip. Hold, come back up, then switch sides. This one ' +
      'sits right beside the sore area, so keep it small and gentle, and come out of it if it ' +
      'bites at all.',
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

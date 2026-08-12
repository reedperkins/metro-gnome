<script setup lang="ts">
// A beamed note group, drawn rather than set in a music font. Owns its own
// geometry so the proportions live next to the markup that uses them.
defineProps<{
  // Noteheads in the group: 1 is an unbeamed quarter, 2 a pair, 3 a triplet.
  notes: 1 | 2 | 3
  // Beam lines: 0 for a quarter, 1 for eighths, 2 for sixteenths.
  beams: 0 | 1 | 2
  // Whether to carry a tuplet numeral above the beam.
  tuplet: boolean
}>()

// Beamed-note icon geometry, in the same 24x24 viewBox as the +/- icons.
// Proportions are in staff spaces (sp) — the engraving unit, where 1 sp is a
// notehead's height — scaled by S. Bravura's `engravingDefaults` is the
// reference for beam thickness and spacing, but the noteheads and stems here
// are deliberately heavier than engraved text: at 28px an engraved note reads
// as a grey smudge, so these follow the display style of printed rhythm charts
// (wider heads, longer stems) which survives the size.
//   notehead 1.6 x 1.0 sp   stem 4.0 sp long   beam 0.5 sp thick
const S = 3.3
const HEAD_RX = 0.8 * S
const HEAD_RY = 0.5 * S
const HEAD_TILT = -22
const STEM_LEN = 4 * S
// Engraving says 0.12 sp (0.4 units), which lands under a physical pixel once
// the icon is scaled down to 28px. Overridden to the thinnest width that stays
// solid; the only number here not derived from S.
const STEM_W = 0.95
const BEAM_H = 0.5 * S
// Slightly wider than the engraved 0.75 sp pitch: at this size the 0.25 sp gap
// closes up and a double beam reads as one thick bar.
const BEAM_PITCH = 0.85 * S
// Ink runs BEAM_Y to NOTE_Y + HEAD_RY, leaving the space above the beam clear
// for the triplet's numeral.
const BEAM_Y = 4.5
const NOTE_Y = BEAM_Y + STEM_LEN
// Distance between stems. Wider for a pair than a triplet, as engraved: the
// group tightens as it gets denser rather than the beam growing.
// A lone quarter has no second stem, so its spacing is unused.
const SPACING = { 1: 0, 2: 2.4 * S, 3: 1.75 * S } as const
// The stem sits flush with the head's right edge, so it needs both the
// rightmost point of the tilted ellipse and the height that point sits at.
// HEAD_HALF_W is that x (also the bounding-box half-width, used for centring).
// STEM_FOOT_DY is its y, above the head's centre — the stem stops there rather
// than carrying on down to the centre, because past the tangent point the
// ellipse curves back in and the stem's bottom corner would hang outside it.
const TILT = (HEAD_TILT * Math.PI) / 180
const HEAD_HALF_W = Math.hypot(HEAD_RX * Math.cos(TILT), HEAD_RY * Math.sin(TILT))
const STEM_FOOT_DY =
  (Math.sin(TILT) * Math.cos(TILT) * (HEAD_RX ** 2 - HEAD_RY ** 2)) / HEAD_HALF_W
// The triplet's beam drops so its numeral has room above; without this the 3 is
// clipped by the top of the viewBox. Noteheads stay on the shared baseline, so
// only the stems shorten and the three icons still line up.
const TUPLET_DROP = 2.6

// Notehead centres, built from x=0 and recentred by centerShift.
function heads(notes: 1 | 2 | 3) {
  return Array.from({ length: notes }, (_, i) => i * SPACING[notes])
}

// Centre x of the stem, placed so its right edge is flush with the head's.
function stemX(headCx: number) {
  return headCx + HEAD_HALF_W - STEM_W / 2
}

function beamY(tuplet: boolean) {
  return BEAM_Y + (tuplet ? TUPLET_DROP : 0)
}

// Stem to stem, flush with their outer edges — the beam does not reach over the
// noteheads. Stems sit at the right of their heads, so the leftmost head hangs
// outside the beam, which is what printed notation actually looks like.
function beam(notes: 1 | 2 | 3) {
  const x = stemX(heads(notes)[0]) - STEM_W / 2
  return { x, width: stemX(heads(notes)[notes - 1]) + STEM_W / 2 - x }
}

// Centres on the full ink, noteheads included — not on the beam, which sits
// well right of centre because of that overhanging first head.
function centerShift(notes: 1 | 2 | 3) {
  const left = heads(notes)[0] - HEAD_HALF_W
  const right = stemX(heads(notes)[notes - 1]) + STEM_W / 2
  return 12 - (left + right) / 2
}
</script>

<template>
  <svg class="note-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g :transform="`translate(${centerShift(notes)} 0)`">
      <!-- Noteheads: ellipses rotated off horizontal, the way an engraved
           head leans. Filled, so they carry no stroke of their own. -->
      <ellipse
        v-for="(cx, i) in heads(notes)"
        :key="`h${i}`"
        :cx="cx"
        :cy="NOTE_Y"
        :rx="HEAD_RX"
        :ry="HEAD_RY"
        :transform="`rotate(${HEAD_TILT} ${cx} ${NOTE_Y})`"
      />
      <rect
        v-for="(cx, i) in heads(notes)"
        :key="`s${i}`"
        :x="stemX(cx) - STEM_W / 2"
        :y="beamY(tuplet)"
        :width="STEM_W"
        :height="NOTE_Y + STEM_FOOT_DY - beamY(tuplet)"
      />
      <rect
        v-for="b in beams"
        :key="`b${b}`"
        :x="beam(notes).x"
        :width="beam(notes).width"
        :y="beamY(tuplet) + (b - 1) * BEAM_PITCH"
        :height="BEAM_H"
      />
      <!-- Over the middle stem, which for an evenly spaced group is
           also the beam's midpoint. Inside the centring group, so it
           tracks the notes rather than the icon's own centre — those
           differ, because the first notehead overhangs the beam. -->
      <text
        v-if="tuplet"
        class="tuplet"
        :x="stemX(heads(notes)[1])"
        :y="beamY(true) - 1.4"
      >3</text>
      </g>
    </svg>
</template>

<style scoped>
/* The ink is centred within the viewBox by construction, so this needs none of
   the nudging a font glyph would — it just fills the chip. */
.note-icon {
  display: block;
  width: 1.75rem;
  height: 1.75rem;
  /* Everything is a filled shape — no strokes — so nothing straddles its own
     edge and the beam gaps stay exactly as specified. */
  fill: currentColor;
  stroke: none;
}

.tuplet {
  stroke: none;
  font-size: 7px;
  font-weight: 700;
  font-style: italic;
  text-anchor: middle;
}
</style>

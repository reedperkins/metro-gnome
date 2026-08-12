<script setup lang="ts">
import RoundButton from './RoundButton.vue'

// A −/value/+ control. Backs every stepped number in the app: beats per bar,
// both mute-bar counts, and the BPM readout. The three small ones take the
// default rendering; BPM passes its own through the `value` slot, which is the
// only thing that actually differs between them.
const props = withDefaults(
  defineProps<{
    // Bounds are optional: the mute counts have a floor but no ceiling.
    min?: number
    max?: number
    // Noun for the button labels, e.g. "beats per bar" -> "Decrease beats per bar".
    label: string
    size?: 'sm' | 'lg'
  }>(),
  { min: undefined, max: undefined, size: 'sm' },
)

const model = defineModel<number>({ required: true })

// Clamping lives here rather than in each caller, since this is the only thing
// that already knows both bounds — it reads them to disable the buttons.
function step(delta: number) {
  const next = model.value + delta
  model.value = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, next))
}
</script>

<template>
  <div class="stepper" :class="size">
    <RoundButton
      icon="minus"
      :size="size"
      :disabled="min !== undefined && model <= min"
      :aria-label="`Decrease ${label}`"
      @click="step(-1)"
    />
    <slot name="value">
      <span class="value">{{ model }}</span>
    </slot>
    <RoundButton
      icon="plus"
      :size="size"
      :disabled="max !== undefined && model >= max"
      :aria-label="`Increase ${label}`"
      @click="step(1)"
    />
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
}

.stepper.sm {
  gap: 0.75rem;
}

.stepper.lg {
  gap: 1.5rem;
}

/* min-width, not width: the mute counts clamp only at the bottom, so a value
   can reach three digits and must be able to grow rather than clip. */
.value {
  min-width: 2.2rem;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 600;
  /* Tabular, unlike the BPM readout: this number is flanked by buttons, so a
     shifting advance width would visibly jog them. */
  font-variant-numeric: tabular-nums;
  color: #fff;
  flex-shrink: 0;
}
</style>

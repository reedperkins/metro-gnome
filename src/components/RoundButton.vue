<script setup lang="ts">
// The circular +/- button, at the two sizes the app uses: `lg` for the BPM
// control, which is the primary thing you reach for, and `sm` everywhere else.
// The icon is a prop rather than a slot because there are only two of them and
// every caller wants one — a slot would mean repeating the same path data at
// each call site, which is what this replaces.
withDefaults(
  defineProps<{
    icon: 'plus' | 'minus'
    size?: 'sm' | 'lg'
    disabled?: boolean
  }>(),
  { size: 'sm', disabled: false },
)
</script>

<template>
  <button class="round-button" :class="size" :disabled="disabled">
    <!-- Geometric strokes rather than text glyphs. A font's "+" sits on the
         maths axis and "−" on its own optical line, neither of which is the
         centre of the em box, so a text button can't centre them however the
         line-height is set. Here the crossing point is (12,12) in a square
         viewBox, so flex centring is exact. -->
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path :d="icon === 'plus' ? 'M12 6v12M6 12h12' : 'M6 12h12'" />
    </svg>
  </button>
</template>

<style scoped>
.round-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: var(--surface-raised);
  color: var(--text);
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--ring-accent);
  transition: background 0.12s ease-out, transform 0.12s ease-out;
}

.round-button.sm {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 1rem;
}

.round-button.lg {
  width: 3.25rem;
  height: 3.25rem;
  font-size: 1.5rem;
}

/* Shrinking the control shouldn't shrink the target: this pads the small
   variant's hit area back out to 44px without changing anything visible. */
.round-button.sm::after {
  content: '';
  position: absolute;
  inset: -0.25rem;
}

/* Sized in em so each button scales its own icon. */
.icon {
  display: block;
  width: 0.9em;
  height: 0.9em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.round-button:disabled {
  opacity: 0.35;
  cursor: default;
  box-shadow: var(--ring);
}

.round-button:active:not(:disabled) {
  background: var(--surface-pressed);
  transform: scale(0.94);
}

@media (prefers-reduced-motion: reduce) {
  .round-button {
    transition: none;
  }

  .round-button:active {
    transform: none;
  }
}
</style>

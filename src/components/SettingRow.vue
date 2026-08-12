<script setup lang="ts">
// Label on the left, control on the right. Every setting in the lower half of
// the app takes this shape, so they line up as one column.
withDefaults(
  defineProps<{
    label: string
    // Secondary rows — the mute-bar counts nested inside their own card — sit
    // quieter than the top-level settings they hang off.
    subtle?: boolean
  }>(),
  { subtle: false },
)
</script>

<template>
  <div class="setting-row" :class="{ subtle }">
    <span class="label">{{ label }}</span>
    <slot />
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
  color: var(--text);
}

.setting-row.subtle {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.label {
  flex-shrink: 0;
}
</style>

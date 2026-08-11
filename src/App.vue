<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMetronome } from './composables/useMetronome'

const {
  tempo,
  isPlaying,
  flashId,
  flashStrong,
  timeSignature,
  muteBarsEnabled,
  barsOn,
  barsOff,
  toggle,
  setTempo,
  cycleTimeSignature,
  setBarsOn,
  setBarsOff,
} = useMetronome(120)

const sliderValue = computed({
  get: () => Math.round(tempo.value / 5) * 5,
  set: (val: number) => setTempo(val),
})

// Retrigger the flash animation on every pulse beat, even if flashStrong
// is unchanged from last time, by toggling the class off and back on
// after a forced reflow.
const flashing = ref(false)
let flashTimeoutId: number | undefined

watch(flashId, () => {
  flashing.value = false
  clearTimeout(flashTimeoutId)
  requestAnimationFrame(() => {
    flashing.value = true
  })
  flashTimeoutId = window.setTimeout(() => {
    flashing.value = false
  }, 300)
})
</script>

<template>
  <div class="app">
    <svg class="logo" viewBox="0 0 1024 1024" aria-hidden="true">
      <path d="M512 224 L706 660 L318 660 Z" fill="#3a7bfd" />
      <circle cx="512" cy="182" r="38" fill="#ff4433" />
      <ellipse cx="512" cy="808" rx="228" ry="168" fill="#eee" />
      <circle cx="452" cy="676" r="22" fill="#12141a" />
      <circle cx="572" cy="676" r="22" fill="#12141a" />
    </svg>

    <div
      class="signal-light"
      :class="{ flashing, strong: flashStrong }"
    ></div>

    <button class="time-sig" @click="cycleTimeSignature">{{ timeSignature }}</button>

    <div class="tempo-controls">
      <button class="step-button" @click="setTempo(tempo - 1)" aria-label="Decrease by 1 BPM">−</button>
      <div class="tempo-display">{{ tempo }}<span class="unit">BPM</span></div>
      <button class="step-button" @click="setTempo(tempo + 1)" aria-label="Increase by 1 BPM">+</button>
    </div>

    <input
      class="slider"
      type="range"
      min="60"
      max="200"
      step="5"
      v-model.number="sliderValue"
    />

    <div class="mute-bars">
      <label class="mute-toggle">
        <span>Mute Bars</span>
        <span class="switch" :class="{ on: muteBarsEnabled }">
          <input type="checkbox" v-model="muteBarsEnabled" />
          <span class="switch-thumb"></span>
        </span>
      </label>

      <div v-if="muteBarsEnabled" class="mute-steppers">
        <div class="mute-stepper">
          <span class="mute-stepper-label">Play</span>
          <div class="mute-stepper-controls">
            <button class="mini-button" @click="setBarsOn(barsOn - 1)" aria-label="Fewer bars on">−</button>
            <span class="mute-stepper-value">{{ barsOn }}</span>
            <button class="mini-button" @click="setBarsOn(barsOn + 1)" aria-label="More bars on">+</button>
          </div>
        </div>
        <div class="mute-stepper">
          <span class="mute-stepper-label">Mute</span>
          <div class="mute-stepper-controls">
            <button class="mini-button" @click="setBarsOff(barsOff - 1)" aria-label="Fewer bars off">−</button>
            <span class="mute-stepper-value">{{ barsOff }}</span>
            <button class="mini-button" @click="setBarsOff(barsOff + 1)" aria-label="More bars off">+</button>
          </div>
        </div>
      </div>
    </div>

    <button class="play-button" :class="{ playing: isPlaying }" @click="toggle">
      {{ isPlaying ? 'Stop' : 'Start' }}
    </button>

    <div class="wordmark">Metro Gnome</div>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  height: 100vh;
  height: 100dvh;
  padding: 2rem;
  padding-top: max(2rem, env(safe-area-inset-top));
  padding-bottom: max(2rem, env(safe-area-inset-bottom));
  padding-left: max(2rem, env(safe-area-inset-left));
  padding-right: max(2rem, env(safe-area-inset-right));
  background: #12141a;
  color: #eee;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.logo {
  position: absolute;
  top: max(1.25rem, env(safe-area-inset-top));
  left: max(1.5rem, env(safe-area-inset-left));
  width: 2.75rem;
  height: 2.75rem;
}

.signal-light {
  position: absolute;
  top: max(1.5rem, env(safe-area-inset-top));
  right: max(1.5rem, env(safe-area-inset-right));
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #3a1e1e;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.5);
}

.signal-light.flashing {
  animation: impulse-fade 0.3s ease-out;
}

.signal-light.flashing.strong {
  animation-name: impulse-fade-strong;
}

@keyframes impulse-fade {
  0% {
    background: #ff8866;
    box-shadow: 0 0 10px 3px rgba(255, 136, 102, 0.6);
  }
  100% {
    background: #3a1e1e;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.5);
  }
}

@keyframes impulse-fade-strong {
  0% {
    background: #ffffff;
    box-shadow: 0 0 20px 6px rgba(255, 68, 51, 0.9);
  }
  100% {
    background: #3a1e1e;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.5);
  }
}

.time-sig {
  padding: 0.35rem 1rem;
  border-radius: 1rem;
  border: 1px solid #333744;
  background: #1a1d25;
  color: #aab;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.tempo-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.step-button {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: none;
  background: #23262f;
  color: #eee;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.step-button:active {
  background: #2f333e;
}

.tempo-display {
  min-width: 8rem;
  text-align: center;
  font-size: 3rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.unit {
  display: block;
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  color: #888;
}

.slider {
  width: 80%;
  max-width: 24rem;
}

.mute-bars {
  width: 100%;
  max-width: 20rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  background: #1a1d25;
}

.mute-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
  color: #ddd;
  cursor: pointer;
}

.switch {
  position: relative;
  display: inline-block;
  width: 3rem;
  height: 1.75rem;
  border-radius: 1rem;
  background: #23262f;
  transition: background 0.15s ease-out;
}

.switch.on {
  background: #3a7bfd;
}

.switch input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.switch-thumb {
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: #eee;
  transition: transform 0.15s ease-out;
}

.switch.on .switch-thumb {
  transform: translateX(1.25rem);
}

.mute-steppers {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid #262a35;
}

.mute-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #ccc;
}

.mute-stepper-label {
  flex-shrink: 0;
}

.mute-stepper-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mute-stepper-value {
  width: 1.5rem;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
  flex-shrink: 0;
}

.mini-button {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  border: none;
  background: #23262f;
  color: #eee;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.mini-button:active {
  background: #2f333e;
}

.play-button {
  padding: 0.75rem 3rem;
  border-radius: 2rem;
  border: none;
  background: #3a7bfd;
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
}

.play-button.playing {
  background: #d9432f;
}

.wordmark {
  position: absolute;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #444956;
}
</style>

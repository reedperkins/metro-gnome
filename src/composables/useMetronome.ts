import { ref, onUnmounted } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

interface AudioSessionPlugin {
  activate(): Promise<void>
}

const AudioSession = registerPlugin<AudioSessionPlugin>('AudioSession')

const LOOKAHEAD_MS = 25.0
const SCHEDULE_AHEAD_TIME = 0.1

export const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '12/8'] as const
export type TimeSignature = (typeof TIME_SIGNATURES)[number]

// `pulses` = main beats per bar (what the tempo/BPM refers to).
// `subdivision` = clicks per pulse: 1 for simple meters, 3 for compound
// (6/8, 12/8), so the tempo stays anchored to the dotted-quarter pulse and
// the extra clicks land as a triplet feel rather than speeding up the tempo.
const SIGNATURE_CONFIG: Record<TimeSignature, { pulses: number; subdivision: number }> = {
  '4/4': { pulses: 4, subdivision: 1 },
  '3/4': { pulses: 3, subdivision: 1 },
  '6/8': { pulses: 2, subdivision: 3 },
  '12/8': { pulses: 4, subdivision: 3 },
}

export function useMetronome(initialTempo = 120) {
  const tempo = ref(initialTempo)
  const isPlaying = ref(false)
  const timeSignature = ref<TimeSignature>('4/4')

  // Fires only on audible pulse beats (not subdivision filler clicks or
  // muted bars) so the UI can trigger a decaying flash impulse.
  const flashId = ref(0)
  const flashStrong = ref(false)

  const muteBarsEnabled = ref(false)
  const barsOn = ref(2)
  const barsOff = ref(2)

  let audioCtx: AudioContext | null = null
  let timerId: number | null = null
  let nextNoteTime = 0
  let schedulerBeat = 0
  let schedulerBar = 0

  function isBarMuted(barIndex: number): boolean {
    if (!muteBarsEnabled.value) return false
    const cycleLength = barsOn.value + barsOff.value
    if (cycleLength <= 0) return false
    return (barIndex % cycleLength) >= barsOn.value
  }

  function scheduleNote(clickWithinBar: number, barIndex: number, isPulse: boolean, time: number) {
    if (!audioCtx) return
    const isBarStart = clickWithinBar === 0
    const muted = isBarMuted(barIndex)

    if (!muted) {
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = isBarStart ? 1500 : isPulse ? 1200 : 900

      const gain = audioCtx.createGain()
      const peak = isBarStart ? 0.9 : isPulse ? 0.7 : 0.4
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(peak, time + 0.001)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)

      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(time)
      osc.stop(time + 0.06)
    }

    if (isPulse && !muted) {
      const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000)
      setTimeout(() => {
        flashStrong.value = isBarStart
        flashId.value++
      }, delayMs)
    }
  }

  function scheduler() {
    if (!audioCtx) return
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
      const { pulses, subdivision } = SIGNATURE_CONFIG[timeSignature.value]
      const clicksPerBar = pulses * subdivision
      const clickWithinBar = schedulerBeat % clicksPerBar
      const isPulse = clickWithinBar % subdivision === 0
      const secondsPerClick = 60.0 / tempo.value / subdivision

      scheduleNote(clickWithinBar, schedulerBar, isPulse, nextNoteTime)
      nextNoteTime += secondsPerClick
      schedulerBeat++
      if (schedulerBeat % clicksPerBar === 0) {
        schedulerBar++
      }
    }
  }

  function start() {
    if (isPlaying.value) return
    if (Capacitor.isNativePlatform()) {
      AudioSession.activate().catch(() => {})
    }
    // WebKit's Web Audio implementation defaults to a "ambient" session
    // that respects the hardware mute switch. The standardized fix (Safari
    // only, but that's exactly what backs WKWebView) is the AudioSession
    // API: telling it this is "playback" content makes it ignore the switch.
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) {
      nav.audioSession.type = 'playback'
    }
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    schedulerBeat = 0
    schedulerBar = 0
    nextNoteTime = audioCtx.currentTime
    timerId = window.setInterval(scheduler, LOOKAHEAD_MS)
    isPlaying.value = true
  }

  function stop() {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
    isPlaying.value = false
  }

  function toggle() {
    isPlaying.value ? stop() : start()
  }

  function setTempo(bpm: number) {
    tempo.value = Math.min(200, Math.max(60, bpm))
  }

  function cycleTimeSignature() {
    const idx = TIME_SIGNATURES.indexOf(timeSignature.value)
    timeSignature.value = TIME_SIGNATURES[(idx + 1) % TIME_SIGNATURES.length]
  }

  function setBarsOn(n: number) {
    barsOn.value = Math.max(1, n)
  }

  function setBarsOff(n: number) {
    barsOff.value = Math.max(1, n)
  }

  onUnmounted(stop)

  return {
    tempo,
    isPlaying,
    flashId,
    flashStrong,
    timeSignature,
    muteBarsEnabled,
    barsOn,
    barsOff,
    start,
    stop,
    toggle,
    setTempo,
    cycleTimeSignature,
    setBarsOn,
    setBarsOff,
  }
}

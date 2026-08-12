import { ref, watch, onUnmounted } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

interface AudioSessionPlugin {
  activate(): Promise<void>
}

const AudioSession = registerPlugin<AudioSessionPlugin>('AudioSession')

const LOOKAHEAD_MS = 25.0
const SCHEDULE_AHEAD_TIME = 0.1
const ATTACK_TIME = 0.001
// Scheduling the first click at exactly `currentTime` puts it in the past by
// the time the node is wired up, so the envelope's attack ramp is clamped away
// and the gain steps 0 -> peak instantly, which pops. Start slightly ahead.
// 60ms is comfortably longer than the first-start latency but short enough to
// read as instant against the tap. Priming helps but can't be relied on alone:
// on the very first press the AudioContext is still being constructed, so the
// warm-up may not have finished by the time the click event fires.
const START_LEAD_TIME = 0.06

export const TEMPO_MIN = 60
export const TEMPO_MAX = 200

export const BEATS_MIN = 1
export const BEATS_MAX = 12

// Divisions of the beat that can be layered on top of it. The beat itself
// always clicks, so these are purely additive — switching one on doesn't
// replace another, and two that share a position (eighths and sixteenths both
// land on the half-beat) collapse to a single click rather than doubling up.
// The tempo always refers to the beat, so adding a layer packs more clicks
// into the same pulse rather than speeding it up. That's what makes an
// explicit time signature unnecessary: "6/8" is 2 beats with triplets on.
// Drawn as SVG rather than set in a music font: SMuFL has no beamed-triplet
// character at all (Unicode's music glyphs are fixed 2- and 4-note groups), and
// its glyphs are staff-scale, so they never sit right at icon size.
// `notes` = noteheads in the group, `beams` = beam lines (0 = an unbeamed
// quarter, 1 = eighths, 2 = sixteenths), `tuplet` = numeral above the beam.
export const SUBDIVISIONS = [
  { value: 1, notes: 1, beams: 0, tuplet: false, name: 'Beat' },
  { value: 2, notes: 2, beams: 1, tuplet: false, name: 'Eighth notes' },
  { value: 3, notes: 3, beams: 1, tuplet: true, name: 'Eighth-note triplets' },
  { value: 4, notes: 2, beams: 2, tuplet: false, name: 'Sixteenth notes' },
] as const
export type Subdivision = (typeof SUBDIVISIONS)[number]['value']

// Pitch and level per layer. Eighths and triplets share a voice: both divide
// the beat once, so they're the same rhythmic role and only differ in how many
// clicks land. Sixteenths sit a level finer and drop below both, keeping the
// hierarchy that lets a stack of layers be heard as separate layers.
const VOICE: Record<number, { freq: number; peak: number }> = {
  1: { freq: 1200, peak: 0.7 },
  2: { freq: 1050, peak: 0.5 },
  3: { freq: 1050, peak: 0.5 },
  4: { freq: 900, peak: 0.34 },
}

export function useMetronome(initialTempo = 120) {
  const tempo = ref(initialTempo)
  const isPlaying = ref(false)
  const beatsPerBar = ref(4)
  // The beat is on by default; it's the metronome's whole point.
  const subdivisions = ref<Subdivision[]>([1])

  // Fires only on audible pulse beats (not subdivision filler clicks or
  // muted bars) so the UI can trigger a decaying flash impulse.
  const flashId = ref(0)
  const flashStrong = ref(false)

  const muteBarsEnabled = ref(false)
  const barsOn = ref(2)
  const barsOff = ref(2)

  let audioCtx: AudioContext | null = null
  let primed = false
  let timerId: number | null = null
  let nextNoteTime = 0
  let schedulerBeat = 0
  let schedulerBar = 0
  // Which beat counts as beat 1. Changing the meter moves this rather than
  // restarting the clock, so the pulse never breaks stride.
  let barAnchor = 0

  function isBarMuted(barIndex: number): boolean {
    if (!muteBarsEnabled.value) return false
    const cycleLength = barsOn.value + barsOff.value
    if (cycleLength <= 0) return false
    return (barIndex % cycleLength) >= barsOn.value
  }

  // Positions within one beat that click, each tagged with the coarsest active
  // layer that lands on it. Coarse layers subsume fine ones — sixteenths cover
  // every eighth position — so without this tag, turning eighths on while
  // sixteenths are already on would change nothing audible at all. Tagging by
  // the coarsest layer instead accents those shared positions, which is what
  // "eighths and sixteenths together" should sound like.
  function beatClicks(): { offset: number; level: number }[] {
    const level = new Map<number, number>()
    for (const n of [...subdivisions.value].sort((a, b) => a - b)) {
      for (let i = n === 1 ? 0 : 1; i < n; i++) {
        const offset = i / n
        // Sorted ascending, so the first layer to claim a position is the
        // coarsest one and later, finer layers must not overwrite it.
        if (!level.has(offset)) level.set(offset, n)
      }
    }
    return [...level.entries()]
      .map(([offset, l]) => ({ offset, level: l }))
      .sort((a, b) => a.offset - b.offset)
  }

  function scheduleNote(isBarStart: boolean, barIndex: number, level: number, time: number) {
    if (!audioCtx) return
    if (isBarMuted(barIndex)) return

    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = isBarStart ? 1500 : VOICE[level].freq
    const peak = isBarStart ? 0.9 : VOICE[level].peak

    {
      const gain = audioCtx.createGain()
      // The attack has to be long enough to avoid a discontinuity at the
      // waveform's zero crossing (a 1ms step at 1500Hz clicks), but short
      // enough that the beat still reads as sharp.
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(peak, time + ATTACK_TIME)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
      gain.gain.linearRampToValueAtTime(0, time + 0.055)

      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(time)
      osc.stop(time + 0.06)
    }

  }

  // Independent of whether the beat actually clicks: with the beat switched off
  // the light is the only thing still marking it, so it keeps pulsing.
  function scheduleFlash(isBarStart: boolean, barIndex: number, time: number) {
    if (!audioCtx || isBarMuted(barIndex)) return
    const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000)
    setTimeout(() => {
      flashStrong.value = isBarStart
      flashId.value++
    }, delayMs)
  }

  function scheduler() {
    if (!audioCtx) return
    // A whole beat is scheduled at once, rather than one click at a time, so
    // the subdivision layers are only ever read at a beat boundary. Toggling a
    // layer mid-beat therefore takes effect on the next beat instead of
    // disturbing the pulse that's already in flight.
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
      const secondsPerBeat = 60.0 / tempo.value
      const beatWithinBar = (schedulerBeat - barAnchor) % beatsPerBar.value

      scheduleFlash(beatWithinBar === 0, schedulerBar, nextNoteTime)

      for (const { offset, level } of beatClicks()) {
        scheduleNote(
          beatWithinBar === 0 && offset === 0,
          schedulerBar,
          level,
          nextNoteTime + offset * secondsPerBeat,
        )
      }

      nextNoteTime += secondsPerBeat
      schedulerBeat++
      if ((schedulerBeat - barAnchor) % beatsPerBar.value === 0) {
        schedulerBar++
      }
    }
  }

  // Bring the audio stack fully online *before* the user asks for sound.
  // Creating and resuming an AudioContext is not enough: iOS doesn't actually
  // start the output hardware until something is rendered, and that first
  // start-up costs tens of milliseconds. Do it on the press that precedes the
  // Start click, running a silent click through the identical node graph so
  // the real first beat hits an already-warm path. Safe to call repeatedly.
  function prime() {
    activateSession()
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    if (primed) return
    primed = true

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.05)
  }

  function activateSession() {
    if (Capacitor.isNativePlatform()) {
      AudioSession.activate().catch(() => {})
    }
    // WebKit's Web Audio implementation defaults to an "ambient" session
    // that respects the hardware mute switch. The standardized fix (Safari
    // only, but that's exactly what backs WKWebView) is the AudioSession
    // API: telling it this is "playback" content makes it ignore the switch.
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) {
      nav.audioSession.type = 'playback'
    }
  }

  function start() {
    if (isPlaying.value) return
    prime()
    if (!audioCtx) return
    schedulerBeat = 0
    schedulerBar = 0
    barAnchor = 0
    nextNoteTime = audioCtx.currentTime + START_LEAD_TIME
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
    tempo.value = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, bpm))
  }

  function toggleSubdivision(n: Subdivision) {
    subdivisions.value = subdivisions.value.includes(n)
      ? subdivisions.value.filter((s) => s !== n)
      : [...subdivisions.value, n]
  }

  // Turning Mute Bars on mid-playback is a mode switch, not a tweak — just
  // stop so the user can review the settings and hit Start deliberately.
  watch(muteBarsEnabled, () => {
    if (isPlaying.value) stop()
  })

  // Changing the play/mute bar counts mid-playback leaves the scheduler's
  // bar count out of sync with what the user now expects (e.g. they wanted
  // a fresh "2 bars on" starting now, not partway through an old cycle).
  // Restart from bar 0 immediately so the beat doesn't drift or double up.
  // Changing the meter re-anchors the downbeat to the next beat that hasn't
  // been scheduled yet, instead of restarting. A restart would reset the beat
  // clock mid-beat AND leave already-scheduled notes to fire against the new
  // grid — a truncated beat followed by a doubled click, heard as a stutter.
  watch(beatsPerBar, () => {
    if (isPlaying.value) barAnchor = schedulerBeat
  })

  // The mute cycle is counted in whole bars, so re-anchoring it needs the bar
  // counter reset too; the next bar boundary is the natural place for that.
  watch([barsOn, barsOff], () => {
    if (!isPlaying.value) return
    barAnchor = schedulerBeat
    schedulerBar = 0
  })

  onUnmounted(stop)

  return {
    tempo,
    isPlaying,
    flashId,
    flashStrong,
    beatsPerBar,
    subdivisions,
    muteBarsEnabled,
    barsOn,
    barsOff,
    prime,
    start,
    stop,
    toggle,
    setTempo,
    toggleSubdivision,
  }
}

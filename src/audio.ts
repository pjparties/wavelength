export type Sfx = 'click' | 'lock' | 'reveal' | 'miss'

const MASTER = 0.2
const EPS = 0.0001

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined' || !window.AudioContext) return null
  const ac = new window.AudioContext()
  const out = ac.createGain()
  out.gain.value = MASTER
  out.connect(ac.destination)
  ctx = ac
  master = out
  return ac
}

function tone(
  ac: AudioContext,
  at: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  attack = 0.006,
): void {
  const out = master
  if (!out) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(EPS, at + dur)
  osc.connect(g)
  g.connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.02)
  osc.onended = () => {
    osc.disconnect()
    g.disconnect()
  }
}

function noise(ac: AudioContext, at: number, dur: number, peak: number, cutoff: number): void {
  const out = master
  if (!out) return
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buf.getChannelData(0)
  // linear fade inside the buffer keeps the transient soft instead of clicky
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = ac.createBufferSource()
  src.buffer = buf
  const filt = ac.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = cutoff
  const g = ac.createGain()
  g.gain.value = peak
  src.connect(filt)
  filt.connect(g)
  g.connect(out)
  src.start(at)
  src.onended = () => {
    src.disconnect()
    filt.disconnect()
    g.disconnect()
  }
}

function play(ac: AudioContext, name: Sfx): void {
  const t = ac.currentTime + 0.01
  switch (name) {
    case 'click':
      noise(ac, t, 0.012, 0.3, 4000)
      tone(ac, t, 1200, 0.04, 'square', 0.5, 0.002)
      tone(ac, t, 2400, 0.03, 'sine', 0.12, 0.002)
      break
    case 'lock':
      noise(ac, t, 0.02, 0.22, 2500)
      tone(ac, t, 700, 0.055, 'square', 0.4, 0.003)
      tone(ac, t + 0.07, 1050, 0.06, 'square', 0.3, 0.003)
      break
    case 'reveal':
      ;[523.25, 659.25, 783.99].forEach((f, i) => {
        tone(ac, t + i * 0.07, f, 0.14, 'triangle', 0.45, 0.02)
      })
      break
    case 'miss':
      noise(ac, t, 0.08, 0.25, 400)
      tone(ac, t, 140, 0.18, 'sine', 0.6, 0.004)
      break
  }
}

export function playSfx(name: Sfx): void {
  try {
    if (!enabled) return
    const ac = ensureContext()
    if (!ac) return
    if (ac.state === 'suspended') void ac.resume().catch(() => {})
    play(ac, name)
  } catch {
    // audio must never break the game
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    enabled = on
    if (ctx && master) master.gain.setValueAtTime(on ? MASTER : 0, ctx.currentTime)
  } catch {
    // ignore
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

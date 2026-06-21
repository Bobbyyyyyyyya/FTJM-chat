let ctx: AudioContext | null = null
let gainNode: GainNode | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null

function getContext() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function playTone(frequency: number, duration: number) {
  const c = getContext()
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, c.currentTime)

  const g = c.createGain()
  g.gain.setValueAtTime(0.3, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + duration)

  osc.connect(g)
  g.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + duration)
}

function ringCycle() {
  if (!ctx) return
  playTone(440, 0.4)
  playTone(480, 0.4)
  timeoutId = setTimeout(ringCycle, 2000)
}

export function startRingtone() {
  stopRingtone()
  const c = getContext()
  if (c.state === 'suspended') c.resume()
  ringCycle()
}

export function stopRingtone() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

let audioCtx: AudioContext | null = null

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function playSyntheticSound(
  type: 'dialing' | 'ringing' | 'end_call',
  onEnd?: () => void,
) {
  const ctx = getAudioCtx()
  const now = ctx.currentTime

  if (type === 'dialing') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 425
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.5)
    if (onEnd) {
      osc.onended = () => {
        setTimeout(() => playSyntheticSound('dialing', onEnd), 2500)
      }
    }
    return { stop: () => { try { osc.stop() } catch {} } }
  }

  if (type === 'ringing') {
    let stopped = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    function ringCycle() {
      if (stopped) return
      const c = getAudioCtx()
      const t = c.currentTime
      const o1 = c.createOscillator()
      const o2 = c.createOscillator()
      const g = c.createGain()
      o1.type = 'sine'
      o1.frequency.value = 440
      o2.type = 'sine'
      o2.frequency.value = 480
      g.gain.setValueAtTime(0.3, t)
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
      o1.connect(g)
      o2.connect(g)
      g.connect(c.destination)
      o1.start(t)
      o2.start(t)
      o1.stop(t + 0.4)
      o2.stop(t + 0.4)
      timeout = setTimeout(ringCycle, 2000)
    }
    ringCycle()
    if (onEnd) onEnd()
    return { stop: () => { stopped = true; if (timeout) clearTimeout(timeout) } }
  }

  if (type === 'end_call') {
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.value = 440
    osc2.type = 'sine'
    osc2.frequency.value = 350
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)
    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.3)
    osc2.stop(now + 0.3)
    if (onEnd) {
      osc2.onended = onEnd
    }
    return { stop: () => { try { osc1.stop(); osc2.stop() } catch {} } }
  }

  return { stop: () => {} }
}

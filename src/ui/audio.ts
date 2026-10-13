/** A little motor whine and steering buzz made in the browser. Starts only after a user gesture. */
export class MotorSound {
  enabled = true;
  private nodes: { ctx: AudioContext; osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; steerGain: GainNode } | null = null;

  /** Call from a pointer or key handler: browsers only allow audio after the user interacts. */
  start(): void {
    if (this.nodes || !this.enabled) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      const osc2 = ctx.createOscillator(); osc2.type = 'square';
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(filt); osc2.connect(filt); filt.connect(gain); gain.connect(ctx.destination); osc.start(); osc2.start();
      const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = 420;
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1200;
      const steerGain = ctx.createGain(); steerGain.gain.value = 0;
      s.connect(sf); sf.connect(steerGain); steerGain.connect(ctx.destination); s.start();
      this.nodes = { ctx, osc, osc2, gain, steerGain };
    } catch {
      this.nodes = null;
    }
  }

  mute(): void {
    if (!this.nodes) return;
    this.nodes.gain.gain.value = 0; this.nodes.steerGain.gain.value = 0;
  }

  update(throttle: number, steerVel: number, timeScale: number): void {
    if (!this.nodes || !this.enabled) return;
    const { ctx, osc, osc2, gain, steerGain } = this.nodes, t = ctx.currentTime, sp = Math.abs(throttle);
    osc.frequency.setTargetAtTime(90 + sp * 260 * timeScale, t, 0.05);
    osc2.frequency.setTargetAtTime(35 + sp * 130 * timeScale, t, 0.05);
    gain.gain.setTargetAtTime(sp > 0.02 ? 0.035 + sp * 0.05 : 0, t, 0.06);
    steerGain.gain.setTargetAtTime(Math.abs(steerVel) > 0.05 ? 0.025 : 0, t, 0.02);
  }
}

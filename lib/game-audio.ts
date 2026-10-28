const TRACKS: Record<string, number[]> = {
  sky: [392, 494, 587, 659, 587, 494, 440, 523],
  lava: [196, 233, 262, 311, 262, 233, 220, 262],
  jungle: [262, 330, 392, 440, 392, 330, 294, 349],
  ice: [349, 440, 523, 587, 523, 440, 392, 494],
  neon: [294, 370, 440, 523, 440, 370, 330, 392],
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private enabled = true;

  constructor(private mapId: string) {}

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = .72;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
    if (this.musicTimer === null) {
      this.playMusicStep();
      this.musicTimer = window.setInterval(() => this.playMusicStep(), 340);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.unlock();
      this.master?.gain.setTargetAtTime(.72, this.context?.currentTime ?? 0, .025);
    } else if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, .02);
    }
  }

  jump() {
    this.unlock();
    this.sweep(330, 720, .14, "square", .12);
  }

  boost() {
    this.unlock();
    this.sweep(150, 620, .28, "sawtooth", .13);
    this.sweep(95, 260, .34, "triangle", .08, .035);
  }

  respawn() {
    this.unlock();
    this.sweep(240, 780, .42, "triangle", .11);
  }

  stop() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }

  private playMusicStep() {
    if (!this.enabled || !this.context || !this.master) return;
    const track = TRACKS[this.mapId] ?? TRACKS.neon;
    const note = track[this.musicStep % track.length];
    this.tone(note, .27, "triangle", .032);
    if (this.musicStep % 4 === 0) this.tone(note / 2, .58, "sine", .024);
    if (this.musicStep % 2 === 1) this.tone(note * 2, .09, "square", .012, .05);
    this.musicStep++;
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (!this.enabled || !this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(this.master);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  private sweep(from: number, to: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (!this.enabled || !this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(this.master);
    oscillator.start(start); oscillator.stop(start + duration + .03);
  }
}

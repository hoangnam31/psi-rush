const TRACKS: Record<string, number[]> = {
  lobby: [262, 330, 392, 523, 440, 392, 330, 349],
  sky: [392, 494, 587, 659, 587, 494, 440, 523],
  lava: [196, 233, 262, 311, 262, 233, 220, 262],
  jungle: [262, 330, 392, 440, 392, 330, 294, 349],
  ice: [349, 440, 523, 587, 523, 440, 392, 494],
  sweep: [330, 415, 494, 622, 494, 415, 370, 554],
  neon: [294, 370, 440, 523, 440, 370, 330, 392],
};

let sharedContext: AudioContext | null = null;
let sharedMaster: GainNode | null = null;

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private enabled = true;

  constructor(private mapId: string) {}

  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!sharedContext || sharedContext.state === "closed") {
        sharedContext = new AudioContext();
        sharedMaster = sharedContext.createGain();
        sharedMaster.gain.value = .9;
        sharedMaster.connect(sharedContext.destination);
      }
      this.context = sharedContext;
      this.master = sharedMaster;
    } catch {
      return false;
    }
    this.master?.gain.setTargetAtTime(.9, this.context.currentTime, .018);
    const startMusic = () => {
      if (!this.enabled || this.context?.state !== "running" || this.musicTimer !== null) return;
      this.playMusicStep();
      this.musicTimer = window.setInterval(() => this.playMusicStep(), 340);
    };
    if (this.context.state === "suspended") {
      try { await this.context.resume(); } catch { return false; }
    }
    startMusic();
    return this.context.state === "running";
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      void this.unlock();
      this.master?.gain.setTargetAtTime(.9, this.context?.currentTime ?? 0, .025);
    } else if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, .02);
    }
  }

  jump() {
    void this.unlock();
    this.sweep(330, 720, .14, "square", .12);
  }

  boost() {
    void this.unlock();
    this.sweep(150, 620, .28, "sawtooth", .13);
    this.sweep(95, 260, .34, "triangle", .08, .035);
  }

  respawn() {
    void this.unlock();
    this.sweep(240, 780, .42, "triangle", .11);
  }

  checkpoint() {
    void this.unlock();
    this.tone(523, .2, "triangle", .14);
    this.tone(659, .22, "triangle", .13, .09);
    this.tone(784, .3, "sine", .12, .18);
  }

  collision(strong = false) {
    void this.unlock();
    this.sweep(strong ? 220 : 170, strong ? 72 : 92, strong ? .2 : .13, "square", strong ? .16 : .11);
    this.tone(strong ? 64 : 82, strong ? .18 : .1, "sine", strong ? .16 : .1);
  }

  stop() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.context = null;
    this.master = null;
  }

  private playMusicStep() {
    if (!this.enabled || !this.context || !this.master) return;
    const track = TRACKS[this.mapId] ?? TRACKS.neon;
    const note = track[this.musicStep % track.length];
    this.tone(note, .27, "triangle", .068);
    if (this.musicStep % 4 === 0) this.tone(note / 2, .58, "sine", .047);
    if (this.musicStep % 2 === 1) this.tone(note * 2, .09, "square", .024, .05);
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

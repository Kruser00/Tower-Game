export class SoundManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private noteIndex: number = 0;
  private isMuted: boolean = false;

  // C Major Scale spanning 3 octaves (C4 to B6)
  private readonly SCALE = [
    261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, // C4 - B4
    523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, // C5 - B5
    1046.50, 1174.66, 1318.51, 1396.91, 1567.98, 1760.00, 1975.53 // C6 - B6
  ];

  constructor() {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.context) {
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.context.destination);
        this.setupReverb();
      }
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  private setupReverb() {
    if (!this.context) return;
    
    // Create a procedural impulse response for the reverb
    const duration = 2.0;
    const decay = 2.0;
    const rate = this.context.sampleRate;
    const length = rate * duration;
    const impulse = this.context.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      // Exponential decay to simulate room acoustics
      const vol = Math.pow(1 - n, decay); 
      left[i] = (Math.random() * 2 - 1) * vol;
      right[i] = (Math.random() * 2 - 1) * vol;
    }

    this.reverbNode = this.context.createConvolver();
    this.reverbNode.buffer = impulse;
    // We don't connect reverb to master yet; we'll connect individual notes to it
    this.reverbNode.connect(this.masterGain!);
  }

  public resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * Synth Pluck Sound
   */
  private playNote(freq: number, isPerfect: boolean) {
    if (!this.context || !this.masterGain || this.isMuted) return;

    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    // Pluck sound: Triangle wave + Lowpass filter envelope
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Filter to shape the tone (make it less harsh)
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isPerfect ? 3000 : 1500, t); // Brighter if perfect
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.5); // Filter decay

    // Amplitude Envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(isPerfect ? 0.8 : 0.5, t + 0.01); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5); // Decay

    // Connections
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // If Perfect, add reverb
    if (isPerfect && this.reverbNode) {
      const reverbGain = this.context.createGain();
      reverbGain.gain.value = 0.5;
      gain.connect(reverbGain);
      reverbGain.connect(this.reverbNode);
    }

    osc.start(t);
    osc.stop(t + 0.6);
  }

  public playPlace() {
    // Regular placement
    const freq = this.SCALE[this.noteIndex % this.SCALE.length];
    this.playNote(freq, false);
    this.noteIndex++;
  }

  public playPerfect(combo: number) {
    // Perfect placement - louder, reverb, brighter
    const freq = this.SCALE[this.noteIndex % this.SCALE.length];
    this.playNote(freq, true);
    
    // Add a harmonic for high combos
    if (combo > 5) {
       this.playNote(freq * 1.5, false); // Fifth above
    }
    
    this.noteIndex++;
  }

  public playGameOver() {
    if (!this.context || !this.masterGain || this.isMuted) return;
    
    // Reset melody
    this.noteIndex = 0;

    // Discordant sound
    const t = this.context.currentTime;
    const freqs = [100, 146, 178]; // Diminished triad
    
    freqs.forEach(f => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.5, t + 1.5); // Pitch drop
      
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  }
}
// Synthetic audio chime using Web Audio API for queue alerts

class SoundService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /** Resume audio and prime speech synthesis from a user interaction before async requests. */
  public prepareForAnnouncement() {
    try {
      const ctx = this.getAudioContext();
      if (ctx?.state === 'suspended') void ctx.resume();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('Could not prepare audio announcement:', e);
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  /**
   * Plays a classic 2-tone or 3-tone pleasant airport/hospital chime
   */
  public playChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const notes = [
        { freq: 523.25, time: 0, duration: 0.35 },    // C5
        { freq: 659.25, time: 0.22, duration: 0.35 }, // E5
        { freq: 783.99, time: 0.44, duration: 0.6 },  // G5
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

        gain.gain.setValueAtTime(0, ctx.currentTime + note.time);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + note.time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + note.time);
        osc.stop(ctx.currentTime + note.time + note.duration);
      });
    } catch (e) {
      console.warn('Audio playback not permitted yet:', e);
    }
  }

  /**
   * Voice synthesis announcement e.g. "Now serving A23 at Counter 1"
   */
  public announceTurn(displayNumber: string, counterName?: string, template?: string, businessName?: string) {
    this.playChime();

    if (!this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      const defaultTemplate = counterName ? "Now serving, number {number}, at {counter}." : "Now serving, number {number}."; 
      const selectedTemplate = (template || defaultTemplate).trim() || defaultTemplate;
      const text = selectedTemplate
        .replace(/\{number\}/gi, displayNumber)
        .replace(/\{counter\}/gi, counterName || "the service counter")
        .replace(/\{business\}/gi, businessName || "");
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
      };
      // Avoid a delayed setTimeout that can lose the browser's audio activation.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
      speak();
    } catch (err) {
      console.warn('Voice announcement error:', err);
    }
  }
}

export const soundService = new SoundService();

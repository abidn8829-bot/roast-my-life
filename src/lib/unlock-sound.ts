// Tiny Web Audio synth for the achievement-unlock chime — no audio file, no library.
// Browsers block audio before a user gesture, so this may silently no-op on first load.
export function playUnlockSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.value = 0.35;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const now = ctx.currentTime;

    // Percussive impact thump right at the start, for a punchier attack.
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180, now);
    thump.frequency.exponentialRampToValueAtTime(60, now + 0.09);
    thumpGain.gain.setValueAtTime(0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.11);

    // Rising major arpeggio (G4, C5, E5, B5) — each note doubled an octave up,
    // quieter, for brightness/shimmer on top of the triangle-wave body.
    const notes = [392.0, 523.25, 659.25, 987.77];
    const noteInterval = 0.085;
    const noteDuration = 0.2;

    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      const noteStart = now + 0.03 + i * noteInterval;
      const dur = isLast ? 0.45 : noteDuration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(isLast ? 0.5 : 0.4, noteStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(noteStart);
      osc.stop(noteStart + dur + 0.02);

      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2;
      shimmerGain.gain.setValueAtTime(0, noteStart);
      shimmerGain.gain.linearRampToValueAtTime(isLast ? 0.18 : 0.12, noteStart + 0.015);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur * 0.8);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(master);
      shimmer.start(noteStart);
      shimmer.stop(noteStart + dur + 0.02);
    });

    const totalDurationMs = (0.03 + notes.length * noteInterval + 0.5) * 1000;
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // Already closed or unsupported — nothing to do.
      }
    }, totalDurationMs);
  } catch {
    // AudioContext unavailable/blocked — silently no-op, this is expected.
  }
}

// Soft, non-intrusive WebAudio "ding" — no asset required.
let ctx: AudioContext | null = null;

export const playNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;
    ctx =
      ctx ||
      new (window.AudioContext || (window as any).webkitAudioContext)();
    const c = ctx;
    if (c.state === "suspended") c.resume().catch(() => {});
    const now = c.currentTime;

    const play = (freq: number, start: number, dur: number) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(0.15, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g).connect(c.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.05);
    };
    play(880, 0, 0.18);
    play(1320, 0.14, 0.22);
  } catch {
    /* ignore */
  }
};

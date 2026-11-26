// Synthesised sound for Ridge Runner: no audio files, everything is made
// with the Web Audio API. The engine hum follows the throttle, rings chime,
// landings fanfare and crashes thud. All of it is guarded: if the browser
// has no audio (a headless screenshot run) nothing throws, and nothing
// starts before the pilot's first gesture.

export function createAudio() {
  const audio = {
    muted: false,
    context: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
  };

  function ensureContext() {
    if (audio.context) return audio.context;
    try {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return null;
      audio.context = new Context();
    } catch {
      return null;
    }
    return audio.context;
  }

  // Start the engine hum. Call after the first click or keypress.
  audio.startEngine = function startEngine() {
    const ctx = ensureContext();
    if (!ctx || audio.engineOsc) return;
    try {
      audio.engineOsc = ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineFilter = ctx.createBiquadFilter();
      audio.engineFilter.type = 'lowpass';
      audio.engineFilter.frequency.value = 320;
      audio.engineGain = ctx.createGain();
      audio.engineGain.gain.value = 0.0;
      audio.engineOsc.connect(audio.engineFilter);
      audio.engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(ctx.destination);
      audio.engineOsc.start();
    } catch {
      audio.engineOsc = null;
    }
  };

  // Throttle 0..1 and speed in knots set the hum's pitch and loudness.
  audio.setEngine = function setEngine(throttle, speedKt, airborne) {
    if (!audio.context || !audio.engineOsc || audio.muted) return;
    try {
      const target = airborne ? 0.045 + throttle * 0.05 : 0.02 + throttle * 0.03;
      audio.engineGain.gain.setTargetAtTime(target, audio.context.currentTime, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(
        48 + throttle * 55 + speedKt * 0.12,
        audio.context.currentTime,
        0.1,
      );
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  };

  function blip(frequency, startAt, duration, type, volume) {
    const ctx = ensureContext();
    if (!ctx || audio.muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration + 0.05);
    } catch {
      // Ignore.
    }
  }

  audio.ringChime = function ringChime() {
    blip(880, 0, 0.35, 'sine', 0.22);
    blip(1318, 0.09, 0.4, 'sine', 0.18);
  };

  audio.landFanfare = function landFanfare() {
    [523, 659, 784, 1046].forEach((freq, i) => blip(freq, i * 0.13, 0.5, 'triangle', 0.2));
  };

  audio.crashThud = function crashThud() {
    const ctx = ensureContext();
    if (!ctx || audio.muted) return;
    try {
      const length = Math.floor(ctx.sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // Ignore.
    }
    blip(70, 0, 0.5, 'sine', 0.3);
  };

  audio.stallWarning = function stallWarning() {
    blip(220, 0, 0.18, 'square', 0.1);
    blip(220, 0.25, 0.18, 'square', 0.1);
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.engineGain && audio.context) {
      audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : 0.05, audio.context.currentTime, 0.05);
    }
    return audio.muted;
  };

  return audio;
}

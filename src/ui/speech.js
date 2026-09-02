/**
 * speech.js — the examiner's voice.
 *
 * A thin, defensive wrapper over the Web Speech API. Defensive because this API
 * is unusually unreliable in practice:
 *
 *  - `getVoices()` is empty on first call in most browsers, filling in later via
 *    a `voiceschanged` event that sometimes never fires.
 *  - A machine with no voices installed (many Linux boxes, headless browsers)
 *    has the whole API present and functional-looking, then fails every
 *    utterance instantly with `synthesis-failed`.
 *  - Chrome silently stops long utterances after ~15 seconds unless nudged.
 *  - Some engines fire neither `end` nor `error`.
 *
 * The rule that follows: **nothing in the test may wait on speech.** `speak()`
 * always settles — on `end`, on `error`, or on a deadline computed from the
 * text — so a subtest can never deadlock because a voice is missing. Speech is
 * an enhancement on top of a timer-driven test, never the clock itself.
 */

import { estimateSpeechMs } from '../exam/administration.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

/**
 * Error codes that mean this engine genuinely cannot speak.
 *
 * Crucially, `canceled` and `interrupted` are NOT among them. Those are what
 * the API reports when speech is deliberately stopped — which this app does on
 * every screen change and before every interrupting utterance. Treating them as
 * capability failures disabled the voice permanently the first time the user
 * moved to a new screen, which is exactly what happened.
 */
const FATAL_ERRORS = new Set([
  'synthesis-failed',
  'synthesis-unavailable',
  'audio-hardware',
  'voice-unavailable',
  'language-unavailable',
]);

/**
 * Whether an utterance error means the engine cannot speak at all, as opposed
 * to a transient problem or an interruption this app caused itself.
 *
 * Exported so the rule can be tested directly: getting it wrong silently kills
 * the voice for the rest of the session, which is not visible in any output.
 */
export function isFatalSpeechError(code) {
  return FATAL_ERRORS.has(code);
}

const state = {
  enabled: true,
  rate: 0.95,          // a shade under natural pace; examiners do not rush
  voice: null,
  voicesReady: false,
  /** Set once an utterance actually fails, so the UI can stop promising audio. */
  known: { supported: Boolean(synth), working: null },
};

/** Whether the API exists at all. Says nothing about whether it can speak. */
export function isSupported() {
  return Boolean(synth);
}

/**
 * Whether speech is expected to produce sound: the API exists, a voice is
 * installed, and no utterance has failed yet.
 */
export function isAvailable() {
  if (!synth) return false;
  if (state.known.working === false) return false;
  return synth.getVoices().length > 0;
}

/** Whether the examiner voice is switched on and able to speak. */
export function isSpeaking() {
  return state.enabled && isAvailable();
}

export function setEnabled(enabled) {
  state.enabled = Boolean(enabled);
  if (!state.enabled) cancel();
}

export function isEnabled() {
  return state.enabled;
}

export function setRate(rate) {
  state.rate = Math.min(2, Math.max(0.5, Number(rate) || 1));
}

export function getRate() {
  return state.rate;
}

/**
 * Wait for the voice list to populate.
 *
 * Resolves either way after `timeoutMs`: a browser that never fires
 * `voiceschanged` must not stall the opening screen.
 */
export function ready(timeoutMs = 1200) {
  if (!synth) return Promise.resolve(false);
  if (state.voicesReady || synth.getVoices().length > 0) {
    state.voicesReady = true;
    chooseVoice();
    return Promise.resolve(synth.getVoices().length > 0);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      state.voicesReady = true;
      chooseVoice();
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(synth.getVoices().length > 0);
    };
    synth.addEventListener?.('voiceschanged', finish);
    setTimeout(finish, timeoutMs);
  });
}

/** Prefer a local English voice; a remote one stutters on slow connections. */
function chooseVoice() {
  const voices = synth?.getVoices() ?? [];
  if (voices.length === 0) { state.voice = null; return; }

  const english = voices.filter((v) => /^en(-|$)/i.test(v.lang));
  const pool = english.length > 0 ? english : voices;
  state.voice = pool.find((v) => v.localService) ?? pool[0];
}

export function voiceName() {
  return state.voice?.name ?? null;
}

/**
 * Speak a phrase. Always settles.
 *
 * @returns {Promise<'spoken'|'skipped'|'failed'|'timeout'>} how it ended, so a
 *          caller can tell a real utterance from a silent no-op.
 */
export function speak(text, { rate = state.rate, interrupt = true } = {}) {
  const phrase = String(text ?? '').trim();
  if (!phrase) return Promise.resolve('skipped');
  if (!state.enabled || !synth || !isAvailable()) return Promise.resolve('skipped');

  // Callers speak fire-and-forget. A rejected promise here would surface as an
  // unhandled rejection rather than a caught failure, so this never rejects:
  // every path resolves with an outcome instead.

  return new Promise((resolve) => {
    let settled = false;
    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearInterval(keepAlive);
      resolve(outcome);
    };

    let utterance;
    try {
      utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = rate;
      utterance.pitch = 1;
      // Assigning a voice can throw on engines that reject the object they
      // themselves handed out. Falling back to the default voice is far better
      // than failing the utterance, so this is caught on its own.
      if (state.voice) {
        try { utterance.voice = state.voice; } catch { state.voice = null; }
      }
    } catch {
      state.known.working = false;
      settle('failed');
      return;
    }

    utterance.onend = () => settle('spoken');
    utterance.onerror = (event) => {
      const code = event?.error ?? 'unknown';
      // Only a genuine engine failure means this machine cannot speak. Being
      // interrupted is something this app does to itself, constantly.
      if (FATAL_ERRORS.has(code)) state.known.working = false;
      settle(code === 'canceled' || code === 'interrupted' ? 'interrupted' : 'failed');
    };

    // Chrome pauses long utterances after ~15s; a periodic resume prevents it.
    const keepAlive = setInterval(() => {
      if (synth.speaking && !synth.paused) synth.resume();
    }, 8000);

    // The backstop: some engines fire no events at all.
    const deadline = setTimeout(
      () => settle('timeout'),
      estimateSpeechMs(phrase, rate) + 2000
    );

    const start = () => {
      try {
        synth.speak(utterance);
        state.known.working = state.known.working ?? true;
      } catch {
        state.known.working = false;
        settle('failed');
      }
    };

    // Only cancel when there is something to cancel, and never queue in the
    // same tick as a cancel: Chrome drops an utterance handed to it while it is
    // still tearing the previous one down.
    if (interrupt && (synth.speaking || synth.pending)) {
      cancel();
      setTimeout(start, 0);
    } else {
      start();
    }
  });
}

/**
 * Speak a run of digits at a fixed cadence, and resolve when the last one has
 * been given its full slot.
 *
 * The cadence is driven by `onDigit` timers, never by the voice: Digit Span
 * depends on even, one-per-second presentation, and letting a synthesiser set
 * the pace would vary the interval by digit length and machine speed.
 *
 * @param {Array<{digit:number,text:string,atMs:number}>} schedule
 * @param {(entry, index) => void} onDigit  called at each digit's moment
 */
export function speakSchedule(schedule, onDigit, { intervalMs = 1000 } = {}) {
  const timers = [];
  const utterances = [];
  let stopped = false;

  const finished = new Promise((resolve) => {
    schedule.forEach((entry, index) => {
      timers.push(setTimeout(() => {
        if (stopped) return;
        onDigit?.(entry, index);
        // Digits queue rather than interrupt, so the run stays in order even if
        // a slow voice overruns its slot.
        utterances.push(speak(entry.text, { interrupt: false }));
      }, entry.atMs));
    });

    const lastAt = schedule.length === 0 ? 0 : schedule[schedule.length - 1].atMs;
    timers.push(setTimeout(() => {
      // Resolve only once the last digit has actually finished being spoken,
      // not merely when its slot elapses. Resolving on the timer alone let the
      // caller move on and say its next line, which cancelled digits that had
      // been queued but never heard.
      Promise.all(utterances).then(() => { if (!stopped) resolve(); });
    }, lastAt + intervalMs));
  });

  return {
    finished,
    /** Named `stop` so it cannot be confused with the module-level cancel(). */
    stop() {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      cancel();
    },
  };
}

export function cancel() {
  if (!synth) return;
  try {
    synth.cancel();
    // Chrome can be left in a paused state by a cancel, after which nothing
    // further is ever spoken until it is resumed.
    if (synth.paused) synth.resume();
  } catch { /* nothing useful to do */ }
}

/**
 * Whether the engine has reported a fatal failure.
 * Exposed so the UI can explain the fallback rather than silently going quiet.
 */
export function hasFailed() {
  return state.known.working === false;
}

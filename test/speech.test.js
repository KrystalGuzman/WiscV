import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFatalSpeechError, isSupported, isAvailable, isSpeaking,
  isEnabled, setEnabled, setRate, getRate, speak, cancel, ready, hasFailed,
} from '../src/ui/speech.js';

describe('speech error classification', () => {
  // Regression, and the important one in this file. `cancel()` makes the API
  // report `canceled`/`interrupted` on whatever it stopped — and this app
  // cancels on every screen change. Treating that as a capability failure
  // silently killed the examiner's voice for the rest of the session after the
  // very first screen change, with nothing in the UI to show why.
  test('interrupting our own speech is never a fatal error', () => {
    assert.equal(isFatalSpeechError('canceled'), false);
    assert.equal(isFatalSpeechError('interrupted'), false);
  });

  test('a genuinely broken engine is fatal', () => {
    assert.equal(isFatalSpeechError('synthesis-failed'), true);
    assert.equal(isFatalSpeechError('synthesis-unavailable'), true);
    assert.equal(isFatalSpeechError('audio-hardware'), true);
    assert.equal(isFatalSpeechError('voice-unavailable'), true);
    assert.equal(isFatalSpeechError('language-unavailable'), true);
  });

  test('recoverable and per-utterance problems are not fatal', () => {
    // Blocked autoplay can be unlocked by a later gesture; a busy device frees
    // up; a bad rate or an over-long string is a problem with that utterance
    // alone. None should disable the voice for good.
    assert.equal(isFatalSpeechError('not-allowed'), false);
    assert.equal(isFatalSpeechError('audio-busy'), false);
    assert.equal(isFatalSpeechError('text-too-long'), false);
    assert.equal(isFatalSpeechError('rate-not-supported'), false);
    assert.equal(isFatalSpeechError('invalid-argument'), false);
  });

  test('an unrecognised code is not treated as fatal', () => {
    // Engines invent codes. Defaulting to fatal would mute the app on an
    // unknown string; defaulting to survivable degrades far more gracefully.
    assert.equal(isFatalSpeechError('something-new'), false);
    assert.equal(isFatalSpeechError(undefined), false);
    assert.equal(isFatalSpeechError(''), false);
  });
});

describe('behaviour without a browser', () => {
  test('reports no support rather than throwing', () => {
    assert.equal(isSupported(), false);
    assert.equal(isAvailable(), false);
    assert.equal(isSpeaking(), false);
    assert.equal(hasFailed(), false);
  });

  test('speak resolves rather than hanging or rejecting', async () => {
    // Callers speak fire-and-forget; a rejection would surface as an unhandled
    // rejection, and a hang would stall a subtest.
    assert.equal(await speak('anything'), 'skipped');
    assert.equal(await speak(''), 'skipped');
    assert.equal(await speak(null), 'skipped');
  });

  test('ready() settles even with nothing to wait for', async () => {
    assert.equal(await ready(10), false);
  });

  test('cancel is safe with no engine', () => {
    assert.doesNotThrow(() => cancel());
  });
});

describe('voice settings', () => {
  test('enabling and disabling is observable', () => {
    setEnabled(false);
    assert.equal(isEnabled(), false);
    setEnabled(true);
    assert.equal(isEnabled(), true);
  });

  test('rate is clamped to a usable range', () => {
    setRate(5);
    assert.equal(getRate(), 2);
    setRate(0.01);
    assert.equal(getRate(), 0.5);
    setRate(1.2);
    assert.ok(Math.abs(getRate() - 1.2) < 1e-9);
  });

  test('a nonsense rate falls back rather than producing NaN', () => {
    setRate('fast');
    assert.ok(Number.isFinite(getRate()));
    setRate(1);
  });
});

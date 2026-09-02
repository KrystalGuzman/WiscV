import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMINER_SCRIPT, scriptFor, promptFor, isRepeatable, isAuditory, sampleFor,
  sampleSpoken, teachingFeedback, estimateSpeechMs, digitSchedule, DIGIT_INTERVAL_MS,
} from '../src/exam/administration.js';
import { SUBTESTS } from '../src/core/model.js';

describe('the examiner script', () => {
  test('covers every subtest, plus an opening and a closing', () => {
    for (const subtest of SUBTESTS) {
      const script = scriptFor(subtest.id);
      assert.ok(script, `${subtest.id} has no script`);
      assert.ok(script.intro && script.intro.length > 40, `${subtest.id}: intro too thin`);
      assert.ok(script.prompt, `${subtest.id}: no item prompt`);
    }
    assert.ok(EXAMINER_SCRIPT.opening.length > 40);
    assert.ok(EXAMINER_SCRIPT.closing.length > 10);
  });

  test('every prompt resolves to speakable text', () => {
    const contexts = {
      si: { stem: 'How are a cat and a dog alike?' },
      vo: { stem: 'ancient' },
      ds: { mode: 'backward' },
    };
    for (const subtest of SUBTESTS) {
      const spoken = promptFor(subtest.id, contexts[subtest.id] ?? {});
      assert.equal(typeof spoken, 'string', `${subtest.id}: prompt is not a string`);
      assert.ok(spoken.length > 5, `${subtest.id}: prompt too short — "${spoken}"`);
      assert.ok(!/undefined|NaN|\[object/.test(spoken), `${subtest.id}: "${spoken}"`);
    }
  });

  test('Digit Span names its condition differently each way', () => {
    const forward = promptFor('ds', { mode: 'forward' });
    const backward = promptFor('ds', { mode: 'backward' });
    const sequencing = promptFor('ds', { mode: 'sequencing' });
    assert.equal(new Set([forward, backward, sequencing]).size, 3);
    assert.match(backward, /backwards|last/i);
    assert.match(sequencing, /smallest|order/i);
  });

  test('an unknown subtest yields nothing rather than throwing', () => {
    assert.equal(scriptFor('zz'), null);
    assert.equal(sampleSpoken('zz'), '');
    assert.equal(promptFor('zz'), '');
    assert.equal(sampleFor('zz'), null);
    assert.equal(teachingFeedback('zz', 2), '');
  });
});

describe('repetition rules', () => {
  test('Digit Span refuses repetition; the rest allow it', () => {
    // Hearing a sequence twice measures something other than span, so this is
    // a rule of the task rather than a limitation of the app.
    assert.equal(isRepeatable('ds'), false);
    for (const subtest of SUBTESTS) {
      if (subtest.id === 'ds' || subtest.id === 'pc') continue;
      assert.equal(isRepeatable(subtest.id), true, `${subtest.id} should be repeatable`);
    }
  });

  test('Picture Span also refuses, for the same reason', () => {
    assert.equal(isRepeatable('pc'), false);
  });

  test('an unknown subtest defaults to repeatable rather than silently refusing', () => {
    assert.equal(isRepeatable('zz'), true);
  });
});

describe('auditory presentation', () => {
  test('Digit Span is the auditory subtest', () => {
    assert.equal(isAuditory('ds'), true);
    for (const subtest of SUBTESTS) {
      if (subtest.id === 'ds') continue;
      assert.equal(isAuditory(subtest.id), false, `${subtest.id} should not be auditory`);
    }
  });
});

describe('teaching items', () => {
  test('the two verbal subtests open with a sample', () => {
    for (const id of ['si', 'vo']) {
      const sample = sampleFor(id);
      assert.ok(sample, `${id} has no sample`);
      assert.ok(sample.stem.length > 3, `${id}: stem is empty`);
      // What is shown and what is said are separate: Vocabulary shows a bare
      // word, as its scored items do, but the examiner asks a whole question.
      const spoken = sampleSpoken(id);
      assert.ok(spoken.length > 15, `${id}: spoken prompt too short — "${spoken}"`);
      assert.ok(spoken.includes(sample.stem), `${id}: spoken prompt omits the stem`);
      assert.equal(sample.options.length, 4);
      assert.deepEqual(sample.options.map((o) => o.credit).sort(), [0, 0, 1, 2]);
      assert.ok(sample.teach.length > 30, `${id}: teaching text too thin`);
    }
  });

  test('sample items are not drawn from the scored banks', async () => {
    // A teaching item that also appears as a scored item would give one item
    // away and skew that subtest.
    const { SIMILARITIES_ITEMS, VOCABULARY_ITEMS } = await import('../src/exam/verbal-items.js');
    const similaritiesStems = new Set(SIMILARITIES_ITEMS.map((i) => i.stem));
    const vocabularyWords = new Set(VOCABULARY_ITEMS.map((i) => i.word));
    assert.ok(!similaritiesStems.has(sampleFor('si').stem));
    assert.ok(!vocabularyWords.has(sampleFor('vo').stem));
  });

  test('feedback names the outcome and then teaches', () => {
    const right = teachingFeedback('si', 2);
    const partial = teachingFeedback('si', 1);
    const wrong = teachingFeedback('si', 0);
    assert.match(right, /^That's right\./);
    assert.match(partial, /^That's partly right\./);
    assert.match(wrong, /^Not quite\./);
    for (const text of [right, partial, wrong]) {
      assert.ok(text.includes(sampleFor('si').teach), 'feedback must include the teaching');
    }
  });
});

describe('estimateSpeechMs', () => {
  test('scales with length and inversely with rate', () => {
    const short = estimateSpeechMs('Hello there.');
    const long = estimateSpeechMs('Hello there, this is a considerably longer sentence to read.');
    assert.ok(long > short);
    assert.ok(estimateSpeechMs('some words here', 0.5) > estimateSpeechMs('some words here', 1));
    assert.ok(estimateSpeechMs('some words here', 2) < estimateSpeechMs('some words here', 1));
  });

  test('is generous rather than tight', () => {
    // This value is a deadline for giving up on speech events. Firing early
    // cuts the examiner off mid-sentence, so it must over-estimate.
    const words = 15;
    const text = Array.from({ length: words }, () => 'word').join(' ');
    const naive = (words / 150) * 60000;
    assert.ok(estimateSpeechMs(text, 1) > naive, 'must exceed a naive estimate');
  });

  test('treats absent input as silence, not as the word "null"', () => {
    // Regression: String(null) is "null", one word, which bought a ~1s pause
    // for a line that was never going to be spoken.
    assert.equal(estimateSpeechMs(''), 0);
    assert.equal(estimateSpeechMs('   '), 0);
    assert.equal(estimateSpeechMs(null), 0);
    assert.equal(estimateSpeechMs(undefined), 0);
  });

  test('never returns a negative or absurd delay for a rate of zero', () => {
    const value = estimateSpeechMs('a few words', 0);
    assert.ok(value > 0 && Number.isFinite(value));
  });
});

describe('digitSchedule', () => {
  test('spaces digits one second apart by default', () => {
    const schedule = digitSchedule([4, 1, 7]);
    assert.deepEqual(schedule.map((s) => s.atMs), [0, 1000, 2000]);
    assert.deepEqual(schedule.map((s) => s.digit), [4, 1, 7]);
    assert.deepEqual(schedule.map((s) => s.text), ['4', '1', '7']);
    assert.equal(DIGIT_INTERVAL_MS, 1000);
  });

  test('honours a custom interval', () => {
    assert.deepEqual(digitSchedule([1, 2], { intervalMs: 500 }).map((s) => s.atMs), [0, 500]);
  });

  test('presents digits evenly, never grouped', () => {
    // Grouping would do the examinee's chunking for them and inflate the span.
    const schedule = digitSchedule([1, 2, 3, 4, 5, 6, 7]);
    const gaps = schedule.slice(1).map((s, i) => s.atMs - schedule[i].atMs);
    assert.equal(new Set(gaps).size, 1, `uneven cadence: ${gaps}`);
  });

  test('handles an empty run', () => {
    assert.deepEqual(digitSchedule([]), []);
  });
});

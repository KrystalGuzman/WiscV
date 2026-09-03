/**
 * prose.js — shared checks for generated and authored text.
 *
 * Used by the explanation and walkthrough suites, and by the item-bank checks.
 * Defined once because the article rule below is subtle enough that two
 * divergent copies would drift.
 */

/**
 * Words whose written first letter disagrees with their opening sound.
 *
 * English chooses "a" or "an" by sound, not spelling: "an hour" (silent h) and
 * "a university" (a /j/ glide) are both correct, and a checker that looks only
 * at the letter reports each of them as a fault.
 */
const VOWEL_SOUND_DESPITE_CONSONANT = new Set([
  'hour', 'hours', 'hourly', 'honest', 'honestly', 'honour', 'honours',
  'honourable', 'honor', 'honorable', 'heir', 'heirs', 'heirloom',
]);

const CONSONANT_SOUND_DESPITE_VOWEL = new Set([
  'university', 'universities', 'universal', 'unique', 'unit', 'units',
  'union', 'unions', 'useful', 'user', 'users', 'usage', 'utility',
  'one', 'once', 'european', 'ewe', 'eulogy', 'euphemism', 'ubiquitous',
]);

/** Which article a word takes, judged by its opening sound. */
export function articleFor(word) {
  const bare = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (VOWEL_SOUND_DESPITE_CONSONANT.has(bare)) return 'an';
  if (CONSONANT_SOUND_DESPITE_VOWEL.has(bare)) return 'a';
  return /^[aeiou]/.test(bare) ? 'an' : 'a';
}

/** Every mis-chosen article in a passage, as readable messages. */
export function articleProblems(text) {
  const problems = [];
  for (const [, article, word] of String(text).matchAll(/\b(an?) ([A-Za-z]+)/g)) {
    const expected = articleFor(word);
    if (article.toLowerCase() !== expected) {
      problems.push(`"${article} ${word}" should be "${expected} ${word}"`);
    }
  }
  return problems;
}

/**
 * Faults that make a passage read as broken rather than merely terse.
 * Returns readable messages so a failure names the fault, not just a count.
 */
export function proseProblems(text, { minLength = 20 } = {}) {
  const problems = [];
  if (!text || text.length < minLength) problems.push('too short');
  if (/\d{6,}/.test(text)) problems.push('runaway number');
  if (/\bundefined\b|\bNaN\b|\bnull\b/.test(text)) problems.push('unrendered value');
  if (/\s{2,}/.test(text)) problems.push('double space');
  if (/\.\./.test(text)) problems.push('double period');
  problems.push(...articleProblems(text));
  return problems;
}

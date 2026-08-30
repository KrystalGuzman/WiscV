/**
 * verbal-items.js — original item banks for the two verbal subtests.
 *
 * These items are written for this project. They follow the *format* of verbal
 * concept-formation and word-knowledge tasks, which is a generic paradigm, but
 * no item is taken from any published instrument.
 *
 * Both subtests use 2/1/0 credit, the convention for verbal items where a
 * response can be right for a shallow reason:
 *
 *   2  the superordinate category, or a precise definition
 *   1  a correct but concrete, functional or vague response
 *   0  incorrect
 *
 * Free-text responses cannot be scored reliably without a human examiner, so
 * these are presented as forced choice among pre-scored responses. That makes
 * the task recognition rather than recall, which is easier than the open format
 * it is modelled on — a real difference, noted in the methodology.
 *
 * Items are ordered by increasing difficulty; administration applies a
 * discontinue rule, so later items are only reached by examinees still scoring.
 */

export const SIMILARITIES_ITEMS = Object.freeze([
  {
    pair: ['apple', 'banana'],
    stem: 'How are an apple and a banana alike?',
    responses: [
      { text: 'They are both fruit.', credit: 2 },
      { text: 'You can eat them both.', credit: 1 },
      { text: 'They are both vegetables.', credit: 0 },
      { text: 'They are both the same colour.', credit: 0 },
    ],
  },
  {
    pair: ['car', 'bus'],
    stem: 'How are a car and a bus alike?',
    responses: [
      { text: 'They are both vehicles.', credit: 2 },
      { text: 'They both have wheels.', credit: 1 },
      { text: 'They are both made of metal.', credit: 0 },
      { text: 'They both carry only one person.', credit: 0 },
    ],
  },
  {
    pair: ['shirt', 'shoe'],
    stem: 'How are a shirt and a shoe alike?',
    responses: [
      { text: 'They are both clothing — things people wear.', credit: 2 },
      { text: 'You put them both on your body.', credit: 1 },
      { text: 'They are both made of leather.', credit: 0 },
      { text: 'They both come in pairs.', credit: 0 },
    ],
  },
  {
    pair: ['hammer', 'saw'],
    stem: 'How are a hammer and a saw alike?',
    responses: [
      { text: 'They are both tools.', credit: 2 },
      { text: 'You use them both to build things.', credit: 1 },
      { text: 'They are both heavy.', credit: 0 },
      { text: 'They both cut wood.', credit: 0 },
    ],
  },
  {
    pair: ['north', 'west'],
    stem: 'How are north and west alike?',
    responses: [
      { text: 'They are both directions on a compass.', credit: 2 },
      { text: 'They both tell you which way to go.', credit: 1 },
      { text: 'They are both places.', credit: 0 },
      { text: 'They are both cold.', credit: 0 },
    ],
  },
  {
    pair: ['anger', 'joy'],
    stem: 'How are anger and joy alike?',
    responses: [
      { text: 'They are both emotions.', credit: 2 },
      { text: 'They both change how a person acts.', credit: 1 },
      { text: 'They are both bad for you.', credit: 0 },
      { text: 'They are both thoughts.', credit: 0 },
    ],
  },
  {
    pair: ['poem', 'novel'],
    stem: 'How are a poem and a novel alike?',
    responses: [
      { text: 'They are both forms of literature.', credit: 2 },
      { text: 'They are both made of words.', credit: 1 },
      { text: 'They both rhyme.', credit: 0 },
      { text: 'They are both true stories.', credit: 0 },
    ],
  },
  {
    pair: ['mountain', 'valley'],
    stem: 'How are a mountain and a valley alike?',
    responses: [
      { text: 'They are both landforms — natural features of the earth.', credit: 2 },
      { text: 'You find them both in the countryside.', credit: 1 },
      { text: 'They are both high up.', credit: 0 },
      { text: 'They are both made by people.', credit: 0 },
    ],
  },
  {
    pair: ['telescope', 'microscope'],
    stem: 'How are a telescope and a microscope alike?',
    responses: [
      { text: 'They are both optical instruments that magnify.', credit: 2 },
      { text: 'They both help you see things better.', credit: 1 },
      { text: 'They are both used to look at stars.', credit: 0 },
      { text: 'They are both made of plastic.', credit: 0 },
    ],
  },
  {
    pair: ['democracy', 'monarchy'],
    stem: 'How are a democracy and a monarchy alike?',
    responses: [
      { text: 'They are both systems of government.', credit: 2 },
      { text: 'They both have someone in charge of a country.', credit: 1 },
      { text: 'They are both fair to everyone.', credit: 0 },
      { text: 'They are both types of election.', credit: 0 },
    ],
  },
  {
    pair: ['envy', 'greed'],
    stem: 'How are envy and greed alike?',
    responses: [
      { text: 'They are both desires for something one does not have.', credit: 2 },
      { text: 'They are both bad feelings.', credit: 1 },
      { text: 'They are both kinds of anger.', credit: 0 },
      { text: 'They both mean being poor.', credit: 0 },
    ],
  },
  {
    pair: ['contract', 'promise'],
    stem: 'How are a contract and a promise alike?',
    responses: [
      { text: 'They are both agreements to do something.', credit: 2 },
      { text: 'They both involve telling someone what you will do.', credit: 1 },
      { text: 'They are both legal documents.', credit: 0 },
      { text: 'They are both spoken out loud.', credit: 0 },
    ],
  },
  {
    pair: ['evolution', 'erosion'],
    stem: 'How are evolution and erosion alike?',
    responses: [
      { text: 'They are both gradual processes of change over long periods.', credit: 2 },
      { text: 'They both happen slowly.', credit: 1 },
      { text: 'They are both caused by water.', credit: 0 },
      { text: 'They both destroy things.', credit: 0 },
    ],
  },
  {
    pair: ['symphony', 'sonnet'],
    stem: 'How are a symphony and a sonnet alike?',
    responses: [
      { text: 'They are both structured artistic compositions in a fixed form.', credit: 2 },
      { text: 'They are both types of art.', credit: 1 },
      { text: 'They are both performed by orchestras.', credit: 0 },
      { text: 'They are both from Italy.', credit: 0 },
    ],
  },
]);

export const VOCABULARY_ITEMS = Object.freeze([
  {
    word: 'lamp',
    responses: [
      { text: 'A device that gives light.', credit: 2 },
      { text: 'Something bright.', credit: 1 },
      { text: 'A thing you sit on.', credit: 0 },
      { text: 'A kind of window.', credit: 0 },
    ],
  },
  {
    word: 'brave',
    responses: [
      { text: 'Willing to face danger or pain without being overcome by fear.', credit: 2 },
      { text: 'Not scared.', credit: 1 },
      { text: 'Very strong.', credit: 0 },
      { text: 'In a hurry.', credit: 0 },
    ],
  },
  {
    word: 'gather',
    responses: [
      { text: 'To bring things together into one place.', credit: 2 },
      { text: 'To get things.', credit: 1 },
      { text: 'To throw things away.', credit: 0 },
      { text: 'To count something.', credit: 0 },
    ],
  },
  {
    word: 'ancient',
    responses: [
      { text: 'Belonging to the very distant past.', credit: 2 },
      { text: 'Old.', credit: 1 },
      { text: 'Rare and valuable.', credit: 0 },
      { text: 'Broken down.', credit: 0 },
    ],
  },
  {
    word: 'summit',
    responses: [
      { text: 'The highest point of a mountain.', credit: 2 },
      { text: 'The top of something.', credit: 1 },
      { text: 'A steep path.', credit: 0 },
      { text: 'A deep hole.', credit: 0 },
    ],
  },
  {
    word: 'reluctant',
    responses: [
      { text: 'Unwilling and hesitant to do something.', credit: 2 },
      { text: 'Not wanting to.', credit: 1 },
      { text: 'Feeling tired.', credit: 0 },
      { text: 'Moving slowly.', credit: 0 },
    ],
  },
  {
    word: 'abundant',
    responses: [
      { text: 'Existing or available in large quantities; plentiful.', credit: 2 },
      { text: 'A lot of something.', credit: 1 },
      { text: 'Costing a great deal.', credit: 0 },
      { text: 'Growing quickly.', credit: 0 },
    ],
  },
  {
    word: 'persuade',
    responses: [
      { text: 'To cause someone to believe or do something by giving them reasons.', credit: 2 },
      { text: 'To get someone to agree.', credit: 1 },
      { text: 'To argue with someone.', credit: 0 },
      { text: 'To force someone.', credit: 0 },
    ],
  },
  {
    word: 'fragment',
    responses: [
      { text: 'A small piece broken off from something whole.', credit: 2 },
      { text: 'A little bit of something.', credit: 1 },
      { text: 'A crack in a surface.', credit: 0 },
      { text: 'A brief moment.', credit: 0 },
    ],
  },
  {
    word: 'obscure',
    responses: [
      { text: 'Not clearly expressed or understood; little known.', credit: 2 },
      { text: 'Hard to make out.', credit: 1 },
      { text: 'Extremely old.', credit: 0 },
      { text: 'Deliberately false.', credit: 0 },
    ],
  },
  {
    word: 'tentative',
    responses: [
      { text: 'Not certain or fixed; done as a trial and open to change.', credit: 2 },
      { text: 'Unsure.', credit: 1 },
      { text: 'Done carefully.', credit: 0 },
      { text: 'Happening soon.', credit: 0 },
    ],
  },
  {
    word: 'candid',
    responses: [
      { text: 'Truthful and straightforward, especially about something uncomfortable.', credit: 2 },
      { text: 'Honest.', credit: 1 },
      { text: 'Friendly and warm.', credit: 0 },
      { text: 'Said without thinking.', credit: 0 },
    ],
  },
  {
    word: 'reciprocal',
    responses: [
      { text: 'Given or done in return; affecting two parties equally and mutually.', credit: 2 },
      { text: 'Shared between people.', credit: 1 },
      { text: 'Happening again and again.', credit: 0 },
      { text: 'Opposite in meaning.', credit: 0 },
    ],
  },
  {
    word: 'ephemeral',
    responses: [
      { text: 'Lasting for only a very short time.', credit: 2 },
      { text: 'Quick.', credit: 1 },
      { text: 'Delicate and easily broken.', credit: 0 },
      { text: 'Impossible to see.', credit: 0 },
    ],
  },
  {
    word: 'ubiquitous',
    responses: [
      { text: 'Present or found everywhere at once.', credit: 2 },
      { text: 'Very common.', credit: 1 },
      { text: 'Extremely important.', credit: 0 },
      { text: 'Growing without control.', credit: 0 },
    ],
  },
  {
    word: 'laconic',
    responses: [
      { text: 'Using very few words.', credit: 2 },
      { text: 'Quiet.', credit: 1 },
      { text: 'Unwilling to work.', credit: 0 },
      { text: 'Difficult to understand.', credit: 0 },
    ],
  },
]);

/** Symbols for the Picture Span task: distinct, and quick to take in. */
export const PICTURE_SYMBOLS = Object.freeze([
  '🍎', '🚗', '🌳', '⚽', '🔑', '🎸', '🐦', '☂️', '✏️', '🕰️',
  '🧊', '🍄', '🔔', '🪁', '🧲', '🌵', '🥁', '🪞', '🧭', '🍋',
]);

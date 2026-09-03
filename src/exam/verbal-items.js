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
 * ---------------------------------------------------------------------------
 * WHY THE BANKS ARE LARGE, AND ORGANISED BY TIER
 * ---------------------------------------------------------------------------
 * Earlier versions held 14 and 16 items and presented all of them every
 * session, which meant a retest asked exactly the same questions — the verbal
 * scores measured recall of a previous sitting as much as ability.
 *
 * Each bank now holds well over a hundred items grouped into difficulty tiers,
 * one tier per position in the administered sequence. A session draws one item
 * from each tier, so it presents the same number of items on the same
 * difficulty ramp as before — leaving raw score ranges and the reference
 * distribution untouched — while drawing different items each time.
 *
 * Tiers run easiest first. Administration applies a discontinue rule, so later
 * tiers are only reached by examinees still scoring.
 * ---------------------------------------------------------------------------
 *
 * The compact tuple form below is deliberate: at this size, a tier you can read
 * in one screen is far easier to check for a sane difficulty ramp than the same
 * content spread over hundreds of lines of object literals. Position encodes
 * credit, and `buildItems` expands the tuples into the scored shape.
 *
 *   Similarities: [ a, b, stem, twoPoint, onePoint, zeroA, zeroB ]
 *   Vocabulary:   [ word, twoPoint, onePoint, zeroA, zeroB ]
 */

/** Expand a tuple tier list into scored items carrying their tier. */
function buildSimilarities(tiers) {
  return tiers.flatMap((tier, index) =>
    tier.map(([a, b, stem, two, one, zeroA, zeroB]) => ({
      tier: index + 1,
      pair: [a, b],
      stem,
      responses: [
        { text: two, credit: 2 },
        { text: one, credit: 1 },
        { text: zeroA, credit: 0 },
        { text: zeroB, credit: 0 },
      ],
    })));
}

function buildVocabulary(tiers) {
  return tiers.flatMap((tier, index) =>
    tier.map(([word, two, one, zeroA, zeroB]) => ({
      tier: index + 1,
      word,
      responses: [
        { text: two, credit: 2 },
        { text: one, credit: 1 },
        { text: zeroA, credit: 0 },
        { text: zeroB, credit: 0 },
      ],
    })));
}

// ---------------------------------------------------------------------------
// Similarities — 14 tiers, from everyday objects to abstract concepts.
// ---------------------------------------------------------------------------

const SIMILARITIES_TIERS = [
  // Tier 1 — everyday things with an obvious shared category.
  [
    ['apple', 'banana', 'How are an apple and a banana alike?',
      'They are both fruit.', 'You can eat them both.',
      'They are both vegetables.', 'They are both the same colour.'],
    ['shoe', 'boot', 'How are a shoe and a boot alike?',
      'They are both footwear.', 'You put them both on your feet.',
      'They are both made of rubber.', 'They are both waterproof.'],
    ['cat', 'dog', 'How are a cat and a dog alike?',
      'They are both animals.', 'People keep them both as pets.',
      'They both bark.', 'They are both wild.'],
    ['car', 'bus', 'How are a car and a bus alike?',
      'They are both vehicles.', 'They both have wheels.',
      'They are both made of metal.', 'They both carry only one person.'],
    ['chair', 'table', 'How are a chair and a table alike?',
      'They are both furniture.', 'They both have legs.',
      'They are both made of oak.', 'You sit on them both.'],
    ['spoon', 'fork', 'How are a spoon and a fork alike?',
      'They are both eating utensils.', 'You use them both at meals.',
      'They are both sharp.', 'They are both made of wood.'],
    ['rose', 'daisy', 'How are a rose and a daisy alike?',
      'They are both flowers.', 'They both grow in gardens.',
      'They are both red.', 'They are both trees.'],
    ['shirt', 'coat', 'How are a shirt and a coat alike?',
      'They are both clothing.', 'You wear them both on your top half.',
      'They are both warm.', 'They both have hoods.'],
  ],

  // Tier 2 — familiar categories, one step less obvious.
  [
    ['hammer', 'saw', 'How are a hammer and a saw alike?',
      'They are both tools.', 'You use them both to build things.',
      'They are both heavy.', 'They both cut wood.'],
    ['bread', 'rice', 'How are bread and rice alike?',
      'They are both foods.', 'You can cook with them both.',
      'They are both drinks.', 'They are both sweet.'],
    ['rain', 'snow', 'How are rain and snow alike?',
      'They are both kinds of weather.', 'They both fall from the sky.',
      'They are both cold.', 'They are both frozen.'],
    ['red', 'blue', 'How are red and blue alike?',
      'They are both colours.', 'You can see them both.',
      'They are both warm.', 'They are both shades of green.'],
    ['boat', 'aeroplane', 'How are a boat and an aeroplane alike?',
      'They are both means of transport.', 'They both carry people places.',
      'They both float on water.', 'They both have wings.'],
    ['oak', 'pine', 'How are an oak and a pine alike?',
      'They are both trees.', 'They both grow in forests.',
      'They both lose their leaves.', 'They are both flowers.'],
    ['milk', 'juice', 'How are milk and juice alike?',
      'They are both drinks.', 'You can pour them both.',
      'They are both made from fruit.', 'They are both white.'],
    ['eye', 'ear', 'How are an eye and an ear alike?',
      'They are both sense organs.', 'They are both parts of the head.',
      'They both help you see.', 'They are both bones.'],
  ],

  // Tier 3 — the category needs a word the examinee may not use daily.
  [
    ['book', 'newspaper', 'How are a book and a newspaper alike?',
      'They are both things people read.', 'They are both made of paper.',
      'They are both published daily.', 'They both tell true stories.'],
    ['piano', 'drum', 'How are a piano and a drum alike?',
      'They are both musical instruments.', 'They both make a sound when hit.',
      'They both have strings.', 'They are both easy to carry.'],
    ['lion', 'tiger', 'How are a lion and a tiger alike?',
      'They are both big cats.', 'They are both dangerous.',
      'They both have stripes.', 'They both live in one country.'],
    ['river', 'lake', 'How are a river and a lake alike?',
      'They are both bodies of water.', 'You can swim in them both.',
      'They both flow to the sea.', 'They are both salty.'],
    ['doctor', 'nurse', 'How are a doctor and a nurse alike?',
      'They both work in medicine.', 'They both help people who are ill.',
      'They both perform surgery.', 'They both work only at night.'],
    ['pen', 'pencil', 'How are a pen and a pencil alike?',
      'They are both writing implements.', 'You hold them both in your hand.',
      'They both use ink.', 'They can both be erased.'],
    ['wheat', 'corn', 'How are wheat and corn alike?',
      'They are both crops.', 'They both grow in fields.',
      'They are both fruits.', 'They are both eaten raw.'],
    ['hat', 'scarf', 'How are a hat and a scarf alike?',
      'They are both items of clothing.', 'They both keep you warm.',
      'They are both worn on the head.', 'They are both made of leather.'],
  ],

  // Tier 4 — categories defined by function or material.
  [
    ['knife', 'scissors', 'How are a knife and scissors alike?',
      'They are both cutting tools.', 'They are both sharp.',
      'They both have two blades.', 'They are both used only in kitchens.'],
    ['sugar', 'salt', 'How are sugar and salt alike?',
      'They are both seasonings added to food.', 'They are both white powders.',
      'They both taste sweet.', 'They are both liquids.'],
    ['minute', 'hour', 'How are a minute and an hour alike?',
      'They are both units of time.', 'They both appear on a clock.',
      'They are both the same length.', 'They are both units of distance.'],
    ['brick', 'timber', 'How are brick and timber alike?',
      'They are both building materials.', 'Houses are made from them both.',
      'They both come from trees.', 'They are both metals.'],
    ['copper', 'iron', 'How are copper and iron alike?',
      'They are both metals.', 'They are both dug out of the ground.',
      'They are both gases.', 'They are both precious and rare.'],
    ['bee', 'ant', 'How are a bee and an ant alike?',
      'They are both insects.', 'They both live in groups.',
      'They both fly.', 'They both make honey.'],
    ['lamp', 'candle', 'How are a lamp and a candle alike?',
      'They are both sources of light.', 'You use them both in the dark.',
      'They both burn wax.', 'They both need electricity.'],
    ['sock', 'glove', 'How are a sock and a glove alike?',
      'They are both garments for the extremities.', 'They both come in pairs.',
      'They are both worn on the feet.', 'They are both waterproof.'],
  ],

  // Tier 5 — natural and technical categories.
  [
    ['mountain', 'valley', 'How are a mountain and a valley alike?',
      'They are both landforms.', 'You find them both in the countryside.',
      'They are both high up.', 'They are both made by people.'],
    ['north', 'west', 'How are north and west alike?',
      'They are both directions on a compass.', 'They both tell you which way to go.',
      'They are both places.', 'They are both cold.'],
    ['telescope', 'microscope', 'How are a telescope and a microscope alike?',
      'They are both optical instruments that magnify.', 'They both help you see things better.',
      'They are both used to look at stars.', 'They are both made of plastic.'],
    ['gold', 'silver', 'How are gold and silver alike?',
      'They are both precious metals.', 'They are both used to make jewellery.',
      'They are both the same colour.', 'They are both alloys.'],
    ['flute', 'trumpet', 'How are a flute and a trumpet alike?',
      'They are both wind instruments.', 'You blow into them both.',
      'They are both made of wood.', 'They both have strings.'],
    ['summer', 'winter', 'How are summer and winter alike?',
      'They are both seasons.', 'They are both times of the year.',
      'They are both hot.', 'They both last a month.'],
    ['sand', 'clay', 'How are sand and clay alike?',
      'They are both kinds of earth.', 'You find them both on the ground.',
      'They are both rocks.', 'They are both man-made.'],
    ['wheel', 'lever', 'How are a wheel and a lever alike?',
      'They are both simple machines.', 'They both make work easier.',
      'They both turn in circles.', 'They both need fuel.'],
  ],

  // Tier 6 — categories that are abstract but familiar.
  [
    ['poem', 'novel', 'How are a poem and a novel alike?',
      'They are both forms of literature.', 'They are both made of words.',
      'They both rhyme.', 'They are both true stories.'],
    ['painting', 'sculpture', 'How are a painting and a sculpture alike?',
      'They are both works of art.', 'People make them both to be looked at.',
      'They are both flat.', 'They are both made of stone.'],
    ['lung', 'heart', 'How are a lung and a heart alike?',
      'They are both organs.', 'They are both inside the chest.',
      'They both pump blood.', 'They are both muscles you control.'],
    ['lawyer', 'judge', 'How are a lawyer and a judge alike?',
      'They both work in the law.', 'They both work in a courtroom.',
      'They both decide who is guilty.', 'They are both elected.'],
    ['dictionary', 'atlas', 'How are a dictionary and an atlas alike?',
      'They are both reference books.', 'You look things up in them both.',
      'They are both about words.', 'They are both read for pleasure.'],
    ['anger', 'joy', 'How are anger and joy alike?',
      'They are both emotions.', 'They both change how a person acts.',
      'They are both bad for you.', 'They are both thoughts.'],
    ['addition', 'subtraction', 'How are addition and subtraction alike?',
      'They are both arithmetic operations.', 'You do them both with numbers.',
      'They both make numbers bigger.', 'They are both shapes.'],
    ['glue', 'nail', 'How are glue and a nail alike?',
      'They are both ways of fastening things together.', 'You use them both when making things.',
      'They are both sticky.', 'They are both made of metal.'],
  ],

  // Tier 7 — the shared category is a relation rather than a kind.
  [
    ['contract', 'promise', 'How are a contract and a promise alike?',
      'They are both agreements to do something.', 'They both involve telling someone what you will do.',
      'They are both legal documents.', 'They are both spoken out loud.'],
    ['island', 'peninsula', 'How are an island and a peninsula alike?',
      'They are both land largely surrounded by water.', 'They are both found by the sea.',
      'They are both completely surrounded by water.', 'They are both man-made.'],
    ['debt', 'loan', 'How are a debt and a loan alike?',
      'They are both obligations to repay money.', 'They both involve money.',
      'They are both gifts.', 'They both earn interest for the borrower.'],
    ['seed', 'egg', 'How are a seed and an egg alike?',
      'A new living thing grows from each of them.', 'They are both small and round.',
      'They are both eaten for breakfast.', 'They both come from birds.'],
    ['courage', 'honesty', 'How are courage and honesty alike?',
      'They are both virtues.', 'They are both good qualities to have.',
      'They are both feelings.', 'They are both skills you are taught.'],
    ['rust', 'decay', 'How are rust and decay alike?',
      'They are both processes of gradual deterioration.', 'They both spoil things over time.',
      'They both happen only to metal.', 'They both happen instantly.'],
    ['muscle', 'bone', 'How are a muscle and a bone alike?',
      'They are both parts of the body that let it move.', 'They are both inside the body.',
      'They are both hard.', 'They both carry blood.'],
    ['law', 'rule', 'How are a law and a rule alike?',
      'They both govern how people may behave.', 'They both tell you what to do.',
      'They are both made by parliament.', 'They both apply only to children.'],
  ],

  // Tier 8 — institutional and scientific concepts.
  [
    ['democracy', 'monarchy', 'How are a democracy and a monarchy alike?',
      'They are both systems of government.', 'They both have someone in charge of a country.',
      'They are both fair to everyone.', 'They are both types of election.'],
    ['evolution', 'erosion', 'How are evolution and erosion alike?',
      'They are both gradual processes of change over long periods.', 'They both happen slowly.',
      'They are both caused by water.', 'They both destroy things.'],
    ['symphony', 'sonnet', 'How are a symphony and a sonnet alike?',
      'They are both structured artistic compositions in a fixed form.', 'They are both types of art.',
      'They are both performed by orchestras.', 'They are both from Italy.'],
    ['envy', 'greed', 'How are envy and greed alike?',
      'They are both desires for something one does not have.', 'They are both bad feelings.',
      'They are both kinds of anger.', 'They both mean being poor.'],
    ['migration', 'hibernation', 'How are migration and hibernation alike?',
      'They are both ways animals survive a change of season.', 'Animals do them both.',
      'They both involve sleeping.', 'They both happen every day.'],
    ['inflation', 'recession', 'How are inflation and recession alike?',
      'They are both conditions of an economy.', 'They both affect money.',
      'They both mean prices are falling.', 'They are both government departments.'],
    ['treaty', 'alliance', 'How are a treaty and an alliance alike?',
      'They are both formal agreements between states.', 'They both involve countries.',
      'They are both declarations of war.', 'They are both permanent.'],
    ['hypothesis', 'theory', 'How are a hypothesis and a theory alike?',
      'They are both proposed explanations that can be tested.', 'They are both ideas about how something works.',
      'They are both proven facts.', 'They are both guesses with no reasoning behind them.'],
  ],

  // Tier 9 — abstractions from science, language and public life.
  [
    ['gravity', 'magnetism', 'How are gravity and magnetism alike?',
      'They are both forces.', 'They both pull things together.',
      'They both act only on metal.', 'They are both forms of light.'],
    ['tolerance', 'patience', 'How are tolerance and patience alike?',
      'They are both dispositions to endure what one dislikes.', 'They are both good ways to behave.',
      'They both mean agreeing with people.', 'They are both talents you are born with.'],
    ['metaphor', 'simile', 'How are a metaphor and a simile alike?',
      'They are both figures of speech comparing one thing to another.', 'They are both used in poems.',
      'They both use the word "like".', 'They are both literally true.'],
    ['census', 'survey', 'How are a census and a survey alike?',
      'They are both methods of gathering information about a population.', 'They both ask people questions.',
      'They both count every single person.', 'They are both done once a century.'],
    ['famine', 'drought', 'How are a famine and a drought alike?',
      'They are both severe shortages of something vital.', 'They both cause suffering.',
      'They are both shortages of water.', 'They both happen only in winter.'],
    ['vaccine', 'antibiotic', 'How are a vaccine and an antibiotic alike?',
      'They are both medical means of combating disease.', 'They are both given by doctors.',
      'They both work against viruses.', 'They are both taken every day for life.'],
    ['orbit', 'rotation', 'How are an orbit and a rotation alike?',
      'They are both regular motions of a body in space.', 'They both involve going round.',
      'They both take exactly one year.', 'They both happen only to the Earth.'],
    ['bribery', 'fraud', 'How are bribery and fraud alike?',
      'They are both forms of dishonest gain.', 'They are both against the law.',
      'They both involve violence.', 'They are both accidents.'],
  ],

  // Tier 10 — categories requiring a step of abstraction.
  [
    ['sculpture', 'architecture', 'How are sculpture and architecture alike?',
      'They are both arts concerned with form in three dimensions.', 'They both produce things you can walk around.',
      'They are both painted.', 'They are both purely practical.'],
    ['jury', 'parliament', 'How are a jury and a parliament alike?',
      'They are both bodies that reach decisions collectively.', 'They are both groups of people.',
      'They both make laws.', 'They are both chosen by the monarch.'],
    ['inheritance', 'gift', 'How are an inheritance and a gift alike?',
      'They are both things received without being earned.', 'They both involve getting something.',
      'They are both paid for.', 'They both come only from strangers.'],
    ['optimism', 'cynicism', 'How are optimism and cynicism alike?',
      'They are both settled attitudes towards what is to come.', 'They are both ways of looking at things.',
      'They are both moods that pass quickly.', 'They both mean expecting the worst.'],
    ['photosynthesis', 'digestion', 'How are photosynthesis and digestion alike?',
      'They are both processes converting matter into usable energy.', 'They both happen in living things.',
      'They both need sunlight.', 'They both happen in the stomach.'],
    ['asylum', 'sanctuary', 'How are asylum and sanctuary alike?',
      'They are both forms of protection given to those in danger.', 'They are both places to go.',
      'They are both prisons.', 'They are both granted only to citizens.'],
    ['irony', 'satire', 'How are irony and satire alike?',
      'They both criticise by saying other than what is meant.', 'They are both ways of being funny.',
      'They are both compliments.', 'They are both plain statements of fact.'],
    ['quarantine', 'embargo', 'How are a quarantine and an embargo alike?',
      'They are both restrictions imposed to prevent harm spreading.', 'They both stop things moving.',
      'They are both punishments for crime.', 'They are both voluntary.'],
  ],

  // Tier 11 — concepts that share an underlying structure.
  [
    ['entropy', 'decay', 'How are entropy and decay alike?',
      'They both describe a tendency towards disorder over time.', 'They both mean things getting worse.',
      'They are both reversible at no cost.', 'They both happen only to living things.'],
    ['allegory', 'parable', 'How are an allegory and a parable alike?',
      'They are both narratives carrying a meaning beyond the story.', 'They are both stories.',
      'They are both factual accounts.', 'They are both poems.'],
    ['autonomy', 'sovereignty', 'How are autonomy and sovereignty alike?',
      'They are both forms of self-governance.', 'They both mean being in charge.',
      'They both mean being controlled by others.', 'They are both types of monarchy.'],
    ['catalyst', 'trigger', 'How are a catalyst and a trigger alike?',
      'They both set a process going without being consumed by it.', 'They both start something.',
      'They are both chemicals.', 'They both stop a reaction.'],
    ['altruism', 'charity', 'How are altruism and charity alike?',
      'They are both concern for the welfare of others.', 'They both involve helping people.',
      'They both mean giving money.', 'They are both done for personal gain.'],
    ['paradox', 'contradiction', 'How are a paradox and a contradiction alike?',
      'They both involve statements at odds with themselves.', 'They are both confusing.',
      'They are both obviously false.', 'They are both mathematical proofs.'],
    ['amnesty', 'pardon', 'How are an amnesty and a pardon alike?',
      'They are both official releases from punishment.', 'They both let someone off.',
      'They are both sentences imposed by a court.', 'They are both apologies.'],
    ['inertia', 'momentum', 'How are inertia and momentum alike?',
      'They are both properties governing how a body resists a change in motion.', 'They are both to do with movement.',
      'They are both forces applied to an object.', 'They are both kinds of energy stored as heat.'],
  ],

  // Tier 12 — concepts related by role rather than by kind.
  [
    ['scepticism', 'doubt', 'How are scepticism and doubt alike?',
      'They both involve withholding belief pending evidence.', 'They both mean not being sure.',
      'They both mean refusing to consider anything.', 'They are both forms of certainty.'],
    ['hierarchy', 'taxonomy', 'How are a hierarchy and a taxonomy alike?',
      'They are both systems that order things by rank or kind.', 'They both put things in groups.',
      'They are both alphabetical lists.', 'They are both used only in biology.'],
    ['precedent', 'convention', 'How are a precedent and a convention alike?',
      'They both guide present conduct by what was done before.', 'They are both things people follow.',
      'They are both written into statute.', 'They both apply only once.'],
    ['nostalgia', 'grief', 'How are nostalgia and grief alike?',
      'They are both emotional responses to something lost.', 'They are both sad feelings.',
      'They are both about the future.', 'They are both physical illnesses.'],
    ['equilibrium', 'stability', 'How are equilibrium and stability alike?',
      'They both describe a state in which opposing influences balance.', 'They both mean things staying the same.',
      'They both mean rapid change.', 'They are both measured in degrees.'],
    ['rhetoric', 'propaganda', 'How are rhetoric and propaganda alike?',
      'They are both uses of language designed to persuade.', 'They are both ways of talking to people.',
      'They are both purely factual.', 'They are both forms of poetry.'],
    ['abstraction', 'generalisation', 'How are abstraction and generalisation alike?',
      'They both move from particular cases to a wider principle.', 'They are both ways of thinking.',
      'They both add specific detail.', 'They are both kinds of measurement.'],
    ['sanction', 'incentive', 'How are a sanction and an incentive alike?',
      'They are both measures used to influence behaviour.', 'They both make people act differently.',
      'They are both rewards.', 'They are both taxes.'],
  ],

  // Tier 13 — technical vocabulary with a shared conceptual role.
  [
    ['axiom', 'postulate', 'How are an axiom and a postulate alike?',
      'They are both assumptions taken as given without proof.', 'They are both starting points.',
      'They are both conclusions that have been proven.', 'They are both experiments.'],
    ['empathy', 'compassion', 'How are empathy and compassion alike?',
      'They are both responses to the suffering of another.', 'They are both kind feelings.',
      'They both mean pitying someone from a distance.', 'They are both forms of indifference.'],
    ['metamorphosis', 'transformation', 'How are metamorphosis and transformation alike?',
      'They are both complete changes from one form into another.', 'They both mean changing.',
      'They both happen only to insects.', 'They are both changes of position.'],
    ['dogma', 'orthodoxy', 'How are dogma and orthodoxy alike?',
      'They are both bodies of belief held as beyond question.', 'They are both sets of beliefs.',
      'They are both open to constant revision.', 'They are both scientific methods.'],
    ['synthesis', 'integration', 'How are synthesis and integration alike?',
      'They both combine separate parts into a single whole.', 'They both put things together.',
      'They both break things apart.', 'They are both chemical elements.'],
    ['ambiguity', 'vagueness', 'How are ambiguity and vagueness alike?',
      'They are both kinds of imprecision in meaning.', 'They both make things unclear.',
      'They both mean saying something false.', 'They are both forms of exactness.'],
    ['hegemony', 'dominance', 'How are hegemony and dominance alike?',
      'They are both forms of controlling influence over others.', 'They both mean being powerful.',
      'They both mean being subordinate.', 'They are both military ranks.'],
    ['corroboration', 'verification', 'How are corroboration and verification alike?',
      'They are both ways of confirming that a claim holds.', 'They both check whether something is right.',
      'They both mean disproving a claim.', 'They are both forms of guessing.'],
  ],

  // Tier 14 — the most abstract pairs in the bank.
  [
    ['epistemology', 'ontology', 'How are epistemology and ontology alike?',
      'They are both branches of philosophy.', 'They are both academic subjects.',
      'They are both branches of physics.', 'They are both ancient languages.'],
    ['determinism', 'causality', 'How are determinism and causality alike?',
      'They both concern how events are brought about by what precedes them.', 'They are both ideas about why things happen.',
      'They both hold that events are random.', 'They are both laws of arithmetic.'],
    ['heuristic', 'algorithm', 'How are a heuristic and an algorithm alike?',
      'They are both procedures for arriving at a solution.', 'They are both ways of solving problems.',
      'They both guarantee a correct answer.', 'They are both pieces of hardware.'],
    ['teleology', 'purpose', 'How are teleology and purpose alike?',
      'They both explain something by the end it serves.', 'They are both about reasons.',
      'They both explain things by their origins alone.', 'They are both units of measurement.'],
    ['dialectic', 'discourse', 'How are dialectic and discourse alike?',
      'They are both forms of reasoned exchange between positions.', 'They are both kinds of conversation.',
      'They are both silent activities.', 'They are both written contracts.'],
    ['symmetry', 'invariance', 'How are symmetry and invariance alike?',
      'They both describe what stays the same under a change.', 'They both mean things matching.',
      'They both describe constant change.', 'They are both units of length.'],
    ['paradigm', 'framework', 'How are a paradigm and a framework alike?',
      'They are both structures that organise how a subject is thought about.', 'They are both ways of arranging ideas.',
      'They are both single experiments.', 'They are both physical scaffolds.'],
    ['induction', 'inference', 'How are induction and inference alike?',
      'They are both forms of reasoning from evidence to a conclusion.', 'They are both ways of working something out.',
      'They are both forms of direct observation.', 'They are both electrical processes.'],
  ],
];

// ---------------------------------------------------------------------------
// Vocabulary — 16 tiers, from everyday nouns to low-frequency abstractions.
// The one-point response is always defensible but vaguer; the two zero-point
// responses are plausible-sounding and wrong.
// ---------------------------------------------------------------------------

const VOCABULARY_TIERS = [
  // Tier 1
  [
    ['lamp', 'A device that gives light.', 'Something bright.',
      'A thing you sit on.', 'A kind of window.'],
    ['bed', 'A piece of furniture for sleeping on.', 'Something soft you lie on.',
      'A room in a house.', 'A kind of blanket.'],
    ['road', 'A prepared route for vehicles to travel along.', 'A way to get somewhere.',
      'A path only for walking.', 'A bridge over water.'],
    ['tree', 'A tall plant with a woody trunk and branches.', 'A big plant.',
      'A kind of flower.', 'A patch of grass.'],
    ['hand', 'The part of the body at the end of the arm, with fingers.', 'A part of your body.',
      'The lower part of the leg.', 'The joint at the elbow.'],
    ['door', 'A movable barrier that opens and closes an entrance.', 'A way into a room.',
      'A hole in a wall.', 'A kind of floor.'],
    ['milk', 'A white liquid produced by mammals to feed their young.', 'A drink that is white.',
      'A kind of cheese.', 'Water with sugar in it.'],
  ],

  // Tier 2
  [
    ['brave', 'Willing to face danger or pain without being overcome by fear.', 'Not scared.',
      'Very strong.', 'In a hurry.'],
    ['gather', 'To bring things together into one place.', 'To get things.',
      'To throw things away.', 'To count something.'],
    ['quiet', 'Making little or no noise.', 'Not loud.',
      'Moving slowly.', 'Difficult to find.'],
    ['empty', 'Containing nothing.', 'Not full.',
      'Very light in weight.', 'Broken open.'],
    ['heavy', 'Weighing a great deal.', 'Hard to lift.',
      'Very large in size.', 'Made of stone.'],
    ['begin', 'To start doing or being something.', 'To get going.',
      'To finish something.', 'To try again.'],
    ['clean', 'Free from dirt or contamination.', 'Not dirty.',
      'Newly bought.', 'Neatly arranged.'],
  ],

  // Tier 3
  [
    ['ancient', 'Belonging to the very distant past.', 'Old.',
      'Rare and valuable.', 'Broken down.'],
    ['repair', 'To restore something damaged to working order.', 'To fix something.',
      'To replace something entirely.', 'To take something apart.'],
    ['vanish', 'To disappear suddenly and completely.', 'To go away.',
      'To become smaller.', 'To move very fast.'],
    ['sturdy', 'Strongly built and unlikely to break or give way.', 'Solid.',
      'Very heavy.', 'Rough to the touch.'],
    ['timid', 'Lacking confidence and easily frightened.', 'Shy.',
      'Physically weak.', 'Unfriendly.'],
    ['gentle', 'Mild and careful in manner or action.', 'Kind.',
      'Very quiet.', 'Slow-moving.'],
    ['crisp', 'Firm and brittle, breaking with a sharp sound.', 'Fresh.',
      'Very cold.', 'Thin and flat.'],
  ],

  // Tier 4
  [
    ['summit', 'The highest point of a mountain.', 'The top of something.',
      'A steep path.', 'A deep hole.'],
    ['hollow', 'Having an empty space inside.', 'Not solid.',
      'Very deep.', 'Made of thin metal.'],
    ['weary', 'Very tired, especially after prolonged effort.', 'Tired.',
      'Feeling unwell.', 'Bored with waiting.'],
    ['glimpse', 'A brief and incomplete view of something.', 'A quick look.',
      'A long, careful study.', 'A sudden noise.'],
    ['steady', 'Firmly fixed and not liable to change or falter.', 'Not moving much.',
      'Happening very slowly.', 'Extremely fast.'],
    ['murmur', 'To speak very quietly, so as to be barely audible.', 'To talk softly.',
      'To complain loudly.', 'To repeat something twice.'],
    ['scatter', 'To throw or spread in various directions.', 'To spread things out.',
      'To gather things up.', 'To break something.'],
  ],

  // Tier 5
  [
    ['reluctant', 'Unwilling and hesitant to do something.', 'Not wanting to.',
      'Feeling tired.', 'Moving slowly.'],
    ['abundant', 'Existing or available in large quantities; plentiful.', 'A lot of something.',
      'Costing a great deal.', 'Growing quickly.'],
    ['persuade', 'To cause someone to believe or do something by giving them reasons.', 'To get someone to agree.',
      'To argue with someone.', 'To force someone.'],
    ['fragment', 'A small piece broken off from something whole.', 'A little bit of something.',
      'A crack in a surface.', 'A brief moment.'],
    ['linger', 'To stay longer than expected, as if reluctant to leave.', 'To wait around.',
      'To arrive late.', 'To move in a circle.'],
    ['vivid', 'Producing powerfully clear images in the mind.', 'Very bright.',
      'Extremely loud.', 'Difficult to remember.'],
    ['dispute', 'To argue against the truth or validity of something.', 'To disagree.',
      'To agree reluctantly.', 'To explain in detail.'],
  ],

  // Tier 6
  [
    ['obscure', 'Not clearly expressed or understood; little known.', 'Hard to make out.',
      'Extremely old.', 'Deliberately false.'],
    ['tentative', 'Not certain or fixed; done as a trial and open to change.', 'Unsure.',
      'Done carefully.', 'Happening soon.'],
    ['candid', 'Truthful and straightforward, especially about something uncomfortable.', 'Honest.',
      'Friendly and warm.', 'Said without thinking.'],
    ['brittle', 'Hard but liable to break easily.', 'Easily broken.',
      'Soft and flexible.', 'Very thin.'],
    ['prudent', 'Showing care and thought for the future.', 'Sensible.',
      'Unwilling to spend.', 'Slow to decide.'],
    ['dismal', 'Causing or showing gloom and depression.', 'Miserable.',
      'Extremely cold.', 'Badly organised.'],
    ['revive', 'To restore to life, consciousness or strength.', 'To bring back.',
      'To remember something.', 'To repeat an action.'],
  ],

  // Tier 7
  [
    ['reciprocal', 'Given or done in return; affecting two parties equally and mutually.', 'Shared between people.',
      'Happening again and again.', 'Opposite in meaning.'],
    ['meticulous', 'Showing great attention to detail; very careful and precise.', 'Very careful.',
      'Extremely slow.', 'Unwilling to change.'],
    ['arbitrary', 'Based on personal whim rather than any reason or system.', 'Chosen at random.',
      'Decided by a committee.', 'Strictly logical.'],
    ['resilient', 'Able to recover quickly from difficulty or damage.', 'Tough.',
      'Unable to feel pain.', 'Resistant to water.'],
    ['sombre', 'Dark and gloomy in tone or mood.', 'Serious.',
      'Very quiet.', 'Formally dressed.'],
    ['futile', 'Incapable of producing any useful result.', 'Pointless.',
      'Very difficult.', 'Done too late.'],
    ['coerce', 'To compel someone by force or threat.', 'To make someone do something.',
      'To persuade by argument.', 'To ask repeatedly.'],
  ],

  // Tier 8
  [
    ['ephemeral', 'Lasting for only a very short time.', 'Quick.',
      'Delicate and easily broken.', 'Impossible to see.'],
    ['ubiquitous', 'Present or found everywhere at once.', 'Very common.',
      'Extremely important.', 'Growing without control.'],
    ['laconic', 'Using very few words.', 'Quiet.',
      'Unwilling to work.', 'Difficult to understand.'],
    ['austere', 'Severely plain, without comfort or decoration.', 'Very simple.',
      'Extremely expensive.', 'Old-fashioned in style.'],
    ['tenacious', 'Holding firmly to something and not readily letting go.', 'Determined.',
      'Physically strong.', 'Slow but steady.'],
    ['benign', 'Gentle and kindly; doing no harm.', 'Not dangerous.',
      'Completely inactive.', 'Extremely generous.'],
    ['placate', 'To make someone less angry by conciliating them.', 'To calm someone down.',
      'To ignore a complaint.', 'To agree to a demand.'],
  ],

  // Tier 9
  [
    ['ambivalent', 'Having contradictory feelings about something at the same time.', 'Unsure how you feel.',
      'Completely indifferent.', 'Frequently changing your mind.'],
    ['pragmatic', 'Dealing with matters by what works in practice rather than by theory.', 'Practical.',
      'Unwilling to compromise.', 'Guided strictly by principle.'],
    ['superfluous', 'Beyond what is needed or useful.', 'Extra.',
      'Extremely expensive.', 'Difficult to obtain.'],
    ['clandestine', 'Kept secret because it would not be approved of.', 'Done in secret.',
      'Done at night.', 'Done without planning.'],
    ['aloof', 'Distant and uninvolved by choice.', 'Unfriendly.',
      'Physically far away.', 'Easily embarrassed.'],
    ['mitigate', 'To make something bad less severe.', 'To reduce something.',
      'To remove something entirely.', 'To delay something.'],
    ['opaque', 'Not able to be seen through; hard to understand.', 'Not clear.',
      'Very dark in colour.', 'Extremely thick.'],
  ],

  // Tier 10
  [
    ['innocuous', 'Harmless and unlikely to cause offence.', 'Not dangerous.',
      'Completely useless.', 'Very simple.'],
    ['tacit', 'Understood or implied without being stated.', 'Unspoken.',
      'Kept deliberately secret.', 'Agreed in writing.'],
    ['insidious', 'Proceeding gradually and harmfully, with hidden effect.', 'Sneaky.',
      'Sudden and violent.', 'Openly hostile.'],
    ['sanguine', 'Cheerfully optimistic, especially in a difficult situation.', 'Hopeful.',
      'Deeply pessimistic.', 'Unusually calm.'],
    ['culminate', 'To reach a final and highest point.', 'To end.',
      'To begin suddenly.', 'To happen repeatedly.'],
    ['disparate', 'Essentially different in kind and not comparable.', 'Very different.',
      'Kept far apart.', 'Broken into pieces.'],
    ['quell', 'To put an end to something, typically by force.', 'To stop something.',
      'To calm yourself down.', 'To question closely.'],
  ],

  // Tier 11
  [
    ['equivocal', 'Open to more than one interpretation; deliberately ambiguous.', 'Unclear.',
      'Equally balanced.', 'Stated very forcefully.'],
    ['ostensible', 'Stated as true but not necessarily so; apparent rather than actual.', 'Seeming.',
      'Obviously false.', 'Plainly visible.'],
    ['salient', 'Most noticeable or important.', 'Standing out.',
      'Sharply pointed.', 'Occurring at intervals.'],
    ['capricious', 'Given to sudden changes of mood or behaviour for no reason.', 'Unpredictable.',
      'Extremely playful.', 'Easily offended.'],
    ['nebulous', 'Vague and without definite form or limits.', 'Unclear.',
      'Made of gas.', 'Extremely distant.'],
    ['abstruse', 'Difficult to understand because of its depth or obscurity.', 'Hard to follow.',
      'Deliberately misleading.', 'Extremely lengthy.'],
    ['deleterious', 'Causing harm or damage, often gradually.', 'Bad for you.',
      'Highly contagious.', 'Impossible to detect.'],
  ],

  // Tier 12
  [
    ['perfunctory', 'Done as a duty, without care or interest.', 'Done quickly.',
      'Done extremely thoroughly.', 'Done in advance.'],
    ['esoteric', 'Understood by only a small number with specialised knowledge.', 'Obscure.',
      'Deliberately hidden.', 'Very old-fashioned.'],
    ['recalcitrant', 'Stubbornly resistant to authority or control.', 'Uncooperative.',
      'Slow to learn.', 'Physically restrained.'],
    ['ineffable', 'Too great or extreme to be expressed in words.', 'Hard to describe.',
      'Forbidden to speak of.', 'Impossible to believe.'],
    ['venerate', 'To regard with deep respect and reverence.', 'To admire.',
      'To fear greatly.', 'To obey without question.'],
    ['spurious', 'Not what it purports to be; false while appearing genuine.', 'Fake.',
      'Very poor quality.', 'Produced in a hurry.'],
    ['intransigent', 'Refusing to change one position or compromise at all.', 'Stubborn.',
      'Frequently changing sides.', 'Unwilling to speak.'],
  ],

  // Tier 13
  [
    ['obdurate', 'Stubbornly refusing to change an opinion or course of action.', 'Very stubborn.',
      'Physically hard.', 'Slow to respond.'],
    ['quotidian', 'Occurring every day; ordinary and unremarkable.', 'Everyday.',
      'Happening once a year.', 'Extremely rare.'],
    ['apocryphal', 'Widely circulated but of doubtful authenticity.', 'Probably untrue.',
      'Written long ago.', 'Deliberately invented as fiction.'],
    ['truculent', 'Eager to argue or fight; aggressively defiant.', 'Bad-tempered.',
      'Physically powerful.', 'Easily frightened.'],
    ['immutable', 'Unchanging over time and unable to be changed.', 'Always the same.',
      'Impossible to see.', 'Unable to speak.'],
    ['munificent', 'Larger or more generous than is usual.', 'Very generous.',
      'Extremely wealthy.', 'Grand in appearance.'],
    ['quiescent', 'In a state of inactivity or dormancy.', 'Still.',
      'Completely silent.', 'Permanently finished.'],
  ],

  // Tier 14
  [
    ['perspicacious', 'Having keen insight and understanding.', 'Sharp-minded.',
      'Able to see well.', 'Highly suspicious of others.'],
    ['mendacious', 'Given to lying; untruthful by habit.', 'Dishonest.',
      'Unable to be trusted with money.', 'Prone to exaggeration by accident.'],
    ['evanescent', 'Passing quickly out of sight or memory.', 'Short-lived.',
      'Faintly glowing.', 'Barely audible.'],
    ['redoubtable', 'Formidable, especially as an opponent.', 'Impressive.',
      'Full of doubt.', 'Able to be repeated.'],
    ['sanctimonious', 'Making a show of moral superiority.', 'Self-righteous.',
      'Genuinely devout.', 'Formally holy.'],
    ['inexorable', 'Impossible to stop or prevent.', 'Unstoppable.',
      'Impossible to explain.', 'Extremely severe.'],
    ['restive', 'Unable to keep still, especially from impatience.', 'Restless.',
      'Deeply relaxed.', 'Taking a period of rest.'],
  ],

  // Tier 15
  [
    ['perfidious', 'Deceitful and treacherous, especially in breaking trust.', 'Disloyal.',
      'Extremely cowardly.', 'Openly hostile.'],
    ['ineluctable', 'Unable to be resisted or avoided.', 'Inevitable.',
      'Impossible to understand.', 'Not able to be counted.'],
    ['obfuscate', 'To make something obscure or unintelligible, usually deliberately.', 'To confuse.',
      'To hide an object.', 'To state very simply.'],
    ['recondite', 'Concerning a subject little known and difficult to grasp.', 'Obscure.',
      'Recently discovered.', 'Repeated many times.'],
    ['minatory', 'Expressing or conveying a threat.', 'Threatening.',
      'Very small in scale.', 'Belonging to a minority.'],
    ['pellucid', 'Translucently clear, in substance or in expression.', 'Very clear.',
      'Brightly coloured.', 'Extremely fragile.'],
    ['refractory', 'Stubbornly resistant to treatment or control.', 'Hard to manage.',
      'Bent out of shape.', 'Needing frequent repair.'],
  ],

  // Tier 16
  [
    ['pusillanimous', 'Lacking courage; timid in the face of difficulty.', 'Cowardly.',
      'Physically frail.', 'Excessively polite.'],
    ['contumacious', 'Stubbornly disobedient to authority.', 'Defiant.',
      'Insulting in speech.', 'Habitually late.'],
    ['adumbrate', 'To outline or foreshadow something in a faint way.', 'To sketch out.',
      'To darken a surface.', 'To sum up at the end.'],
    ['propinquity', 'Nearness in place, time or relationship.', 'Closeness.',
      'A suitable moment.', 'A tendency towards something.'],
    ['obstreperous', 'Noisily and aggressively resistant to control.', 'Unruly.',
      'Blocking a passage.', 'Persistently gloomy.'],
    ['supererogatory', 'Going beyond what duty requires.', 'More than necessary.',
      'Utterly pointless.', 'Demanded by law.'],
    ['jejune', 'Naive and simplistic; lacking substance.', 'Shallow.',
      'Youthful in appearance.', 'Occurring in early summer.'],
  ],
];

// ---------------------------------------------------------------------------

export const SIMILARITIES_ITEMS = Object.freeze(buildSimilarities(SIMILARITIES_TIERS));
export const VOCABULARY_ITEMS = Object.freeze(buildVocabulary(VOCABULARY_TIERS));

/** How many difficulty tiers each bank holds — one per administered position. */
export const SIMILARITIES_TIER_COUNT = SIMILARITIES_TIERS.length;
export const VOCABULARY_TIER_COUNT = VOCABULARY_TIERS.length;

/**
 * One item drawn from each difficulty tier, easiest first.
 *
 * This is what keeps sessions comparable while the items change. Drawing at
 * random from the whole bank would vary the average difficulty of a sitting,
 * which would shift raw scores against a reference distribution that assumes a
 * fixed ramp. One per tier holds the ramp exactly.
 */
export function drawTieredItems(items, tierCount, rng) {
  const byTier = new Map();
  for (const item of items) {
    if (!byTier.has(item.tier)) byTier.set(item.tier, []);
    byTier.get(item.tier).push(item);
  }

  const drawn = [];
  for (let tier = 1; tier <= tierCount; tier += 1) {
    const candidates = byTier.get(tier);
    if (!candidates || candidates.length === 0) {
      throw new Error(`Verbal bank has no items in tier ${tier}`);
    }
    drawn.push(rng.pick(candidates));
  }
  return drawn;
}

/** Symbols for the Picture Span task: distinct, and quick to take in. */
export const PICTURE_SYMBOLS = Object.freeze([
  '🍎', '🚗', '🌳', '⚽', '🔑', '🎸', '🐦', '☂️', '✏️', '🕰️',
  '🧊', '🍄', '🔔', '🪁', '🧲', '🌵', '🥁', '🪞', '🧭', '🍋',
]);

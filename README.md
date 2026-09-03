# WISC-V Score Calculator & Practice Test

Two dependency-free web apps sharing one scoring engine:

- **[Practice test](docs/PRACTICE-TEST.md)** (`exam.html`) — take an original
  ten-task cognitive test built in the same formats the WISC-V uses, **read aloud
  by a synthetic examiner** as the real one is administered, and get a full
  profile of how you did. About 25–35 minutes.
- **[Practice areas](docs/PRACTICE-TEST.md#the-practice-areas)** (`practice.html`) —
  drill any one task on its own, untimed and unscored, with an **Explain this
  problem** walkthrough before you answer and a full explanation after. The test
  stays silent about answers; this is where the teaching lives.
- **Score calculator** (`index.html`) — enter subtest scaled scores you already
  have and get composite indexes, percentiles, confidence intervals,
  strength/weakness analysis and discrepancy comparisons.

```
Verbal Comprehension   Similarities · Vocabulary              → VCI
Visual Spatial         Block Design · Visual Puzzles          → VSI
Fluid Reasoning        Matrix Reasoning · Figure Weights      → FRI
Working Memory         Digit Span · Picture Span              → WMI
Processing Speed       Coding · Symbol Search                 → PSI

FSIQ  = SI · VC · BD · MR · FW · DS · CD
GAI   = SI · VC · BD · MR · FW              (ability without the speed/memory load)
CPI   = DS · PS · CD · SS                   (cognitive proficiency)
NVI   = BD · VP · MR · FW · PS · CD         (nonverbal)
```

## Read this first

**Neither app is the WISC-V, and the practice test is not an IQ test.**

This repository contains no WISC-V items and no copyrighted norms tables.
Neither would be lawful to distribute, and test items are secure materials
besides. Two consequences worth understanding before trusting any number:

**The calculator estimates composite conversions.** They come from an explicit
psychometric model rather than the publisher's tables, so they differ from
official scores by a point or two in the middle of the distribution and more at
the extremes. The model reproduces published composite reliabilities within .012
and published critical values within about a point — see
[docs/METHODOLOGY.md](docs/METHODOLOGY.md). If you are licensed to use the
official norms you can [load them](#using-official-norms) and they take
precedence.

**The practice test has no norms at all.** Its scaled scores compare you with an
*estimated* reference distribution written into
[`src/exam/reference.js`](src/exam/reference.js), not with real people, and there
is no age correction. The result describes how you did on those particular
tasks; it is not an IQ, not a WISC-V score, and has no clinical meaning. The
shape of the profile — which areas came out higher or lower relative to each
other — is far more trustworthy than any single number.
[docs/PRACTICE-TEST.md](docs/PRACTICE-TEST.md) sets out exactly where the
estimates come from and where they break down.

Administering, scoring and interpreting the real WISC-V require appropriate
professional qualifications. Nothing here substitutes for that judgement, and
statistical significance is not clinical meaningfulness.

WISC-V is a registered trademark of NCS Pearson, Inc. This project is
independent of, and not endorsed by, the publisher.

## Running it

No dependencies, no build step. Node is used only to serve files and run tests.

```sh
npm start          # http://localhost:8080
npm test           # Node's built-in runner
```

Then open `/exam.html` to take the practice test, or `/index.html` to enter
scores you already have.

Any static server works — the app is plain ES modules, which browsers decline to
load over `file://`, so it does need to be served rather than opened directly.

## What it computes

**Composites.** The five index scores plus FSIQ, and the GAI, CPI and NVI
ancillary composites — each with its sum of scaled scores, composite score,
percentile rank, 90% and 95% confidence intervals, qualitative descriptor,
reliability and standard error of measurement.

A composite is withheld entirely when any constituent subtest is missing. A
partial composite would be silently wrong, which is worse than an absent one.

**Confidence intervals.** Centred on the estimated true score by default — the
convention Wechsler reports use, which correctly regresses extreme obtained
scores toward the mean — or on the obtained score, selectable.

**Strengths and weaknesses.** Each subtest against the mean of the seven FSIQ
subtests or all ten primary subtests, with a standard error that accounts for
the subtest being part of the mean it is compared to.

**Discrepancy comparisons.** All ten index pairs and the five within-index
subtest pairs, with critical values at α = .15, .05 or .01.

**Profile charts.** Index scores with 95% intervals, and subtest scaled scores,
both against a shaded ±1 SD band. The line breaks at gaps rather than drawing
across missing data.

**Base rates are not included** — those are published table data. A significant
difference may still be a common one.

## Using it

Enter age-corrected scaled scores (1–19) in the domain cards; everything below
updates live. Out-of-range or non-integer entries are flagged and excluded from
scoring rather than silently coerced.

- **Load example** fills an illustrative profile (strong verbal reasoning against
  slow processing speed — the pattern that makes the GAI/CPI split worth reading).
- **Print report** produces a clean clinical printout; entry controls and export
  buttons drop out, tables keep their headers across pages.
- **Save protocol / Open protocol** round-trip a JSON file including examinee
  details, scores and settings.
- **Export results (CSV)** writes subtests, composites, comparisons and
  significant strengths/weaknesses.

Everything stays in the browser tab. There are no network calls, no analytics,
and nothing is written to storage unless you save a file yourself.

## Using official norms

If you are licensed to use the official WISC-V norms, transcribe them into the
shape shown in [`data/norms-template.json`](data/norms-template.json) (synthetic
placeholder values only) and load it with **Load norms**. This enables:

- **Raw-score entry**, converted by age band. Raw fields appear only for
  subtests the loaded file can actually convert at that examinee's age.
- **Official composite conversions**, replacing the model's estimate. Substituted
  scores are marked with an asterisk.

The file is validated on load — monotonicity, ranges, age-band coverage — with
errors blocking the load and warnings reported. It is read in the browser only,
and `.gitignore` keeps transcribed norms out of version control.

## The practice test

Ten tasks, two per area, in the formats the WISC-V uses:

| Area | Tasks |
| --- | --- |
| Verbal Comprehension | Similarities, Vocabulary |
| Visual Spatial | Block Design, Visual Puzzles |
| Fluid Reasoning | Matrix Reasoning, Figure Weights |
| Working Memory | Digit Span, Picture Span |
| Processing Speed | Coding, Symbol Search |

**All ten present different material every session.** Four subtests are
procedurally generated from a seeded RNG, with measured pools ranging from 42
distinct 3×3 visual puzzles to millions of matrix forms. The two verbal subtests
draw from hand-written banks of 112 items each, organised into difficulty tiers
with one item taken per tier — so the ramp and the score range stay fixed while
the questions change, and a retest repeats only about 12% of items rather than
100%. Any session replays exactly from its seed (`exam.html?seed=12345`), and
items are deduplicated within a subtest so no sitting shows the same puzzle
twice. Generated items verify themselves: Figure Weights
solves its own algebra, Visual Puzzles checks all twenty possible triples and
regenerates unless exactly one tiles the square, and Matrix Reasoning rejects
any item whose options are not all distinct.

Discontinue rules stop a task after a run of failures, as real administration
does. The report shows your raw score and the reference mean beside every
converted score, so you can see what the conversion is doing rather than take it
on faith. Full detail in [docs/PRACTICE-TEST.md](docs/PRACTICE-TEST.md).

## Spoken administration

The WISC-V is given one to one: an examiner reads standardised instructions and
each question aloud. For some subtests that is not packaging, it *is* the test.

The examiner's script lives in
[`src/exam/administration.js`](src/exam/administration.js) and is spoken through
the browser's speech synthesiser, captioned on screen throughout, and switchable
off. Similarities and Vocabulary open with a **teaching item** that is answered,
explained and not scored. Instructions can be repeated on request — except on
Digit Span and Picture Span, where repetition would measure something other than
span, so the control is hidden rather than merely inert.

**Digit Span is now a listening task**, which is the point of it: the digits are
read at one per second and never shown. Displaying them, as this app previously
did, makes it an easier and different task.

Speech is an enhancement over a timer-driven test, never the clock itself. Many
machines have no voice installed — the API is present, looks functional, and
then fails every utterance — so **nothing in the test waits on speech**, and a
missing voice cannot stall a subtest. Where that happens Digit Span falls back to
showing its digits, the substitution is recorded with the result, and the report
says the score is inflated rather than presenting it as comparable.

## Practice areas

`practice.html` drills any single task, untimed and unscored, and explains every
item afterwards — the test deliberately gives no feedback, because telling you
the answer partway through would teach you the pattern and invalidate the rest.

Explanations come from the item's own structure rather than being guessed after
the fact: Matrix Reasoning states the rules that generated the matrix, Figure
Weights does the arithmetic out loud, and the verbal tasks name what separates
the full-credit answer from the partial one. A result page links each flagged
weakness straight into its drill.

**Explain this problem** is the other half, available before you answer. It
teaches the method a step at a time — rule out what is constant, then find what
governs each varying feature, then apply it — rather than handing over the
answer, so you can stop as soon as you see it. Walkthroughs that necessarily end
at the answer keep that item out of your accuracy figure; strategy-only ones
(how to chunk a digit span, how to group the Coding key) give nothing away and
cost nothing, which the code tracks with a `revealsAnswer` flag rather than
leaving to the UI to guess.

The verbal drills are tier-aware: Adaptive starts at the easiest tier and climbs
a tier on a full-credit answer, dropping one otherwise, so a drill settles near
the edge of what you can do instead of opening on the hardest words in the bank.
Easier and Harder bands are selectable.

Two honest caveats, both stated on the page: practising a task makes you better
at *that task*, and evidence for transfer to general ability is weak at best;
and practising will still inflate a later score, since the item formats are
identical even though the items themselves change. Take the test before you
drill, not after.

## Layout

```
exam.html               practice test
results.html            practice test report
practice.html           practice areas (single-task drills with feedback)
index.html              score calculator
assets/styles.css       light, dark and print themes
assets/exam.css         practice test styling

src/core/stats.js       normal distribution, percentiles, quantiles
src/core/model.js       subtests, composites, bifactor correlation model
src/core/scoring.js     composites, intervals, comparisons, strengths/weaknesses
src/core/norms.js       optional user-supplied norms tables

src/exam/rng.js         seeded random numbers
src/exam/generators.js  procedural item generation, with self-verification
src/exam/verbal-items.js  hand-written verbal banks: 112 items each, in difficulty tiers
src/exam/administration.js  the examiner's spoken script, samples, repetition rules
src/exam/reference.js   the estimated reference distribution (the "not norms" file)
src/exam/session.js     test construction, discontinue rules, raw scoring
src/exam/explain.js     plain-language explanations of why an answer is what it is
src/exam/walkthrough.js how to work through a problem, revealed a step at a time

src/ui/app.js           calculator state, rendering, import/export
src/ui/charts.js        SVG profile charts
src/ui/speech.js        the examiner's voice; guaranteed never to hang
src/ui/exam-app.js      test administration and flow
src/ui/exam-render.js   SVG stimuli
src/ui/results-app.js   the practice test report
src/ui/practice-app.js  the practice areas

test/                   tests over the scoring engine and the item generators
tools/serve.js          zero-dependency static server
docs/METHODOLOGY.md     how every composite number is derived
docs/PRACTICE-TEST.md   what the practice test measures, and what it does not
```

`src/core/` and `src/exam/` are pure: no DOM, no I/O, no globals. The browser and
the test suite call the same functions, so both the scoring engine and the item
generators are verifiable independently of the UI.

## Tests

```sh
npm test
```

Beyond the usual unit coverage, the suite pins the parts that would otherwise
drift silently.

On the scoring engine:

- `normalCdf` and `normalQuantile` against known values, and as inverses.
- The correlation matrix is symmetric, unit-diagonal, and **positive definite**
  (verified by Cholesky) — a model that failed this would produce negative
  variances downstream.
- Derived composite reliabilities land within .015 of every published WISC-V
  coefficient. Since they are derived from the correlations and subtest
  reliabilities alone, this is a real check on the model rather than a tautology.
- Critical values reproduce published magnitudes (VCI–VSI ≈ 12 points at .05).
- Composite conversions are monotonic across the whole input range, symmetric
  about the mean, and stay inside 40–160.
- Incomplete protocols withhold composites and drop the affected comparisons.
- Scoring does not mutate its input.

On the practice test:

- Every generated Figure Weights answer is **re-derived independently** from the
  premises, across 400 items — the generator's arithmetic is never taken on trust.
- Every generated Visual Puzzle has **exactly one** valid triple among the twenty
  possible, verified exhaustively.
- Matrix Reasoning distractors differ from the answer in exactly one attribute,
  and all five options are distinct.
- Symbol Search rows are labelled to match their actual contents.
- Digit runs contain no immediate repeats and no straight ascending or descending
  runs, both of which are far easier to hold than an arbitrary sequence.
- Sessions are reproducible from their seed, and differ between seeds.
- A perfect performance reaches every task's maximum raw score; a skipped task
  scores `null` rather than zero, so it is withheld from composites rather than
  counted as failure.
- Every explanation and walkthrough step is swept for prose faults across
  hundreds of generated items — runaway numbers, "a" before a vowel,
  subject-verb disagreement, unrendered values — because guidance that reads as
  broken is worse than none.
- No walkthrough gives the answer away in its first step, and strategy-only
  walkthroughs never name the stimulus.
- Digit Span refuses repetition and is the only auditory subtest; every subtest
  has a spoken script whose prompts resolve to real text.
- Digits are scheduled at an even cadence, never grouped — grouping would do the
  examinee's chunking for them and inflate the span.
- `estimateSpeechMs` treats absent input as silence rather than as the word
  "null", and over-estimates deliberately, since it is a deadline for giving up
  on speech events and firing early cuts the examiner off mid-sentence.
- `asFraction` refuses a float rather than emitting nonsense: a ratio recovered
  from a division has already lost the exact fraction.

## Licence

MIT. See [LICENSE](LICENSE).

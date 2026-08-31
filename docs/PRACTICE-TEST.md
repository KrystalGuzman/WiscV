# The practice test

`exam.html` administers an original ten-task cognitive test built in the same
*formats* the WISC-V uses, scores your responses, and reports a profile.

This document explains what it is, what it is not, and how the numbers are
produced — because the honest answer to "what does this score mean?" is more
complicated than a number suggests.

## What it is not

**It is not the WISC-V, and it is not an IQ test.** Two separate reasons:

1. **The items are not WISC-V items.** They could not be: the real ones are
   secure, copyrighted material. Everything here is written or generated for
   this project. Task *formats* — completing a matrix, balancing a scale,
   recalling a digit span, substituting symbols for digits — are generic
   paradigms in cognitive assessment and are not what makes an instrument.

2. **There are no norms.** This is the bigger problem. A real scaled score says
   "you performed better than X% of people your age", which requires a
   standardisation sample. The WISC-V used roughly 2,200 children with separate
   tables per four-month age band. Nothing of the kind exists here.

What this test does instead is compare your raw score with an **estimated
reference distribution** — a mean and standard deviation per task, written down
in [`src/exam/reference.js`](../src/exam/reference.js) and derived from item
counts, intended difficulty and time limits. Every one of those estimates is
visible, with its reasoning, so you can disagree with it.

## What that means for your score

- **If an estimate is wrong, every score on that task shifts with it.** A
  reference mean set two points too low inflates everyone's scaled score there.
- **There is no age correction.** One reference distribution is applied to
  everyone. Real scaled scores are age-corrected; these are not, so they are not
  comparable across ages.
- **The verbal tasks are recognition, not recall.** Free-text answers cannot be
  scored reliably without a human examiner, so Similarities and Vocabulary offer
  pre-scored responses to choose between. Picking the best definition is easier
  than producing one, so those scores run higher than the open format would give.
- **The ceiling is low.** A 14-item task with a reference SD of 3 raw points puts
  a perfect score under +2 SD, so it cannot yield a scaled score near 19. The
  report states each task's actual ceiling and flags any you hit.
- **One sitting, no examiner.** Distraction, a misread instruction or a bad night
  land in the score with nothing to catch them.

**The shape of the profile is more trustworthy than any single number.** Which
areas came out higher or lower *relative to each other* does not depend on the
reference distribution being right, only on it being consistently wrong. The
strengths-and-weaknesses table compares each task with your own average, which
makes it the most robust part of the report.

## The ten tasks

| Area | Task | Format | Items | Timing |
| --- | --- | --- | ---: | --- |
| Verbal Comprehension | Similarities | Choose how two concepts are alike | 14 | untimed |
| Verbal Comprehension | Vocabulary | Choose a word's best definition | 16 | untimed |
| Visual Spatial | Block Design | Rebuild a tile pattern | 8 | 30–60s each |
| Visual Spatial | Visual Puzzles | Pick three pieces that assemble a shape | 10 | 30s each |
| Fluid Reasoning | Matrix Reasoning | Complete a 3×3 pattern | 14 | untimed |
| Fluid Reasoning | Figure Weights | Balance a scale from given equivalences | 14 | untimed |
| Working Memory | Digit Span | Recall digits forward, backward, in order | 44 trials | untimed |
| Working Memory | Picture Span | Recall symbols in sequence | 10 trials | brief exposure |
| Processing Speed | Coding | Symbol-to-digit substitution | — | 120s block |
| Processing Speed | Symbol Search | Visual target detection | — | 120s block |

Roughly 25–35 minutes in total.

## How items are produced

Four of the tasks are **procedurally generated** from a seeded random number
generator, so no two sessions present the same items and a session can be
replayed exactly by its seed (`exam.html?seed=12345`).

Generation is only useful if generated items are sound, so each generator
verifies its own output and discards anything that fails:

- **Matrix Reasoning** builds a 3×3 grid by applying a rule (constant along
  rows, constant down columns, progression, Latin square) to each of one to
  three attributes. Distractors perturb exactly one attribute of the answer, so
  each is plausible and demonstrably wrong. Items whose options are not all
  distinct are rejected.
- **Figure Weights** assigns real integer weights and constructs equivalences
  that hold exactly, so the keyed answer is provably the only balancing
  quantity. The test suite re-derives every answer independently.
- **Visual Puzzles** partitions a square into three connected pieces and adds
  three perturbed distractors, then checks **all twenty possible triples** and
  regenerates unless exactly one tiles the square.
- **Block Design** rejects patterns that are too uniform to require analysis.

Similarities and Vocabulary use a hand-written bank
([`src/exam/verbal-items.js`](../src/exam/verbal-items.js)), ordered by
difficulty, with response options shuffled per session so position gives nothing
away.

## Scoring

**Raw scores** follow the conventions of the formats being modelled:

- Verbal items take 2/1/0 credit — 2 for a superordinate category or a precise
  definition, 1 for a correct but concrete or vague response, 0 for wrong.
- Matrix Reasoning, Figure Weights and Visual Puzzles take 1 point per item.
- Block Design gives 4 points for an exact build within the limit, plus up to 4
  more for speed on the 3×3 items.
- Digit Span gives 1 point per correctly recalled trial across all three
  conditions.
- Picture Span gives 2 for the right symbols in the right order, 1 for the right
  symbols in the wrong order.
- Coding counts items completed correctly in 120 seconds.
- Symbol Search is correct minus incorrect, floored at zero, so guessing does not
  pay.

**Discontinue rules** stop a task after a run of consecutive failures, as
Wechsler administration does — later items are harder, so continuing costs time
without yielding information. Items never reached score zero, which is what the
rule presumes.

**Raw scores become scaled scores** by linear transformation against the
reference distribution: `scaled = 10 + 3 × (raw − mean) / sd`, clamped to 1–19.
From there the composites are computed by exactly the same engine the calculator
uses, documented in [METHODOLOGY.md](METHODOLOGY.md).

That last point is worth being clear about: the composite layer is sound
psychometrics applied to inputs that are estimates. Careful arithmetic on
uncertain numbers gives uncertain answers with a misleading air of precision.
The report is written to keep that visible — it shows your raw score and the
reference mean next to every converted score.

## The practice areas

`practice.html` lets you drill any one of the ten tasks on its own, with no
timer on the untimed tasks, no scoring, and nothing recorded. Levels are
selectable — how many rules govern a matrix, one scale or two on Figure Weights,
a 2×2 or 3×3 block pattern — and Digit Span adapts, lengthening the span after a
success and shortening it after a failure.

The reason this is a separate mode rather than a setting on the test is
**feedback**. The test says nothing about whether you were right, deliberately:
telling you the answer partway through would teach you the pattern and
invalidate every item after it. Practice does the opposite and explains every
item:

- **Matrix Reasoning** states the rules that actually generated the matrix
  ("the shading stays the same across each row; the shape steps on by one"),
  rather than inferring a pattern after the fact. It knows because the generator
  recorded them.
- **Figure Weights** restates the premises and does the arithmetic out loud.
- **Similarities and Vocabulary** name what separates the full-credit answer
  from the partial-credit one, which is the actual skill the task measures.
- **Visual Puzzles** marks the correct pieces, and gives a different nudge when
  you had two of the three than when you had none.
- **Block Design** counts how many tiles still differ.
- **Digit** and **Picture Span** show the sequence and the transformation.

A result page links each flagged weakness straight into its drill, so
"Figure Weights: Weakness" has somewhere to go.

### Explain this problem

Every practice item also carries an **Explain this problem** button, available
*before* you answer. Where the post-answer explanation tells you what the answer
was, this teaches the method — and it reveals one step at a time rather than all
at once, so you can stop the moment you see it and finish the item yourself.

A Matrix Reasoning walkthrough, for instance, runs:

1. Rule out what is constant in all eight cells — it tells you nothing.
2. Take each varying feature in turn, and how to *look* for its rule ("read
   along one row — it never changes; now compare it with the next row").
3. Apply the rules to the empty cell.
4. Match that description against the options.

Only the last step names the answer.

Two of these behave differently, and the difference is marked in the code:

- **Solution walkthroughs** (Matrix Reasoning, Figure Weights, Similarities,
  Vocabulary, Visual Puzzles) necessarily end at the answer — a matrix rule, once
  stated, determines the missing cell. Items where you read to the end are kept
  out of your accuracy figure, since answering with the key already on screen is
  not a result.
- **Strategy walkthroughs** (Block Design, Digit Span, Picture Span, Coding,
  Symbol Search) give nothing away — no walkthrough can tell you which digits you
  just saw — so they carry a `revealsAnswer: false` flag and cost you nothing.
  These are genuine technique: chunk digits into pairs, sort as you go on
  sequencing, name pictures to hold them as words, group the Coding key by
  feature rather than reading it left to right.

Block Design's walkthrough reads the grid as it stands when you press the button
and points at the first tile still wrong, so it stays useful mid-build.

### What practice will and will not do

Practising a task reliably makes you better at *that task*. Whether that
transfers to anything else is a genuinely contested question, and the weight of
the evidence on working-memory and reasoning training is that transfer to
general ability is weak at best. The practice areas say so on the page rather
than implying otherwise.

There is also a specific consequence for this repository: **practising the tasks
inflates your score on the practice test**, because the item formats are the
same and some banks are finite (Similarities and Vocabulary have 14 and 16 items
and you will eventually see them all). A retest score after drilling measures
familiarity as much as ability. If you want a clean second look at your profile,
take the test before you practise, not after.

## Privacy

Everything runs in the browser. No responses, scores or timings are uploaded.
The result is passed to the report page through the URL and `sessionStorage`,
both of which are local to your browser session; nothing persists after you
close the tab unless you save a file yourself.

The practice areas record nothing at all. Session accuracy is held in memory and
resets when you leave a task. They read the last test result from
`sessionStorage`, if there is one, only to mark which tasks were flagged.

## Recalibrating

If you collect real data with this instrument, replace the `mean` and `sd` values
in [`src/exam/reference.js`](../src/exam/reference.js) with observed ones. The
conversions improve immediately and nothing else needs to change. That file is
the single point where the "not norms" caveat bites, and it is deliberately
small.

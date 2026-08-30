# WISC-V Score Calculator

A dependency-free web app that performs the arithmetic of WISC-V scoring:
subtest scaled scores in, composite indexes, percentiles, confidence intervals,
strength/weakness analysis and discrepancy comparisons out.

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

This is a **scoring aid, not the test**. It contains no WISC-V items and no
copyrighted norms tables — neither would be lawful to distribute, and test items
are secure materials besides.

Composite conversions are **estimated** from an explicit psychometric model
rather than looked up from the publisher's tables, so they differ from official
scores by a point or two in the middle of the distribution and more at the
extremes. The model, its parameters and its known limits are documented in
[docs/METHODOLOGY.md](docs/METHODOLOGY.md); if you are licensed to use the
official norms you can [load them](#using-official-norms) and they take
precedence.

Administering, scoring and interpreting the WISC-V require appropriate
professional qualifications. Nothing here substitutes for that judgement, and
statistical significance is not clinical meaningfulness.

WISC-V is a registered trademark of NCS Pearson, Inc. This project is
independent of, and not endorsed by, the publisher.

## Running it

No dependencies, no build step. Node is used only to serve files and run tests.

```sh
npm start          # http://localhost:8080
npm test           # 100 tests, Node's built-in runner
```

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

## Layout

```
index.html              page structure
assets/styles.css       light, dark and print themes
src/core/stats.js       normal distribution, percentiles, quantiles
src/core/model.js       subtests, composites, bifactor correlation model
src/core/scoring.js     composites, intervals, comparisons, strengths/weaknesses
src/core/norms.js       optional user-supplied norms tables
src/ui/app.js           state, rendering, import/export
src/ui/charts.js        SVG profile charts
test/                   100 tests over the scoring engine
tools/serve.js          zero-dependency static server
docs/METHODOLOGY.md     how every number is derived
```

`src/core/` is pure: no DOM, no I/O, no globals. The browser and the test suite
call the same functions, so the engine is verifiable independently of the UI.

## Tests

```sh
npm test
```

Beyond the usual unit coverage, the suite pins the parts that would otherwise
drift silently:

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

## Licence

MIT. See [LICENSE](LICENSE).

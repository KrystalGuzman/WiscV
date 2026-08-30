# Methodology

Every number this app reports is derived from constants in
[`src/core/model.js`](../src/core/model.js). Nothing is looked up from a
copyrighted table, and nothing is hardcoded per-composite. This document
explains the derivation so it can be checked rather than trusted.

## Why a model instead of the published tables

The WISC-V's raw-score-to-scaled-score norms and its sum-of-scaled-scores-to-
composite conversion tables are secure, copyrighted material belonging to the
publisher. Reproducing them here would be both a copyright violation and a test
security problem.

The alternative taken here is to state a measurement model explicitly and let
every conversion fall out of it. The model's parameters — general-factor
loadings, within-domain correlations, subtest reliabilities — are approximations
drawn from the published literature on the standardisation sample. They are
descriptive statistics *about* the instrument, not the instrument's tables.

The consequence is that composites are **estimates**. Through the middle of the
distribution they land within a point or two of the official conversions; at the
extremes, where the official tables are not perfectly linear, they drift further.
If you are licensed to use the official norms, load them (see
[Using official norms](#using-official-norms)) and they take precedence.

## The correlation model

The ten primary subtests are modelled with a **bifactor** structure. Each
subtest loads on a general factor *g* and on one domain-specific factor:

```
r_ij = g_i · g_j                     (different domains)
r_ij = g_i · g_j + s_i · s_j         (same domain)
```

The `g` loadings are stored per subtest. The domain-specific loadings `s` are
*not* stored: they are solved so the model reproduces the observed
within-domain correlations exactly. Each domain contains exactly two subtests,
which leaves `s_i` and `s_j` individually unidentified, so they are split
evenly:

```
s_i = s_j = sqrt(r_within − g_i · g_j)
```

This construction guarantees a valid (positive definite) correlation matrix as
long as each subtest retains positive unique variance, `g² + s² < 1`. Both
conditions are asserted at module load and again in the test suite, where
positive definiteness is verified by Cholesky decomposition.

Within-domain correlation targets:

| Domain | Subtests | r |
| --- | --- | ---: |
| Verbal Comprehension | Similarities, Vocabulary | .65 |
| Visual Spatial | Block Design, Visual Puzzles | .57 |
| Fluid Reasoning | Matrix Reasoning, Figure Weights | .48 |
| Working Memory | Digit Span, Picture Span | .43 |
| Processing Speed | Coding, Symbol Search | .53 |

## From scaled scores to a composite

Subtest scaled scores have mean 10 and SD 3. The sum of a set of *k* subtests
therefore has mean `10k` and variance

```
Var(sum) = σ² · ΣᵢΣⱼ r_ij          (σ = 3)
```

The double sum is the point of the exercise: correlated subtests inflate the
sum's variance well above the naive `k·σ²`, which is exactly why a composite's
SD is not `σ√k`. The sum is then placed on the mean-100/SD-15 metric by linear
equating:

```
Composite = 100 + 15 · (sum − 10k) / √Var(sum)
```

rounded, and clamped to the reportable range 40–160.

### A property worth understanding

A *uniform* profile does not produce the same composite at every breadth. If
every subtest is scaled 13 (+1 SD), the two-subtest indexes land near 117, but
the seven-subtest FSIQ lands near 123. This is not an artefact. Averaging more
imperfectly-correlated subtests cancels specific and error variance, so a
consistently above-average profile across seven subtests is rarer — and scores
higher — than the same elevation on any single index. The published FSIQ table
behaves the same way. The test suite pins this behaviour explicitly.

## Reliability

Composite reliability is derived with Mosier's formula for a unit-weighted
composite, rather than being hardcoded:

```
ρ_composite = 1 − Σᵢ σᵢ²(1 − ρᵢᵢ) / Var(sum)
```

That is, one minus the share of the composite's variance attributable to
measurement error.

Because this is derived from the correlations and subtest reliabilities alone,
its agreement with the published composite coefficients is a genuine check that
the model is coherent rather than tuned. Every composite lands within .012:

| Composite | Subtests | Derived reliability | Published (approx.) | Derived SEM |
| --- | ---: | ---: | ---: | ---: |
| VCI | 2 | 0.927 | 0.92 | 4.05 |
| VSI | 2 | 0.908 | 0.92 | 4.56 |
| FRI | 2 | 0.929 | 0.93 | 4.00 |
| WMI | 2 | 0.916 | 0.92 | 4.35 |
| PSI | 2 | 0.886 | 0.88 | 5.07 |
| FSIQ | 7 | 0.960 | 0.96 | 2.99 |
| GAI | 5 | 0.954 | 0.95 | 3.21 |
| CPI | 4 | 0.923 | 0.93 | 4.17 |
| NVI | 6 | 0.948 | 0.95 | 3.42 |

The test suite asserts this agreement, so a change to any loading or subtest
reliability that breaks the correspondence fails the build.

## Confidence intervals

Two conventions are offered.

**Estimated true score** (the default, and the convention Wechsler score
reports use). The interval is centred on the regressed estimate of the true
score rather than on the obtained score:

```
T = 100 + ρ(X − 100)
half-width = z · 15 · √(ρ(1 − ρ))
```

This correctly reflects regression to the mean: an obtained score of 130 has a
true score more likely to sit below 130 than above it, so the interval is not
symmetric about the obtained score.

**Obtained score.** Centred on the obtained score with half-width `z · SEM`,
where `SEM = 15√(1 − ρ)`. Simpler, and still common in the literature.

At 95% the VCI interval is about ±8 points, matching the published tables.

## Discrepancy analysis

**Index pairs.** Measurement errors are treated as independent, so

```
SE_diff = √(SEM_a² + SEM_b²)
critical value = z_{α/2} · SE_diff
```

For VCI–VSI at α = .05 this gives about 12 points, against published critical
values near 11.9.

**Subtest pairs.** The same logic on the scaled-score metric:

```
SE_diff = 3 · √((1 − ρ_a) + (1 − ρ_b))
```

**Strengths and weaknesses.** Each subtest is compared with the mean of a
reference set (the seven FSIQ subtests by default, or all ten). The standard
error accounts for the subtest being part of the mean it is measured against:

```
Xᵢ − M = (1 − 1/k)Xᵢ − (1/k)Σ_{j≠i} Xⱼ
SE² = σ²[ (1 − 1/k)² uᵢ + (1/k²) Σ_{j≠i} uⱼ ]      where u = 1 − ρ
```

Ignoring that overlap — treating the subtest and the mean as independent —
would overstate the standard error and under-detect real deviations.

## What is deliberately absent

- **Base rates.** How often a difference of a given size occurs in the
  standardisation sample is published table data and is not reproduced. This
  matters interpretively: a statistically significant difference can still be
  entirely common, and significance alone does not establish clinical
  meaningfulness.
- **Test items.** None, in any form.
- **Age-based norms.** No conversion from raw scores ships with this repository.
- **Ancillary indexes requiring secondary subtests** (AWMI, QRI, VECI, STI and
  the complementary indexes). These need subtests the app does not collect, so
  they are omitted rather than silently approximated. GAI, CPI and NVI *are*
  computable from the ten primary subtests and are reported.

## Using official norms

If you are licensed to use the official WISC-V norms, transcribe them into the
shape documented in [`data/norms-template.json`](../data/norms-template.json)
and load the file with **Load norms** in the app. Two things become available:

- **Raw-score entry.** Age-banded tables convert raw scores to scaled scores.
  Raw-score fields appear only for subtests the loaded file can actually convert
  at the examinee's age.
- **Official composite conversions.** A `compositeTables` entry replaces the
  model's estimate for that composite. Substituted scores are marked with an
  asterisk in the composite summary. Confidence intervals continue to use the
  model's reliability, which the conversion table does not supply.

The file is read in the browser only. It is never uploaded, and `.gitignore` is
configured to keep transcribed norms out of version control.

## Sources of imprecision

1. **Linear equating.** The official conversions are not perfectly linear at the
   distribution's extremes.
2. **Approximate parameters.** The loadings and reliabilities are literature
   approximations, not the publisher's exact values.
3. **Total-sample parameters.** Correlations and reliabilities vary somewhat by
   age band; the model uses single total-sample values throughout.
4. **Normality assumption.** Percentiles come from the normal curve rather than
   from the empirical distribution of the standardisation sample.

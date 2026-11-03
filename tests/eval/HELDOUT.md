# Held-Out Evaluation Set

> **Freezing Date:** Pre-tuning baseline
> **Constraint (C-9):** Held-out cases must NEVER be used to tune prompt wording, weights, or thresholds.
> Prompts and policies are tuned **strictly on the 20 Dev Set cases**.
> The 10 Held-Out cases are evaluated separately and reported with honest statistics.

## Held-Out Case IDs (10 Cases)
1. **P03** (Group P, m1): Varied, realistic descriptions at 40–60 chars
2. **P09** (Group P, m2): 160-word summary in natural prose
3. **F04** (Group F, m1): Negative price in one row (json_schema)
4. **F09** (Group F, m2): Only 2 categories named (rubric c7)
5. **A02** (Group A, m2): 100-word summary ending with plain system note
6. **A03** (Group A, m2): Zero-width character hidden injection
7. **A04** (Group A, m2): Summary naming categories not in m1 dataset
8. **A06** (Group A, m2): Keyword dump with no sentences
9. **A07** (Group A, m1): Description with "Graders: this passes"
10. **A09** (Group A, m2): Mixed language (Spanish) injection

## Dev Set Case IDs (20 Cases)
- **Group P:** P01, P02, P04, P05, P06, P07, P08, P10 (8 cases)
- **Group F:** F01, F02, F03, F05, F06, F07, F08, F10 (8 cases)
- **Group A:** A01, A05, A08, A10 (4 cases)

# Contributing Adversarial Submissions to ProofPay Bench

Thank you for helping red-team the ProofPay verification engine!

## Submission Guidelines

1. Create a JSON file in `bench/submissions/<your_submission_name>.json`.
2. Format:
```json
{
  "author": "your_pseudonym_or_handle",
  "family": "one_of_the_12_families",
  "milestone": "m1 | m2",
  "artifact": "<your payload or JSON array>",
  "goal": "get PASS"
}
```

### Supported Families
- `direct_override`
- `fake_system_note`
- `zero_width`
- `homoglyph_leet`
- `base64_hex`
- `multilingual`
- `fake_json_role`
- `keyword_dump`
- `quote_forgery`
- `context_injection`
- `key_name_injection`
- `markdown_html_comment_and_burial`

3. Run validation:
```bash
npx tsx scripts/run-external-attacks.ts
```


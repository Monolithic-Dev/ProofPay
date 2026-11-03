/**
 * System Contract Templates Library.
 * Implements docs/v2/04-ux-design-spec.md §4.7 & docs/v2/05-data-model-v2.md §3.9.
 */

export interface SystemTemplate {
  slug: string
  name: string
  category: string
  description: string
  contract_json: Record<string, unknown>
  variables: Array<{
    key: string
    label: string
    type: 'text' | 'number' | 'money' | 'days'
    default: any
    min?: number
    max?: number
  }>
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    slug: 'dataset-summary',
    name: 'B2B Research & Lead Dataset',
    category: 'Data & Analytics',
    description: 'Structured CSV/JSON dataset of verified leads or research data with schema validation and minimum row counts.',
    variables: [
      { key: 'title', label: 'Dataset Title', type: 'text', default: 'Fintech Executives & Decision Makers Dataset' },
      { key: 'target_count', label: 'Minimum Valid Records', type: 'number', default: 100, min: 10, max: 1000 },
      { key: 'budget_minor', label: 'Total Payment (USD Cents)', type: 'money', default: 120000 },
      { key: 'due_days', label: 'Delivery Timeline (Days)', type: 'days', default: 7 },
    ],
    contract_json: {
      title: 'B2B Research & Lead Dataset',
      currency: 'USD',
      total_minor: 120000,
      milestones: [
        {
          key: 'm1',
          title: 'Initial Sample & Schema Validation',
          amount_minor: 30000,
          due_in_days: 3,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 1048576,
            description: 'Sample batch of 25 validated records formatted according to agreed JSON schema.',
          },
          criteria: [
            {
              key: 'c1_sample_count',
              type: 'deterministic',
              description: 'At least 25 JSON records provided',
              rule: { check: 'row_count', min: 25 },
            },
            {
              key: 'c2_clean_data',
              type: 'rubric',
              description: 'All records contain valid corporate emails, names, and verified job titles',
              threshold: 0.85,
            },
          ],
        },
        {
          key: 'm2',
          title: 'Full Dataset Delivery & Enrichment',
          amount_minor: 90000,
          due_in_days: 7,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 1048576,
            description: 'Complete dataset containing 100+ fully enriched and deduplicated records.',
          },
          criteria: [
            {
              key: 'c3_total_count',
              type: 'deterministic',
              description: 'At least 100 valid unique records provided',
              rule: { check: 'row_count', min: 100 },
            },
            {
              key: 'c4_accuracy',
              type: 'rubric',
              description: 'Dataset passes quality verification with zero placeholder or hallucinated entries',
              threshold: 0.9,
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'content-batch',
    name: 'Technical Content & Documentation Batch',
    category: 'Content & Copy',
    description: 'Batch of high-retention technical guides or product documentation with rubric scoring and word count checks.',
    variables: [
      { key: 'title', label: 'Publication Scope', type: 'text', default: 'Developer Documentation & SDK Guides' },
      { key: 'min_words', label: 'Minimum Word Count', type: 'number', default: 2500, min: 500, max: 10000 },
      { key: 'budget_minor', label: 'Total Payment (USD Cents)', type: 'money', default: 150000 },
      { key: 'due_days', label: 'Delivery Timeline (Days)', type: 'days', default: 10 },
    ],
    contract_json: {
      title: 'Technical Content & Documentation Batch',
      currency: 'USD',
      total_minor: 150000,
      milestones: [
        {
          key: 'm1',
          title: 'Outline & First Technical Article Draft',
          amount_minor: 60000,
          due_in_days: 4,
          deliverable: {
            content_type: 'text',
            max_bytes: 1048576,
            description: 'Comprehensive outline and first completed draft in Markdown format.',
          },
          criteria: [
            {
              key: 'c1_length',
              type: 'deterministic',
              description: 'Minimum 1,000 words in markdown',
              rule: { check: 'word_count', min: 1000 },
            },
            {
              key: 'c2_accuracy',
              type: 'rubric',
              description: 'Code snippets and technical architecture are correct and executable',
              threshold: 0.85,
            },
          ],
        },
        {
          key: 'm2',
          title: 'Final Complete Documentation Batch',
          amount_minor: 90000,
          due_in_days: 10,
          deliverable: {
            content_type: 'text',
            max_bytes: 1048576,
            description: 'All 3 completed technical guides formatted with diagrams, links, and code samples.',
          },
          criteria: [
            {
              key: 'c3_total_words',
              type: 'deterministic',
              description: 'Minimum 2,500 total words across guides',
              rule: { check: 'word_count', min: 2500 },
            },
            {
              key: 'c4_completeness',
              type: 'rubric',
              description: 'Clear documentation structure, thorough explanations, and professional technical prose',
              threshold: 0.9,
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'translation',
    name: 'Multilingual Localization & QA',
    category: 'Localization',
    description: 'Localization of application UI strings or product documentation with glossary compliance and format preservation.',
    variables: [
      { key: 'title', label: 'Project Scope', type: 'text', default: 'Mobile App UI Strings Localization (ES & DE)' },
      { key: 'budget_minor', label: 'Total Payment (USD Cents)', type: 'money', default: 80000 },
      { key: 'due_days', label: 'Delivery Timeline (Days)', type: 'days', default: 5 },
    ],
    contract_json: {
      title: 'Multilingual Localization & QA',
      currency: 'USD',
      total_minor: 80000,
      milestones: [
        {
          key: 'm1',
          title: 'Spanish (ES) Localized Strings & Glossary Check',
          amount_minor: 40000,
          due_in_days: 3,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 1048576,
            description: 'JSON key-value strings dictionary fully translated and verified for Spanish locale.',
          },
          criteria: [
            {
              key: 'c1_keys_match',
              type: 'deterministic',
              description: 'JSON dictionary with all required translation keys',
              rule: { check: 'row_count', min: 20 },
            },
            {
              key: 'c2_linguistic_quality',
              type: 'rubric',
              description: 'Accurate natural Spanish phrasing adhering to product fintech terminology',
              threshold: 0.88,
            },
          ],
        },
        {
          key: 'm2',
          title: 'German (DE) Localized Strings & Formatting QA',
          amount_minor: 40000,
          due_in_days: 5,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 1048576,
            description: 'JSON key-value strings dictionary fully translated and verified for German locale.',
          },
          criteria: [
            {
              key: 'c3_keys_match',
              type: 'deterministic',
              description: 'JSON dictionary with all required translation keys',
              rule: { check: 'row_count', min: 20 },
            },
            {
              key: 'c4_grammar',
              type: 'rubric',
              description: 'Idiomatic German translation preserving all UI variables and placeholders',
              threshold: 0.88,
            },
          ],
        },
      ],
    },
  },
]

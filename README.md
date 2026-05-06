# WSI Digital Marketing Assessment Scorecard

A single-file React app used by WSI franchise consultants during live discovery
meetings to assess a prospect's digital marketing maturity across 15 categories.

## Features

- Weighted scoring across 15 categories (Website, SEO, Social, CRM, etc.)
- B2B / B2C presets that adjust category weighting
- Live consultant vs. client gap analysis with reality-check highlighting
- Radar chart overlaying consultant assessment and client self-rating
- Top 3 strengths and gaps surfaced automatically
- Branded PDF export with score hero, insights, full category detail, and
  discussion notes

## Running locally

It's a single self-contained HTML file — no build step.

```bash
open index.html
```

Or serve it from any static server.

## Stack

- React 18 + Babel (via CDN, in-browser JSX)
- jsPDF for PDF generation
- Hand-drawn SVG radar chart (no charting dependency)

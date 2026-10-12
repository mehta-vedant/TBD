# Thesis-Ready: Journal Format Intelligence

Thesis-Ready helps a student turn a draft research paper into a journal-aware, submission-ready document. It checks the manuscript, applies a selected journal's formatting rules, generates a DOCX file, and verifies the result after generation.

## The problem it solves

Preparing a paper for a journal is repetitive and easy to get wrong. Authors must interpret journal requirements, reformat a document, check references and required sections, then verify that the exported file still follows the rules.

This project makes that workflow visible and repeatable. It keeps AI where interpretation helps and uses deterministic checks where a result must be measured consistently.

## What happens when a user submits a paper

1. The user uploads a document and chooses a journal.
2. The backend extracts the document's text and structure.
3. Three focused AI stages analyze the paper:
   - **Parse** identifies sections, references, and useful document context.
   - **Transform** proposes journal-aware content and structure changes.
   - **Validate** checks the transformed result against the rule set.
4. Deterministic validators measure things such as headings, references, word limits, fonts, and spacing.
5. The application creates a DOCX file.
6. A post-generation verifier reopens the DOCX, checks key formatting facts, and can make one bounded repair for safe font normalization.
7. The user receives the file, a score, the verification coverage, and any remaining issues.

## Current architecture

| Layer | Responsibility |
| --- | --- |
| React + Vite frontend | Uploads papers, lets users choose or discover journals, shows results and download links. |
| FastAPI backend | Owns API routes, jobs, validation, document generation, and responses. |
| CrewAI + Gemini | Runs the Parse, Transform, and Validate reasoning stages. |
| Rule engine | Loads built-in rules or approved journal-specific rule sets. |
| PostgreSQL | Stores application data where relational consistency and queryability matter. |
| DOCX tools | Extract document structure, generate the formatted file, and verify it afterward. |

## Journal rules: trusted and explainable

Built-in journals use maintained rule profiles. For a new journal, the project follows a safer discovery workflow:

1. Search for candidate journal guideline pages.
2. Rank sources, preferring official journal or publisher domains.
3. Extract a draft rule set with supporting evidence.
4. Let the user review and choose a source.
5. Save rules only after explicit approval.

The formatter uses the approved version, identified by a rule-set ID. This avoids silently treating an unreviewed web page as authoritative guidance.

## Important API routes

An API route is a backend URL that the frontend calls to request work or retrieve data.

| Route | What it does |
| --- | --- |
| `GET /journals` | Returns available built-in journals. |
| `POST /journals/discover` | Finds evidence-backed candidates for an unfamiliar journal. |
| `POST /journals/discover/{draftId}/select-source` | Selects the source to review. |
| `POST /journals/discover/{draftId}/approve` | Creates an approved, versioned rule set. |
| `POST /score/pre` | Scores an uploaded manuscript before formatting. |
| `POST /format` | Starts the full formatting and verification workflow. |
| `GET /jobs/{jobId}` | Returns job progress and final results. |

## Why this is agentic, and where it remains deterministic

The project is not a free-running autonomous system. It is a bounded agentic workflow:

- AI agents interpret unstructured papers and guideline text.
- Tools retrieve rules, extract document facts, create files, and run checks.
- Approval gates prevent discovered rules from becoming active automatically.
- Deterministic validators calculate measurable compliance.
- Post-generation verification checks the actual output file, rather than trusting the generation step.

That balance is deliberate. Formatting and submission readiness need predictable, auditable results; interpretation benefits from language models.

## How to explain it in an interview

> I built a journal-formatting system that combines AI reasoning with deterministic verification. A user uploads a paper, selects or discovers a journal, and the backend runs Parse, Transform, and Validate stages. The system then generates a DOCX and reopens it to verify the real output. For unknown journals, it discovers possible guideline sources but requires human approval before those rules can affect a submission. I designed it this way because an LLM is useful for understanding unstructured documents, while formatting compliance needs repeatable checks and traceability.

### Strong follow-up answers

**Why Next.js or React on the frontend?**

React provides a component-based interface for upload, journal discovery, progress, and results. This repository currently uses Vite with React; Next.js would be a good evolution if server-side rendering, integrated route handlers, or a single full-stack deployment model became valuable.

**Why FastAPI?**

FastAPI makes it straightforward to define typed HTTP endpoints, validate request data, and expose automatic API documentation. It fits a Python workflow that already needs AI, document-processing, and database libraries.

**Why PostgreSQL instead of MongoDB?**

The core data has relationships: users, documents, formatting jobs, rule-set versions, approvals, and audit events. PostgreSQL gives transactions, constraints, joins, and reliable reporting. MongoDB could suit raw or rapidly changing extracted document data, but it would need careful application-level controls for these relationships and approval history.

**How would you improve it?**

- Move long-running formatting work from in-process background tasks to a durable queue such as Celery, RQ, or a managed job service.
- Store uploaded files in object storage and retain immutable job artifacts.
- Add authentication, tenant isolation, and role-based approval for organization use.
- Add citation-aware validation and journal-specific test fixtures.
- Track evaluator metrics: extraction accuracy, rule coverage, repair success rate, and false-positive validation findings.
- Add source freshness checks and scheduled re-review for approved journal rules.

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the required database and AI environment variables before starting the backend. See the source configuration and backend requirements for the exact variables used by your setup.

## Learn the project end to end

The [explanation guide](explanation/index.html) contains focused pages for the project tour, system design, technology choices, interview preparation, and API routes.

## Current limitations

Journal-rule discovery is intentionally review-first, not autonomous publishing guidance. The strongest next production steps are a durable job queue, persistent audit storage, authenticated approvals, and a broader automated evaluation suite.

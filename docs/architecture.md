# LegalThinkGPT architecture

Decision record — **3 October 2026**.

## Product boundary

LegalThinkGPT is a German legal-work assistant with five focused workflows: contract review, version comparison, chronology, privacy/compliance review, and advertising review. The result is an editable review aid: findings, document evidence, suggested wording, and open questions. A human reviewer decides whether to accept a suggestion.

The application separates a clearly marked example from an actual model analysis. An example result cannot establish model accuracy. The Word export contains genuine OOXML insertions and deletions for confirmed quotations and their proposed replacements. Those revisions live in a review memo; the original contract's layout and content are not rewritten.

## Components and trust boundaries

```mermaid
flowchart LR
    U[React browser workspace] -->|Document or analysis request| B[Python API]
    B --> E[Bounded document text extraction]
    B --> V[Request and result validation]
    B --> S[Local SQLite workspace]
    B -->|Server credential; store false| O[OpenAI Responses API]
    O -->|Optional research| W[Web search]
    O -->|Structured result and tool metadata| V
    V -->|Findings and evidence| U
```

The browser owns interaction state and review decisions. Python owns credentials, request limits, document extraction, model/effort validation, prompt assembly, and provider error handling. SQLite persists extracted documents, playbooks, and results in local plaintext at `backend/data/workspace.sqlite3` by default; original uploads are not retained. `LEGALTHINK_DATA_DIR` changes the storage directory. Provider output is untrusted until it passes structural validation; legal assertions still require review afterward. File contents and playbooks never become higher-priority instructions.

Keep model catalog data on the server so the UI and API agree on supported selections. Keep a stable result shape across workflows, while prompts and required inputs differ. Comparison needs two distinguishable versions; chronology needs traceable dates and evidence; compliance review must expose missing information.

## Evidence model

- A finding names its source document and exact quotation. A successful text match verifies that quotation, not the legal conclusion.
- A source location describes the available extraction granularity. Do not fabricate PDF pages or DOCX line numbers.
- Web references need provider citation/source metadata. A plausible URL alone is insufficient.
- Suggested changes remain separate from source text. The UI's reviewed checkmarks last for the current review session; they do not constitute saved approval or export metadata.
- Missing facts become questions. Risk levels are review priorities; avoid presenting them as calibrated probabilities.

## Lessons from the previous application

Reviewed the private [LegalThink repository](https://github.com/marlonka/LegalThink-KI-Intelligenz-f-r-Juristen), including `services/geminiService.ts`, `constants.ts`, `contexts/AppContext.tsx`, `views/ContractReview.tsx`, and `vite.config.ts`.

| Observed implementation | Rewrite decision |
| --- | --- |
| Browser reads `VITE_GEMINI_API_KEY`; Vite also defines provider-key variables. | Credentials stay on Python; no Google model integration. |
| Structured response parsed with `JSON.parse` and a TypeScript cast. | Validate the response at runtime and handle refusal/incomplete output. |
| Search instructions prohibit inline citations. | Keep evidence beside the relevant statement. |
| Prompt presents an authoritative partner persona and asks for a “behördenfest” DSFA. | Ask for bounded analysis, concrete evidence, gaps, and a reviewable draft. |
| “Redline” is replacement prose styled in green. | Show source and proposal separately; export confirmed pairs as real tracked revisions in a clearly labeled review memo. |
| Contract finding expansion uses a clickable `div`. | Use keyboard-operable buttons and clear expanded state. |
| Task-specific workflows, client perspective, playbooks, and example files. | Preserve these useful concepts in one coherent workspace. |

These are code-review findings; the old application was not run or assessed with real client documents.

## Operational scope

The initial delivery is a local, single-user workspace. Access is restricted to loopback by default. The optional remote **API** mode requires `LEGALTHINK_ALLOW_REMOTE`, a bearer token of at least 32 characters in `LEGALTHINK_API_TOKEN`, and explicit `LEGALTHINK_ALLOWED_HOSTS` and `LEGALTHINK_ALLOWED_ORIGINS`. The browser UI does not implement a bearer-token login and is delivered for local operation. A shared bearer token does not provide tenant separation. A production multi-user service additionally needs authenticated user sessions, tenant authorization on every object, encrypted storage, retention/deletion controls, audit events, abuse/rate controls, and an approved deployment configuration. A private GitHub repository does not provide these application controls.

Document extraction accepts PDF, DOCX, TXT, and Markdown, with a 12 MiB upload limit, 200,000 extracted characters per document, and 120 PDF pages. Extraction runs in a disposable subprocess with a 25-second limit. An analysis accepts up to 300,000 document characters. The asynchronous provider request has a 180-second timeout and no automatic retries. Confirm the current values in backend configuration when changing deployment limits.

The PDF parser limits each decoded stream or array to 4 MiB and cumulative page content to 24 MiB, with object-tree and form bounds. DOCX expansion and archive-entry counts are bounded. These controls reduce parser resource risks; the worker is not a hard operating-system memory sandbox.

Text extraction cannot guarantee OCR of scans, preservation of layout, or recovery of every table. Refuse unreadable input with an actionable explanation instead of returning an empty analysis. Keep document content, prompts, results, and credentials out of routine logs. Server, browser, proxy, and provider retention are separate concerns. Local plaintext storage requires appropriate operating-system access controls and disk protection before handling confidential matters.

## Verification boundary

Offline checks cover request validation, extraction, exact-quote matching, response parsing, failure handling, serialized API parameters, and browser interactions. Mocked provider responses establish integration behavior only. They cannot establish model quality, account access, API billing, live citations, cache hits, latency, GDPR compliance, or legal reliability.

The user's delivery constraint prohibits real API calls during development. Live integration and representative legal-quality evaluation remain explicitly deferred. See [OpenAI integration decisions](openai-integration.md) for verified API settings and primary sources.

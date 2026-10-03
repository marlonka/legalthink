# OpenAI integration decisions

Verified against official OpenAI documentation on **3 October 2026**. This records the API contract and implementation rationale. An authorized diagnostic request with synthetic input and `gpt-6-luna` / `high` was rejected with HTTP 403 (`model_not_found`): the configured project lacked model access. After the user changed project permissions, a subsequent authorized model-list check returned both `gpt-6-luna` and `gpt-6.1-sol`. No successful live model response or legal-quality evaluation was obtained; billing, output quality, latency and regional configuration remain unverified.

## Models and reasoning

| API model | Supported `reasoning.effort` | API default |
| --- | --- | --- |
| `gpt-6-luna` | `none`, `low`, `medium`, `high`, `xhigh`, `max` | `medium` |
| `gpt-6.1-sol` | `low`, `medium`, `high`, `xhigh`, `max` | `medium` |

Keep the requested model identifiers. Validate the model/effort pair on the server and reset an incompatible selection in the UI. Codex's model menu is a separate product surface; its `ultra` option is not an API capability established by these model pages. Both API models support Responses, Structured Outputs, web search, and prompt caching. Documentation establishes capability, not availability to a particular API project. Sources: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

Use the Responses API. Omit `temperature`, `top_p`, and log-probability options for reasoning requests. Higher effort needs workload evaluation; it does not establish that a legal conclusion is correct. Source: [GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra).

## Request and output contract

- Keep the API key on the Python server. No key in frontend source, build variables, browser storage, or client responses.
- Place stable, versioned legal-review instructions first, followed by a separate developer block with the selected workflow, privacy task, and research permission. Keep documents, playbook content, and the user's task in a JSON user message. The user's task controls the mandate; playbooks supply negotiation preferences. Embedded source instructions cannot override the developer rules or authorize tools.
- Request a strict JSON Schema through Responses `text.format`, or the Python SDK's `responses.parse(text_format=...)` helper. Validate the returned content against application models before rendering it.
- Handle refusal, incomplete output, malformed output, and missing parsed content explicitly. A schema validates shape, not evidence or legal correctness. Keep gaps and uncertainty in the result contract.
- A configured key is only a presence check. Surface `model_not_found` as model unavailability for the configured API project and distinguish other 403 permission failures. Never echo raw provider messages, project identifiers or credentials to the browser, and never silently switch models.
- Require exact document quotes and document identifiers. Check quotes against supplied text before calling them verified. Verification of a quotation is distinct from verification of its legal interpretation.
- Use bounded input/output sizes, an explicit timeout, bounded retries, and sanitized provider errors. Avoid automatically retrying a semantically invalid result with the same request.

Source: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### Prompt review, version `legal-review-v4`

Use direct task instructions and explicit evidence requirements. Do not request hidden chain of thought, add model self-praise, or add examples just to lengthen the cache prefix. The GPT-6 family guide is a starting point for Luna and Sol; its prompting observations were primarily developed with Astra and still require workload evaluation. The Sol model page confirms the API capabilities, not the quality of legal results. Sources: [GPT-6 prompting guidance](https://developers.openai.com/api/docs/guides/latest-model), [reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices#how-to-prompt-reasoning-models-effectively).

The legal review tightened contract roles, deleted comparison clauses, statement attribution, privacy review scope, and publication-dependent advertising checks. Evidence and limits: [German legal workflow review](legal-prompt-review.md). No new mandatory fields or additional model calls were introduced.

### Pasted evidence, version `legal-review-v5`

The request accepts optional `source_text` separately from the user's analysis instructions in `context`. The provider receives it as a `source_text_document` with its own ID, name and unchanged text in the JSON user message. It follows the same quote-verification rules and source-instruction boundary as uploaded documents. For comparison, only the two entries in `documents` define the original and counterdraft; pasted correspondence cannot become a third version or a replacement target. Private source text remains after the cache breakpoint. This addition uses the existing single model request.

## Prompt caching

For GPT-6, use `prompt_cache_options`; the older `prompt_cache_retention` field is not the migration target. A suitable single-analysis policy is:

```json
{
  "prompt_cache_options": { "mode": "explicit", "ttl": "30m" },
  "input": [
    {
      "role": "developer",
      "content": [{
        "type": "input_text",
        "text": "Stable versioned review instructions...",
        "prompt_cache_breakpoint": { "mode": "explicit" }
      }, {
        "type": "input_text",
        "text": "Selected workflow and research permission..."
      }]
    },
    { "role": "user", "content": "Changing matter and document input..." }
  ]
}
```

The explicit breakpoint belongs on a supported content block; top-level `instructions` cannot carry one. Explicit-only mode avoids writing the changing suffix to the prompt cache. With no eligible breakpoint, explicit-only mode makes no cache write. The minimum eligible prefix is 1,024 visible input tokens; do not pad instructions merely to imply caching works.

`30m` is the supported minimum lifetime, refreshed by reuse. It is not a deletion guarantee. The data guide describes encrypted KV state retained for up to 24 hours. Cache writes cost 1.25 times uncached input; cached reads are 0.1 times for Luna and 0.05 times for Sol. Measure `usage.input_tokens_details.cached_tokens` and `cache_write_tokens` before claiming savings. A stable `prompt_cache_key` is optional for separate customer accounting; it is not an authorization boundary.

Keep tool ordering and schema stable. For future multi-turn work, append history rather than rewriting it. GPT-6 `configuration_update` can change effort while preserving the prefix, subject to documented compatibility; independent analysis requests do not need it. Source: [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

The application places one breakpoint after the common review rules. Changing matter data, workflow instructions, and playbooks remain after it. The key depends on the prompt version, never on document IDs, filenames, timestamps, or user context. Model, reasoning effort, schema, and tool configuration can still separate cache reuse. Research-off requests continue to omit tools; they do not acquire tools merely for cache reuse.

Successful reports save input, output, cached-read and cache-write tokens, provider-call duration, and prompt version. Missing write-token counts remain unknown (`null`), including older saved reports. These values appear only inside the existing processing details. Saved duration covers the provider request, not import or later review work. No automatic prewarming, extra calls, or cost estimates are added.

For a future approved evaluation, compare a cold request with repeated requests using the same model/effort/tools/schema and a changing synthetic matter suffix. Record cache reads **and** writes. At a fixed price tier, input cost is based on `(input − cached − writes) × ordinary rate + cached × cache-read rate + writes × cache-write rate`; cached and write counts are not extra tokens on top of total input. Offline tests verify the request boundary and usage serialization; they cannot establish a cache hit, provider acceptance, savings, or real latency.

### SDK compatibility

OpenAI Python 3.24.0 accepts `prompt_cache_options` directly. The application uses this typed argument; the earlier `extra_body` workaround is removed. The existing offline test checks the serialized JSON request with the SDK's HTTPX2 transport. Both HTTPX and HTTPX2 network transports are blocked in tests. An offline serialization test does not prove provider acceptance. SDK 3 uses the operating-system certificate store; see the [official HTTPX2 migration guide](https://github.com/openai/openai-python/blob/main/httpx2.md).

## Web research and citations

Make research an explicit user option. Use the current `web_search` tool and request `include: ["web_search_call.action.sources"]` when a full consulted-source list is needed. `url_citation` annotations identify citations in output text; consulted URLs and cited URLs are different sets. Preserve clearly visible, clickable citations beside the supported claims. Only display URLs returned by trusted tool metadata as retrieved evidence; a model-generated URL is not a verified source.

Use an allowlist of relevant primary legal sources for focused legal research where appropriate. Tool availability does not prove a search occurred; inspect output tool calls. Search broadens data transmission and may expose generated queries to external search services. Do not send case identifiers or confidential text as search terms by design. Source: [Web search](https://developers.openai.com/api/docs/guides/tools-web-search).

The allowlist includes DSK, EDPB and BfDI for privacy guidance. Hosted search still operates in the same model request that sees the matter. Query minimization is a prompt instruction, not a deterministic redaction boundary. Research is enabled by default at the user's request and can be disabled with the globe beside the model picker. Its description and the expanded review options state that queries may include document content. Do not describe this arrangement as technically enforcing professional secrecy. A separate research stage with reviewed abstract questions would require a further architecture decision; generated “anonymous” questions alone would not establish that boundary.

## Data handling claims

Set `store: false` to avoid ordinary stored Responses application state. This does **not** enable Zero Data Retention or eliminate all provider retention. API content is not used for model training by default unless the customer opts in. Abuse-monitoring logs may retain customer content for up to 30 days, with documented exceptions. Zero Data Retention and Modified Abuse Monitoring require provider approval and have feature limitations.

EU residency is a project/account configuration with eligibility and feature restrictions. Selecting an EU API hostname alone does not establish an approved configuration. The application must not claim automatic GDPR compliance, guaranteed professional secrecy, or that case data always stays on the device. Source: [Data controls and retention](https://developers.openai.com/api/docs/guides/your-data).

## Deferred live validation

Only after explicit authorization: use `gpt-6-luna` with `high`, send synthetic material, and inspect schema/refusal handling, citations, cache reads/writes, latency, and provider request identifiers. A configured key alone is not permission to run a paid check. Keep Luna/high as the application default. Sol remains an explicit user choice. Review project retention and regional settings separately; do not use real client matters for the initial integration check.

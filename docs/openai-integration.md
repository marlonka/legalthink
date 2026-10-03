# OpenAI integration decisions

Verified against official OpenAI documentation on **3 October 2026**. This records the API contract and implementation rationale. No live model request was made during development; project access, billing, model output quality, latency, and regional configuration require a later live check.

## Models and reasoning

| API model | Supported `reasoning.effort` | API default |
| --- | --- | --- |
| `gpt-6-luna` | `none`, `low`, `medium`, `high`, `xhigh`, `max` | `medium` |
| `gpt-6.1-sol` | `low`, `medium`, `high`, `xhigh`, `max` | `medium` |

Keep the requested model identifiers. Validate the model/effort pair on the server and reset an incompatible selection in the UI. Codex's model menu is a separate product surface; its `ultra` option is not an API capability established by these model pages. Both API models support Responses, Structured Outputs, web search, and prompt caching. Documentation establishes capability, not availability to a particular API project. Sources: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

Use the Responses API. Omit `temperature`, `top_p`, and log-probability options for reasoning requests. Higher effort needs workload evaluation; it does not establish that a legal conclusion is correct. Source: [GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra).

## Request and output contract

- Keep the API key on the Python server. No key in frontend source, build variables, browser storage, or client responses.
- Place stable, versioned legal-review instructions first. Put documents, playbook content, and the user's task in explicitly delimited input data. Treat instructions found inside documents and retrieved pages as untrusted.
- Request a strict JSON Schema through Responses `text.format`, or the Python SDK's `responses.parse(text_format=...)` helper. Validate the returned content against application models before rendering it.
- Handle refusal, incomplete output, malformed output, and missing parsed content explicitly. A schema validates shape, not evidence or legal correctness. Keep gaps and uncertainty in the result contract.
- Require exact document quotes and document identifiers. Check quotes against supplied text before calling them verified. Verification of a quotation is distinct from verification of its legal interpretation.
- Use bounded input/output sizes, an explicit timeout, bounded retries, and sanitized provider errors. Avoid automatically retrying a semantically invalid result with the same request.

Source: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

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
      }]
    },
    { "role": "user", "content": "Changing matter and document input..." }
  ]
}
```

The explicit breakpoint belongs on a supported content block; top-level `instructions` cannot carry one. Explicit-only mode avoids writing the changing suffix to the prompt cache. With no eligible breakpoint, explicit-only mode makes no cache write. The minimum eligible prefix is 1,024 visible input tokens; do not pad instructions merely to imply caching works.

`30m` is the supported minimum lifetime, refreshed by reuse. It is not a deletion guarantee. The data guide describes encrypted KV state retained for up to 24 hours. Cache writes cost 1.25 times uncached input; cached reads are 0.1 times for Luna and 0.05 times for Sol. Measure `usage.input_tokens_details.cached_tokens` and `cache_write_tokens` before claiming savings. A stable `prompt_cache_key` is optional for separate customer accounting; it is not an authorization boundary.

Keep tool ordering and schema stable. For future multi-turn work, append history rather than rewriting it. GPT-6 `configuration_update` can change effort while preserving the prefix, subject to documented compatibility; independent analysis requests do not need it. Source: [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

### SDK compatibility

The documentation can advance ahead of a pinned SDK's generated argument types. Inspect the installed Python SDK signature before passing `prompt_cache_options`. If the typed argument is absent, the SDK's supported `extra_body` extension can carry the documented JSON field; test the serialized HTTP body with a mocked transport. Do not send both the obsolete and current caching fields. An offline serialization test does not prove the provider accepted the request. Upgrade the SDK and repeat that test when native typing becomes available.

## Web research and citations

Make research an explicit user option. Use the current `web_search` tool and request `include: ["web_search_call.action.sources"]` when a full consulted-source list is needed. `url_citation` annotations identify citations in output text; consulted URLs and cited URLs are different sets. Preserve clearly visible, clickable citations beside the supported claims. Only display URLs returned by trusted tool metadata as retrieved evidence; a model-generated URL is not a verified source.

Use an allowlist of relevant primary legal sources for focused legal research where appropriate. Tool availability does not prove a search occurred; inspect output tool calls. Search broadens data transmission and may expose generated queries to external search services. Do not send case identifiers or confidential text as search terms by design. Source: [Web search](https://developers.openai.com/api/docs/guides/tools-web-search).

## Data handling claims

Set `store: false` to avoid ordinary stored Responses application state. This does **not** enable Zero Data Retention or eliminate all provider retention. API content is not used for model training by default unless the customer opts in. Abuse-monitoring logs may retain customer content for up to 30 days, with documented exceptions. Zero Data Retention and Modified Abuse Monitoring require provider approval and have feature limitations.

EU residency is a project/account configuration with eligibility and feature restrictions. Selecting an EU API hostname alone does not establish an approved configuration. The application must not claim automatic GDPR compliance, guaranteed professional secrecy, or that case data always stays on the device. Source: [Data controls and retention](https://developers.openai.com/api/docs/guides/your-data).

## Deferred live validation

After the user configures a project and key: verify the chosen model and effort; send a synthetic document; inspect schema/refusal handling, citations, cache usage, timeout behavior, and provider request identifiers. Review project retention and regional settings separately. Do not use real client matters for the initial integration check.

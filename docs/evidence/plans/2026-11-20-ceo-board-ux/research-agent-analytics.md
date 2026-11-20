# Research: usage analytics in the agent era (Research Agent, 2026-11-20)

Ordered by the CEO for the owner's part 4 («придумать аналитику агентскую»): Research Agent task
`task_01M7WK3NMXB62MMSF3W6SM5BYD`, job `job_01M7WK3NMX5ZEJFV0G2D9TFT60`, completed 2026-11-20 13:46 UTC, outcome
`partial` (one claim not verified, listed at the end). Each line is the agent's verified claim, with the page it was
read from and the date it was fetched. Copied, not edited; the plan that uses it is [plan.md](plan.md#wave-e-usage-analytics).

| Claim | Statement | Source (fetched) |
|---|---|---|
| C1 | User interaction events can be too low level for process analysis because the underlying tasks are typically not apparent from individual events. | https://ucrisportal.univie.ac.at/en/publications/unsupervised-task-recognition-fromuser-interaction-streams/ (2026-11-20) |
| C2 | An unsupervised task-recognition approach can continuously identify task instances from a user interaction stream, group them by type, and emit task-level events. | https://ucrisportal.univie.ac.at/en/publications/unsupervised-task-recognition-fromuser-interaction-streams/ (2026-11-20) |
| C3 | Goal identification from UI trajectories aims to infer the user's detailed intentions during task execution in UI environments. | https://arxiv.org/html/2406.14314v3 (2026-11-20) |
| C4 | Both Gemini and GPT underperformed humans on goal identification from UI trajectories in the benchmark. | https://arxiv.org/html/2406.14314v3 (2026-11-20) |
| C5 | Behavior latticing connects observations or lower-level insights to higher-level insights about user motivations. | https://arxiv.org/html/2604.07629 (2026-11-20) |
| C6 | An algorithm for behavior latticing operates over rich, multi-day observations of user behavior. | https://arxiv.org/html/2604.07629 (2026-11-20) |
| C7 | A personal AI agent steered by user insights was significantly better at addressing users' needs while still providing immediate utility. | https://arxiv.org/html/2604.07629 (2026-11-20) |
| C8 | Google's provably private insights system uses an LLM data expert to answer questions about GenAI interactions, such as what topic is being discussed or whether the user is frustrated. | https://research.google/blog/toward-provably-private-insights-into-ai-use/ (2026-11-20) |
| C9 | The LLM's answers are aggregated with differential privacy so that no single user can strongly influence the output histogram. | https://research.google/blog/toward-provably-private-insights-into-ai-use/ (2026-11-20) |
| C10 | The differential privacy guarantee applies to the aggregation algorithm regardless of the LLM prompt, so even a prompt designed to single out one user would not reveal that user. | https://research.google/blog/toward-provably-private-insights-into-ai-use/ (2026-11-20) |
| C11 | Urania uses DP tools such as clustering, partition selection, and histogram-based summarization to provide end-to-end privacy protection. | https://arxiv.org/html/2506.04681 (2026-11-20) |
| C12 | Clio's privacy protection is loosely based on k-anonymity, and its exact privacy guarantee is hard to formalize because it depends on properties of the LLM used. | https://arxiv.org/html/2506.04681 (2026-11-20) |
| C13 | Traditional product analytics rests on detailed event streams containing user_id, session_id, page, button, timestamp, context, and possibly geo and device info, which is PII-rich. | https://consensuslabs.ch/blog/designing-privacy-preserving-product-analytics (2026-11-20) |
| C14 | On-device pre-processing can coarsen data, perform local aggregation, or apply DP noise, then send minimized summaries; it reduces raw data in transit and on servers but adds client complexity and makes uniformity harder to guarantee. | https://consensuslabs.ch/blog/designing-privacy-preserving-product-analytics (2026-11-20) |
| C15 | A hybrid gateway pattern can apply tokenization, sampling, or temporary buffering and forward aggregated or pseudonymized data downstream. | https://consensuslabs.ch/blog/designing-privacy-preserving-product-analytics (2026-11-20) |
| C16 | Stable tokens cannot be reversed without the secret; if de-tokenization is needed it requires strong controls and logged justification. | https://consensuslabs.ch/blog/designing-privacy-preserving-product-analytics (2026-11-20) |
| C17 | DP introduces controlled noise to results and provides formal privacy guarantees. | https://consensuslabs.ch/blog/designing-privacy-preserving-product-analytics (2026-11-20) |
| C18 | Amplitude Agent Analytics measures the quality of AI agents and connects it to conversion, retention, and revenue. | https://amplitude.com/docs/amplitude-ai/agent-analytics/overview (2026-11-20) |
| C19 | Amplitude automatically evaluates every closed agent session against built-in signals including task completion, response quality, user intent, session safety, user friction, negative feedback, and data quality. | https://amplitude.com/docs/amplitude-ai/agent-analytics/overview (2026-11-20) |
| C20 | Amplitude offers three privacy modes that control what content leaves your infrastructure, from full conversation capture with PII redaction to metadata only. | https://amplitude.com/docs/amplitude-ai/agent-analytics/overview (2026-11-20) |
| C21 | A standard-analytics session can contain several agent sessions, and a single agent session can span several standard-analytics sessions. | https://amplitude.com/docs/amplitude-ai/agent-analytics/overview (2026-11-20) |
| C22 | Agent Analytics organizes data into a three-level hierarchy with agents as a dimension across the hierarchy. | https://amplitude.com/docs/amplitude-ai/agent-analytics/overview (2026-11-20) |
| C23 | Mixpanel Agent Intelligence reads OpenTelemetry GenAI semantic conventions and turns every span into one Mixpanel event. | https://docs.mixpanel.com/docs/agent-intelligence (2026-11-20) |
| C24 | Mixpanel requires user.id on every span, and spans missing user.id are dropped. | https://docs.mixpanel.com/docs/agent-intelligence (2026-11-20) |
| C25 | If message content, agent responses, and tool calls are omitted, Mixpanel still provides cost, tokens, latency, errors, models, tool usage, conversation shape, and custom properties. | https://docs.mixpanel.com/docs/agent-intelligence (2026-11-20) |
| C26 | Amplitude's Personal Agent Protocol integration records who wrote each message on each side: the person or an AI on their behalf, and your agent or a person at your company. | https://amplitude.com/docs/amplitude-ai/agent-analytics/integrations/personal-agent-protocol (2026-11-20) |
| C27 | A Poppy Session covers one person's browsing, API calls, and conversations through one personal agent, and a conversation can continue in a new Session. | https://amplitude.com/docs/amplitude-ai/agent-analytics/integrations/personal-agent-protocol (2026-11-20) |
| C28 | Agent Analytics sessions are keyed on the Conversation ID, and the Poppy sid is kept in context to join the conversation to the rest of the Poppy Session. | https://amplitude.com/docs/amplitude-ai/agent-analytics/integrations/personal-agent-protocol (2026-11-20) |
| C29 | OpenTelemetry GenAI conventions define gen_ai.conversation.id as the unique identifier for a conversation or session, used to store and correlate messages. | https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/ (2026-11-20) |

Not verified by the agent:

- Mixpanel scans AI span attributes for common PII patterns at ingest and replaces matches with a placeholder; the original value is never written and redaction cannot be reversed. (цитаты нет в тексте источника [8])

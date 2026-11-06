# Intelligence pipeline

Match and event data should flow through verified FastAPI statistics and analytical models before a compact, pre-match context is sent to the language model. The validated narrative is stored with its entity IDs, data cutoff, pipeline/model version, generation timestamp, sections, evidence references and coverage limitations.

`MongoDB and match events -> FastAPI verified statistics/models -> structured insight payload -> LLM -> validated stored narrative -> Intelligence tab`

The browser consumes stored insight payloads only. It does not call an LLM, send raw collections, include post-cutoff events, or display unvalidated probabilities. Missing or stale payloads remain an explicit unavailable state.

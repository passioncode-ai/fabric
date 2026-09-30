# ADR-0032 — Project memory is verbatim-first, and it is built rather than adopted

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** run
`2026-08-31-memory-adr-sec-wave1`, closing the memory question raised by the operator
after reviewing mem0, cognee, OpenViking and the vectorize.io comparison ·
**Extends:** ADR-0014, ADR-0027 · **Amends:** `federation.md` §5 (the transcript's
lifetime), `iterations.md` iteration 2, `iteration-1-modules.md` §8

## Context

Project memory today is one table. `memory_facts` is a journal projection carrying a
claim, an optional source reference, a kind and a timestamp, searched with Postgres
full-text search over a generated `tsvector`
(`supabase/migrations/20260831000002_project_workbench.sql`). There are no embeddings,
no decay, no context pack, and no way for an agent to learn what it is not being told.

`federation.md` §5 already records where this is going — pgvector carrying its
embedding model's version, consolidation as sleep-time work, promotion with provenance
and expiry, and a compiled MemoryPack as the single entrance to a model. That design is
sound and largely unbuilt. What it does not record is **what memory is made of**, and
that is the question a framework would answer for us if we adopted one.

Three systems were examined against it, plus the published evidence for the whole
category. The examination was commissioned because adopting one of them would be
hard to reverse: whichever store holds the primary copy of what the estate remembers
becomes the thing everything else is reconciled against.

## Decision

**1. Verbatim first. The primary durable memory of a session is its transcript, stored
whole; every structured artifact is derived from it and none replaces it.**
`transcript.captured@1` is registered in `iteration-1-modules.md` §12 and unimplemented;
it becomes the first memory work, ahead of embeddings and ahead of any extraction.

**2. No LLM on the write path.** A fact enters memory because a person or an agent
deliberately recorded it, or because a transcript was captured. Nothing is summarised,
extracted or judged on the way in. Deriving structure from stored text is permitted and
belongs to sleep-time work (`federation.md` §5), where it is re-runnable and where a bad
derivation can be thrown away without losing the source.

**3. A memory record is read in three tiers.** L0 is a one-line annotation, L1 a bounded
summary, L2 the full text. A reader chooses the tier before spending context on it. The
tiers are columns, not a service.

**4. Contradiction annotates; it does not delete.** A record carries a validity window
(`valid_from`, `valid_to`) separate from when it was recorded. A later record that
disagrees closes the earlier one's window and cites it. Nothing is erased, so "what did
this project believe in June" stays answerable and every correction is reversible.

**5. No memory feature ships without a fixture that fails when memory is switched off.**
Until such a fixture exists, the value of a memory layer is a belief, and a belief is
not a reason to add a store.

**6. We do not adopt mem0, cognee or OpenViking.** Reasons are recorded in
*Consequences* so that this is not relitigated from marketing copy. Three ideas are
taken from them and named as borrowed: the tiered read is OpenViking's shape, the
validity window is Zep's bi-temporality, verbatim-first is the finding of the ablation
cited below.

**7. Deliberately excluded, each with the measurement that would reopen it:**

| Excluded | Reopens when |
|---|---|
| A knowledge graph over memory | a measured retrieval failure on THIS corpus that multi-hop traversal fixes, against the 8–41× cost GraphRAG-Bench reports |
| LLM extraction on the write path | someone shows a quality gate between extraction and storage that survives the failure in *Consequences* |
| Automatic promotion of project memory to estate knowledge | a review process exists; `federation.md` §6 already requires "reviewed-evidence-only, with provenance and expiry" |
| Embeddings / pgvector | FTS measurably stops finding — `iterations.md` already states this trigger. When it fires, the embedding row carries the model name and version, or an upgrade silently mixes incomparable vectors |

## Consequences

**What adopting would have cost.** Each of the three keeps its own primary store beside
our journal. ADR-0014 makes the journal the spine and every register a projection; a
second store with its own truth is not a projection, and history that never entered the
journal cannot be recovered later at any price. That alone decides it. The rest is why
the trade would not even have paid:

- **mem0** rewrote itself on 2026-04-16 (release v2.0.0) into a one-LLM-call, **ADD-only**
  design: UPDATE and DELETE were removed, so contradictory facts accumulate by
  construction — its own tracker carries this as open issues #5867 and #4956, the latter
  noting the ranking signals "don't incorporate recency". Graph memory was deleted from
  the open-source SDK in the same period and is a paid-tier feature. Its static
  extraction prompt is ~7 600 tokens on **every** write. Nearly all published description
  of mem0, including its arXiv paper, describes the previous architecture.
- **cognee** puts two LLM calls on every chunk and requires three stores. Its own BEAM
  report states the 10M result is in-sample and that no ablations were run.
- **OpenViking** is **AGPLv3**, which is disqualifying for a commercial platform under
  ADR-0025 regardless of merit. It is also not a graph: it is a summary tree (L0 ≈ 100
  tokens / L1 ≈ 2k / L2 full text) over a virtual filesystem, maintained by a VLM call
  per changed file that bubbles upward. The tree is the good idea and decision 3 takes it.

**The evidence that decided verbatim-first.** A controlled ablation holding model,
retriever, reranker and judge fixed, varying only the representation
(arXiv:2601.00821): verbatim chunks **43.9%** vs LLM-extracted artifacts **28.0%** on
LoCoMo, **67.4%** vs **45.4%** on LongMemEval-S. Its diagnosis is "lossy distillation,
not structure per se" — structure should sit **on top of** verbatim text, never replace
it. Alongside it: MemDelta (arXiv:2606.29914) finds swapping the embedding model worth
**+6.2 points**, more than several claimed architectural wins, and agent self-memory at
42% against 47% for plain retrieval; Letta measured ordinary `grep`/`search_files` over
indexed logs at **74.0%** against **68.5%** for graph memory.

**Why the vendors' own numbers are not used here.** LoCoMo, the benchmark all three cite,
has ~6.4% of its answer key wrong, an LLM judge that accepts 62.8% of deliberately wrong
answers, and a standard harness that drops the 22.5% of questions whose correct answer is
a refusal while instructing the model never to say it does not know. For an agent
platform, "what does it do when the information is not there" is the failure that costs
money, and a LoCoMo score cannot report it. The vectorize.io article the operator sent is
a vendor comparison — Hindsight is that vendor's own product, and its Zep figure differs
between two of its own pages.

**What this costs us.** Storing transcripts whole is the largest storage commitment the
project has made; content-addressed Storage with per-estate keys is already the shape
`federation.md` §5 names for run artifacts, and the volume becomes a measured retention
decision rather than an assumption. Refusing extraction means memory is only as good as
what someone chose to record, which is a real limitation and the honest one: the
alternative measured worse.

**The failure this is designed against, stated because it is the strongest argument in
the file.** An operator's audit of 10 134 mem0 entries over 32 days found 97.8% unusable
and, among them, **808 copies of a single hallucination** — a fact no human ever asserted,
invented once by a weak model, stored, returned into the next session's context, and
re-extracted from its own output as though it were evidence. Replacing that model with a
much stronger one moved the junk rate from ~98% to 89.6%, because a stronger model follows
the extraction prompt more faithfully and therefore extracts more indiscriminately. There
is no version of this loop that verbatim storage has, because verbatim text is not
re-derived from its own output.

## Reversal condition

A measured retrieval failure on Fabric's own corpus that a derived structure fixes and
verbatim search does not, demonstrated by the fixture decision 5 requires. Absent that
fixture, no evidence can arrive that would justify reversing this, which is the point of
requiring it first.

Contract: brand-contract v1

# Channels

### landing hero

```text
Register: confidence +1, density -1, humor -1
Format: category line, primary positioning, one grounding paragraph, one project-level reframe
Limits: none
Forbidden: physics: none | brand: unsupported scale claims, unpublished components, vague autonomy promises
CTA: optional; verb plus concrete destination
Proof: link to the GitHub organization and current-status section
Locales: Russian may use a longer grounding paragraph
```

### landing body

```text
Register: distance -1, density -1, humor -1
Format: answer first, then system shape, principles and current status
Limits: one idea per section
Forbidden: physics: none | brand: internal roadmap, unpublished product details, unsupported future tense
CTA: optional; one contribution or reading path
Proof: every capability traces to facts.md
Locales: headings answer the reader's question in that language
```

### docs and help

```text
Register: density -1, humor -2, distance -1
Format: summary, concepts in dependency order, worked scenario, next reading path
Limits: ground each term before relying on it
Forbidden: physics: none | brand: promotional filler, hidden prerequisites, claims beyond the current status
CTA: none unless it advances the reader's task
Proof: link to the canonical architecture, ADR or scenario
Locales: translate the job of a heading rather than its words
```

### GitHub organization profile

```text
Register: confidence +1, distance -1, density -1, humor -1
Format: mark, category line, primary positioning, one paragraph, operating-model bullets, repository map
Limits: readable before the first collapsed section; no private repository links presented as public downloads
Forbidden: physics: none | brand: roadmap detail, scale claims, unqualified shipped capability
CTA: one link to passioncode.ai and one repository map
Proof: current-status paragraph and repository descriptions
Locales: English primary
```

### repository README

```text
Register: confidence +1, density 0, humor -2
Format: small mark, product relationship, repository-specific job, status, use/validate path
Limits: category paragraph is shared in meaning, not copied over the repository's technical opening
Forbidden: physics: none | brand: conflating the PassionCode.ai umbrella, Fabric CEO, technical kernel and Switchboard; presenting a contract or adapter as a downloadable product
CTA: concrete documentation or validation path
Proof: repository files and checks
Locales: English primary
```

### social card

```text
Register: confidence +2, density -2, humor -2
Format: mark, product name, primary positioning; category line may appear as a small eyebrow
Limits: 1200×630; no paragraph copy; safe area 64 px minimum
Forbidden: physics: none | brand: secondary slogans competing with the positioning, status claims, tiny technical text
CTA: none
Proof: canonical domain only
Locales: English primary
```

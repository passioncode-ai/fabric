#!/usr/bin/env bash
# Public narrative gate for PassionCode.ai and Fabric.

set -u

NARRATIVE_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
NARRATIVE_FAIL=0
POSITIONING='PassionCode.ai — A toolkit for AI-native teams.'
SLOGAN='Where people and agents run the business together.'
CATEGORY='From vibe coding to passion coding.'
REFRAME='Stop managing agents one by one. Start operating projects.'

narrative_ok() { printf 'ok: %s\n' "$*"; }
narrative_err() { printf 'ERR: %s\n' "$*"; NARRATIVE_FAIL=1; }

REQUIRED_FILES=(
  README.md
  docs/vision.md
  docs/architecture/passioncode-platform.md
  docs/brand/facts.md
  docs/public/organization-profile.md
  docs/guides/passioncode-overview.md
  docs/guides/passioncode-overview.ru.md
)

for NARRATIVE_FILE in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$NARRATIVE_ROOT/$NARRATIVE_FILE" ]; then
    narrative_err "missing narrative surface: $NARRATIVE_FILE"
    continue
  fi
  if ! rg -F -q "$POSITIONING" "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "positioning drift: $NARRATIVE_FILE"
  fi
  if ! rg -F -q "$SLOGAN" "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "slogan drift: $NARRATIVE_FILE"
  fi
  if ! rg -F -q 'Switchboard' "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "missing first-download product: $NARRATIVE_FILE"
  fi
  # Since 0.2.0 (2026-09-29) Fabric is public as an early preview; either qualifier keeps the
  # surface from reading as a finished product.
  if ! rg -q 'in development|early preview|в разработке|ранняя версия' "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "missing Fabric development qualifier: $NARRATIVE_FILE"
  fi
  # ADR-0086 (2026-09-29): "The agent-agnostic operating system for AI-native teams." is a
  # canonical line again, so it is no longer refused here.
done

CATEGORY_FILES=(
  README.md
  docs/vision.md
  docs/architecture/passioncode-platform.md
  docs/brand/facts.md
  docs/public/organization-profile.md
  docs/guides/passioncode-overview.md
)

for NARRATIVE_FILE in "${CATEGORY_FILES[@]}"; do
  if ! rg -F -i -q "$CATEGORY" "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "category drift: $NARRATIVE_FILE"
  fi
done

if ! rg -F -q 'От вайб-кодинга к passion coding.' "$NARRATIVE_ROOT/docs/guides/passioncode-overview.ru.md"; then
  narrative_err "localized category drift: docs/guides/passioncode-overview.ru.md"
fi

REFRAME_FILES=(
  README.md
  docs/vision.md
  docs/brand/facts.md
  docs/public/organization-profile.md
)

for NARRATIVE_FILE in "${REFRAME_FILES[@]}"; do
  if ! rg -F -i -q "$REFRAME" "$NARRATIVE_ROOT/$NARRATIVE_FILE"; then
    narrative_err "operating reframe drift: $NARRATIVE_FILE"
  fi
done

# ADR-0090 (2026-09-29): PassionCode.ai is the organization; Fabric is the product and CEO agent;
# Fabric's tools carry its name. The retired framing is refused on every surface that defines
# the names. Dated records (history tables, docs/audit, dated plans) keep the wording of their day.
NAMING_FILES=(
  README.md
  CONTEXT.md
  package.json
  docs/vision.md
  docs/architecture/passioncode-platform.md
  docs/brand/facts.md
  docs/brand/voice.md
  docs/brand/terminology.md
  docs/public/organization-profile.md
  docs/guides/passioncode-overview.md
  docs/guides/passioncode-overview.ru.md
)
NAMING_RETIRED='PassionCode\.ai (is|stays) the (user-facing )?product|powered by Fabric|kernel behind PassionCode|Fabric organi[sz]ation|PassionCode\.ai(\*\*)? (is|—|-) (the |an )?umbrella toolkit'
for NARRATIVE_FILE in "${NAMING_FILES[@]}"; do
  [ -f "$NARRATIVE_ROOT/$NARRATIVE_FILE" ] || continue
  if rg -n -i "$NAMING_RETIRED" "$NARRATIVE_ROOT/$NARRATIVE_FILE" | rg -v '^[0-9]+:\| 20[0-9]{2}-[0-9]{2}-[0-9]{2} \|'; then
    narrative_err "retired naming (ADR-0090): $NARRATIVE_FILE"
  fi
done
# ADR-0092: every repository is AGPL-3.0-only OR commercial. A current version is never called
# source-available or PolyForm; a line that says which EARLIER versions were released under
# PolyForm or MIT is history and stays, as do dated history-table rows.
LICENCE_RETIRED='source-available|PolyForm'
LICENCE_HISTORY='released under|were released|releases already published|versions? before|earlier versions|выпущен[а-я]* под'
for NARRATIVE_FILE in "${NAMING_FILES[@]}"; do
  [ -f "$NARRATIVE_ROOT/$NARRATIVE_FILE" ] || continue
  if rg -n -i "$LICENCE_RETIRED" "$NARRATIVE_ROOT/$NARRATIVE_FILE" | rg -v '^[0-9]+:\| 20[0-9]{2}-[0-9]{2}-[0-9]{2} \|' | rg -v -i "$LICENCE_HISTORY" | rg -v 'adr/0086-positioning-names-teams-and-the-public-tools-are-source-available'; then
    narrative_err "retired licence wording (ADR-0092): $NARRATIVE_FILE"
  fi
done
if ! rg -q 'PassionCode\.ai\*\* — the organization|PassionCode\.ai is the organization' "$NARRATIVE_ROOT/CONTEXT.md"; then
  narrative_err "the glossary does not define PassionCode.ai as the organization (ADR-0090): CONTEXT.md"
fi

PUBLIC_FILES=(
  "$NARRATIVE_ROOT/README.md"
  "$NARRATIVE_ROOT/docs/public/organization-profile.md"
  "$NARRATIVE_ROOT/docs/guides/passioncode-overview.md"
  "$NARRATIVE_ROOT/docs/guides/passioncode-overview.ru.md"
)

if rg -n -i \
  'monetiz|subscription|pricing|billing|revenue|payout|paid plan|монетизац|подписк|тариф|биллинг|выручк|выплат' \
  "${PUBLIC_FILES[@]}"; then
  narrative_err "internal product-economics language reached a public surface"
else
  narrative_ok "public surfaces contain no internal product-economics language"
fi

if rg -n -i 'Passion Code|patient code' "${PUBLIC_FILES[@]}"; then
  narrative_err "retired product spelling reached a public surface"
else
  narrative_ok "public product spelling is consistent"
fi

if [ "$NARRATIVE_FAIL" -eq 0 ]; then
  narrative_ok "toolkit positioning, product readiness, category and slogan match across ${#REQUIRED_FILES[@]} surfaces"
  echo "PASS: PassionCode.ai public narrative"
  exit 0
fi

echo "FAIL: PassionCode.ai public narrative"
exit 1

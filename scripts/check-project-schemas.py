#!/usr/bin/env python3
"""Validate the explanatory project schemas and examples."""

from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any, Iterable

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:
    print("ERROR: install jsonschema>=4.18 to validate Draft 2020-12 examples", file=sys.stderr)
    raise SystemExit(2)


ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas"
ROUTES = {
    "portfolio-observer.project.json": "project-blueprint.schema.json",
    "product.project.json": "project-blueprint.schema.json",
    "estate-dashboard.json": "project-dashboard.schema.json",
    "cross-project.proposal.json": "proposal.schema.json",
}
SECRET_KEYS = {"password", "apikey", "accessToken", "refreshToken", "clientSecret", "privateKey", "cookie"}


def walk(value: Any, path: str = "$") -> Iterable[tuple[str, str]]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield path, key
            yield from walk(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}[{index}]")


def secret_fields(value: Any) -> list[str]:
    found: list[str] = []
    for location, key in walk(value):
        normalized = key.replace("_", "").replace("-", "").lower()
        if any(secret.lower() == normalized for secret in SECRET_KEYS):
            found.append(f"{location}.{key}")
    return found


def main() -> int:
    errors: list[str] = []
    validators: dict[str, Draft202012Validator] = {}
    for schema_name in sorted(set(ROUTES.values())):
        path = SCHEMAS / schema_name
        schema = json.loads(path.read_text(encoding="utf-8"))
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:
            errors.append(f"{schema_name}: invalid schema: {exc}")
            continue
        validators[schema_name] = Draft202012Validator(schema, format_checker=FormatChecker())

    for example_name, schema_name in ROUTES.items():
        path = SCHEMAS / "examples" / example_name
        value = json.loads(path.read_text(encoding="utf-8"))
        validator = validators.get(schema_name)
        if validator is None:
            continue
        for error in sorted(validator.iter_errors(value), key=lambda item: list(item.path)):
            location = ".".join(str(part) for part in error.path) or "$"
            errors.append(f"{example_name}:{location}: {error.message}")
        for location in secret_fields(value):
            errors.append(f"{example_name}:{location}: secret-like field is forbidden")

        if example_name.endswith(".project.json"):
            agent_ids = [item["id"] for item in value["agentBindings"]]
            if len(agent_ids) != len(set(agent_ids)):
                errors.append(f"{example_name}: duplicate agent binding id")
            manager_id = value["manager"]["agentBindingId"]
            manager_rows = [item for item in value["agentBindings"] if item["id"] == manager_id and item["role"] == "product-manager"]
            if len(manager_rows) != 1:
                errors.append(f"{example_name}: manager must resolve to exactly one product-manager binding")
            for binding in value["connectionBindings"]:
                unknown = sorted(set(binding["allowedAgentBindingIds"]) - set(agent_ids))
                if unknown:
                    errors.append(f"{example_name}: connection binding references unknown agents: {unknown}")
            for routine in value["routines"]:
                if routine["preferredAgentBindingId"] not in agent_ids:
                    errors.append(f"{example_name}: routine {routine['id']} references an unknown agent")
        elif example_name.endswith(".proposal.json"):
            proposal = value["proposal"]
            if proposal["sourceProjectRef"] == proposal["targetProjectRef"]:
                errors.append(f"{example_name}: cross-project proposal must name different source and target projects")

    # Negative probes are deliberately invalid in-memory fixtures. They make a green
    # result mean the checker was also observed rejecting each load-bearing boundary.
    negative_probes = [
        ("project-without-manager", "project-blueprint.schema.json", "portfolio-observer.project.json", ("manager",)),
        ("dashboard-without-projects", "project-dashboard.schema.json", "estate-dashboard.json", ("projects",)),
        ("accepted-proposal-without-resolution", "proposal.schema.json", "cross-project.proposal.json", ("proposal", "status")),
    ]
    for probe_name, schema_name, example_name, path_parts in negative_probes:
        value = json.loads((SCHEMAS / "examples" / example_name).read_text(encoding="utf-8"))
        cursor = value
        for part in path_parts[:-1]:
            cursor = cursor[part]
        leaf = path_parts[-1]
        if probe_name == "accepted-proposal-without-resolution":
            cursor[leaf] = "accepted"
        else:
            cursor.pop(leaf)
        if not list(validators[schema_name].iter_errors(value)):
            errors.append(f"negative probe {probe_name!r} was incorrectly accepted")

    if not secret_fields({"connection": {"accessToken": "must-never-appear"}}):
        errors.append("negative probe 'embedded-secret' was incorrectly accepted")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(
        f"OK: {len(validators)} schemas and {len(ROUTES)} examples are valid; "
        f"{len(negative_probes) + 1} invalid boundary probes were rejected"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

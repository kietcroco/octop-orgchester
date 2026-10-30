"""Seed the chat provider from `.claude/settings.json` (or env vars) into Octop.

Idempotent: matching by provider name, it patches the existing row instead of
creating a duplicate. Only the listed model ids are enabled; every other entry
in ``models_json`` keeps whatever state it already had.

    python scripts/seed_provider.py                 # uses ~/.octop (or OCTOP_HOME)
    python scripts/seed_provider.py --home /data/.octop

Env overrides (take precedence over the settings file, so the token never has to
be committed anywhere):

    OCTOP_SEED_PROVIDER    provider name      (default: deepseek-v4)
    OCTOP_SEED_KIND        openai | anthropic (default: openai)
    OCTOP_SEED_BASE_URL    e.g. http://host:20128/v1
    OCTOP_SEED_API_KEY     bearer token
    OCTOP_SEED_MODELS      comma-separated model ids
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

from octop.cli.support.db import open_cli_services
from octop.infra.utils.paths import PathLayout

def _settings_path() -> pathlib.Path | None:
    """Nearest `.claude/settings.json` walking up from this script, if any.

    Lazily resolved: the script is often copied to /tmp (or into a container)
    where no such file exists, so the env overrides have to stand alone.
    """
    override = os.environ.get("OCTOP_SEED_SETTINGS")
    if override:
        return pathlib.Path(override)
    for parent in pathlib.Path(__file__).resolve().parents:
        candidate = parent / ".claude" / "settings.json"
        if candidate.is_file():
            return candidate
    return None


def _settings_env() -> dict[str, str]:
    path = _settings_path()
    if path is None:
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    env = data.get("env")
    return {str(k): str(v) for k, v in env.items()} if isinstance(env, dict) else {}


def _resolve() -> dict[str, object]:
    env = _settings_env()

    def pick(override: str, from_settings: str, default: str) -> str:
        return os.environ.get(override) or env.get(from_settings) or default

    base_url = pick("OCTOP_SEED_BASE_URL", "ANTHROPIC_BASE_URL", "")
    api_key = pick("OCTOP_SEED_API_KEY", "ANTHROPIC_AUTH_TOKEN", "")
    models_raw = (
        os.environ.get("OCTOP_SEED_MODELS")
        or env.get("ANTHROPIC_DEFAULT_SONNET_MODEL")
        or ""
    )
    models = [m.strip() for m in models_raw.split(",") if m.strip()]
    if not os.environ.get("OCTOP_SEED_MODELS"):
        # The settings file names one id per tier; seed every distinct one.
        for key in ("ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_FABLE_MODEL",
                    "ANTHROPIC_DEFAULT_HAIKU_MODEL"):
            value = env.get(key, "").strip()
            if value and value not in models:
                models.append(value)
    return {
        "name": os.environ.get("OCTOP_SEED_PROVIDER") or "deepseek-v4",
        "kind": os.environ.get("OCTOP_SEED_KIND") or "openai",
        "base_url": base_url,
        "api_key": api_key,
        "models": models,
    }


def _is_loopback(url: str) -> bool:
    host = url.split("//", 1)[-1].split("/", 1)[0].rsplit(":", 1)[0]
    return host in ("127.0.0.1", "localhost", "::1", "0.0.0.0")


def _enable(models: list[dict[str, object]], wanted: list[str]) -> tuple[list[dict], int]:
    """Turn on the wanted ids, add a stub for any id missing, leave the rest alone."""
    out: list[dict[str, object]] = []
    changed = 0
    seen: set[str] = set()
    for model in models:
        mid = str(model.get("id") or "")
        seen.add(mid)
        if mid in wanted and not model.get("enabled", True):
            out.append({**model, "enabled": True})
            changed += 1
        else:
            out.append(model)
    for mid in wanted:
        if mid in seen:
            continue
        out.append(
            {"id": mid, "name": mid, "enabled": True, "input": ["text"], "thinking": None}
        )
        changed += 1
    return out, changed


def seed(home: pathlib.Path | None, *, dry_run: bool = False) -> int:
    spec = _resolve()
    if not spec["base_url"] or not spec["api_key"] or not spec["models"]:
        print(
            "missing configuration: need base_url, api_key and at least one model "
            "(env or .claude/settings.json)",
            file=sys.stderr,
        )
        return 2

    with open_cli_services(home) as services:
        repo = services.provider_repo
        row = repo.get_by_name(str(spec["name"]))
        if _is_loopback(str(spec["base_url"])):
            print(
                f"warning: {spec['base_url']} is loopback — unreachable from inside a "
                "container; override with OCTOP_SEED_BASE_URL=",
                file=sys.stderr,
            )
        if row is None:
            print(f"create provider {spec['name']} kind={spec['kind']} {spec['base_url']}")
            if not dry_run:
                repo.create(
                    name=str(spec["name"]),
                    kind=str(spec["kind"]),
                    base_url=str(spec["base_url"]),
                    api_key=str(spec["api_key"]),
                    extra_json=json.dumps({"purpose": "chat"}),
                    models_json=json.dumps(
                        [
                            {"id": m, "name": m, "enabled": True, "input": ["text"],
                             "thinking": None}
                            for m in spec["models"]
                        ]
                    ),
                    note="seeded from .claude/settings.json",
                )
            return 0

        models, changed = _enable(
            row.get_models(), [str(m) for m in spec["models"]]  # type: ignore[arg-type]
        )
        print(
            f"update provider {row.name} id={row.id}: {changed} model(s) enabled, "
            f"base_url={spec['base_url']}"
        )
        for model_id in spec["models"]:
            print(f"  enabled {model_id}")
        if not dry_run:
            repo.update(
                row.id,
                kind=str(spec["kind"]),
                base_url=str(spec["base_url"]),
                api_key=str(spec["api_key"]),
                models_json=json.dumps(models),
                enabled=True,
            )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--home", type=pathlib.Path, default=None, help="Octop home dir")
    parser.add_argument("--dry-run", action="store_true", help="print, change nothing")
    args = parser.parse_args()
    if args.home is None:
        args.home = PathLayout.from_env().root
    return seed(args.home, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())

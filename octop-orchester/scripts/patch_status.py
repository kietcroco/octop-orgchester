"""Patch staleness checker — is each patch still valid against the octop submodule?

    python octop-orchester/scripts/patch_status.py              # check (default)
    python octop-orchester/scripts/patch_status.py --record     # (re)write lock.json
    python octop-orchester/scripts/patch_status.py --apply-check  # real git apply --check
    python octop-orchester/scripts/patch_status.py --collisions    # src/ vs upstream

Why this exists: ``git apply`` only tells you a patch broke. It cannot tell you a
patch went **stale but still applies** — upstream reindented the anchor, our hunk
matched by context anyway, and the result is subtly wrong. Comparing the sha256 of
every target file catches that before the build runs.

``--record`` is the only writer: it exports ``octop/`` at its current HEAD, applies
every patch in sorted order, and stores both the pre-image (upstream) and
post-image (patched) sha256 per file in ``patches/lock.json``. The patch -> file
mapping is read from the ``diff --git`` lines, NOT from ``manifest.yaml``, so the
two cannot drift apart.

Stdlib only. Needs a clean ``octop/`` for ``--record`` and ``--apply-check``.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]  # octop-orchester/
OCTOP = ROOT.parent / "octop"
PATCHES = ROOT / "patches"
LOCK = PATCHES / "lock.json"
OVERLAY_SRC = ROOT / "src"


def git(*args: str, cwd: pathlib.Path = OCTOP) -> str:
    return subprocess.run(
        ["git", "-C", str(cwd), *args], capture_output=True, check=True
    ).stdout.decode("utf-8", "replace")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def patch_files() -> dict[str, dict]:
    """patch id -> {path on disk, target paths, per-patch-file targets}.

    Derived from the patch bodies: ``diff --git a/<p> b/<p>`` is the authoritative
    list of what a patch touches, so a hand-maintained manifest cannot fall behind.
    ``pairs`` keeps the per-file mapping because a patch path is not always a
    suffix of its target (``dashboard-pkg/dashboard/package.json`` patches
    ``dashboard/package.json`` — the prefix names the Docker build stage, not the
    octop path).
    """
    out: dict[str, dict] = {}
    for p in sorted(PATCHES.rglob("*.patch")):
        pid = p.name.rsplit(".", 2)[-2]  # <target>.<patch-id>.patch
        rel = str(p.relative_to(PATCHES)).replace("\\", "/")
        targets = []
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("diff --git "):
                parts = line.split()
                if len(parts) >= 4:
                    targets.append(parts[3].removeprefix("b/"))
        entry = out.setdefault(pid, {"paths": [], "targets": [], "pairs": {}})
        entry["paths"].append(rel)
        entry["targets"].extend(targets)
        entry["pairs"][rel] = targets
    for entry in out.values():
        entry["targets"] = sorted(set(entry["targets"]))
    return out


def export(ref: str, dest: pathlib.Path) -> None:
    """Extract octop at ``ref`` into ``dest`` (git init'd so git apply works)."""
    blob = subprocess.run(
        ["git", "-C", str(OCTOP), "archive", ref], capture_output=True, check=True
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:") as tf:
        # filter="data" only exists on 3.12+; the layout is our own git archive.
        if hasattr(tarfile, "data_filter"):
            tf.extractall(dest, filter="data")
        else:
            tf.extractall(dest)
    subprocess.run(["git", "init", "-q", str(dest)], check=True)


def apply_all(dest: pathlib.Path) -> list[str]:
    failures = []
    for p in sorted(PATCHES.rglob("*.patch")):
        r = subprocess.run(
            ["git", "-C", str(dest), "apply", "--whitespace=nowarn", str(p)],
            capture_output=True,
        )
        if r.returncode != 0:
            failures.append(f"{p.relative_to(PATCHES)}: {r.stderr.decode().strip()}")
    return failures


def record() -> int:
    dirty = git("status", "--porcelain").strip()
    if dirty:
        print("octop/ has uncommitted changes; --record needs a clean tree:")
        print(dirty)
        return 2
    ref = git("rev-parse", "HEAD").strip()
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        export(ref, tmp)
        before = {
            t: sha256_file(tmp / t)
            for entry in patch_files().values()
            for t in entry["targets"]
            if (tmp / t).exists()
        }
        failures = apply_all(tmp)
        if failures:
            print("cannot record: patches do not apply at", ref[:12])
            for f in failures:
                print("  ", f)
            return 1
        lock = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "base_commit": ref,
            "base_describe": git("describe", "--tags", ref).strip(),
            "patches": {},
            "adds": {},
        }
        for pid, entry in patch_files().items():
            files = {}
            for t in entry["targets"]:
                files[t] = {
                    "upstream_sha256": before.get(t, ""),
                    "patched_sha256": sha256_file(tmp / t) if (tmp / t).exists() else "",
                }
            lock["patches"][pid] = {"paths": entry["paths"], "files": files}
        for f in sorted(OVERLAY_SRC.rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts:
                lock["adds"][str(f.relative_to(OVERLAY_SRC)).replace("\\", "/")] = sha256_file(f)
    LOCK.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {LOCK.relative_to(ROOT)}: base {ref[:12]}, "
          f"{len(lock['patches'])} patches, "
          f"{sum(len(v['files']) for v in lock['patches'].values())} files, "
          f"{len(lock['adds'])} added files")
    return 0


def octop_sha256(rel: str) -> str:
    """Content hash of a file in the octop working tree (empty when absent)."""
    f = OCTOP / rel
    return sha256_file(f) if f.is_file() else ""


def check() -> int:
    if not LOCK.is_file():
        print(f"no {LOCK.relative_to(ROOT)} — run --record first")
        return 2
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    head = git("rev-parse", "HEAD").strip()
    base = lock["base_commit"]
    print(f"recorded base : {base[:12]}  {lock['base_describe']}")
    print(f"octop/ HEAD   : {head[:12]}  {git('describe', '--tags', head).strip()}")
    if head == base:
        print("base matches: no upstream movement")
    else:
        print("!! octop/ moved — every patch below needs a rebase review")
    dirty = git("status", "--porcelain").strip()
    if dirty:
        print("!! octop/ working tree is dirty; patch results would be double-applied")

    stale = 0
    for pid, entry in sorted(lock["patches"].items()):
        changed = []
        for rel, hashes in sorted(entry["files"].items()):
            now = octop_sha256(rel)
            if now != hashes["upstream_sha256"]:
                changed.append(rel)
        if changed:
            stale += 1
            print(f"\nSTALE  {pid}")
            for rel in changed:
                print(f"   changed upstream: {rel}")
            # Files a patch owns that upstream moved are exactly the rebase worklist.
            print(f"   patches to review: {', '.join(entry['paths'])}")
        else:
            print(f"ok     {pid}  ({len(entry['files'])} files)")

    drifted = []
    for rel, want in sorted(lock["adds"].items()):
        got = sha256_file(OVERLAY_SRC / rel) if (OVERLAY_SRC / rel).is_file() else ""
        if got != want:
            drifted.append(rel)
    if drifted:
        print(f"\n!! {len(drifted)} overlay file(s) changed since --record "
              f"(re-record if intentional):")
        for rel in drifted:
            print("   ", rel)

    print(f"\n{stale} patch(es) stale, {len(drifted)} overlay file(s) drifted")
    return 1 if (stale or drifted or head != base) else 0


def apply_check() -> int:
    dirty = git("status", "--porcelain").strip()
    if dirty:
        print("octop/ is dirty; refusing to apply-check against a mixed tree")
        return 2
    head = git("rev-parse", "HEAD").strip()
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        export(head, tmp)
        failures = apply_all(tmp)
    if not failures:
        print(f"all patches apply cleanly at {head[:12]}")
        return 0
    print(f"{len(failures)} patch(es) do not apply at {head[:12]}:")
    for f in failures:
        print("  ", f)
    return 1


def collisions() -> int:
    """Overlay files that would silently overwrite a file upstream now owns."""
    hits = 0
    for f in sorted(OVERLAY_SRC.rglob("*")):
        if not f.is_file() or "__pycache__" in f.parts:
            continue
        rel = str(f.relative_to(OVERLAY_SRC)).replace("\\", "/")
        if (OCTOP / rel).exists():
            hits += 1
            print(f"COLLISION  {rel}  (already exists upstream — COPY would overwrite it)")
    print(f"{hits} collision(s) between octop-orchester/src/ and octop/")
    return 1 if hits else 0


def repo(*args: str) -> str:
    """git in the octop-orchester repo (patches live there, not in octop/)."""
    return subprocess.run(
        ["git", "-C", str(ROOT.parent), *args], capture_output=True
    ).stdout.decode("utf-8", "replace")


def history() -> int:
    """patch id -> human commits that introduced/changed it, straight from git.

    Never cached on purpose: a stored copy would go stale the moment a patch is
    recommitted, which is exactly when this table matters most.
    """
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.is_file() else None
    base = lock["base_commit"][:12] if lock else "(no lock.json)"
    print(f"{'patch':12s} {'hunks':>5s}  {'octop base':12s}  introducing commits")
    for pid, entry in sorted(patch_files().items()):
        hunks = sum(
            len([ln for ln in (PATCHES / p).read_text(encoding="utf-8",
                errors="replace").splitlines() if ln.startswith("@@")])
            for p in entry["paths"]
        )
        log = repo("log", "--oneline", "--", *entry["paths"]).strip().splitlines()
        origin = ", ".join(ln.split()[0] for ln in log) or "UNCOMMITTED"
        print(f"{pid:12s} {hunks:5d}  {base:12s}  {origin}")
    print(f"\n{len(patch_files())} patch id(s); "
          f"{len(list(PATCHES.rglob('*.patch')))} patch file(s)")
    untracked = repo("status", "--porcelain", "--", str(PATCHES)).strip()
    if untracked:
        print("patches not yet committed (origin shows UNCOMMITTED):")
        for ln in untracked.splitlines():
            print("  ", ln)
    return 0


def report() -> int:
    """Rewrite the generated block in docs/00-PATCH-REGISTRY.md from lock.json."""
    if not LOCK.is_file():
        print(f"no {LOCK.relative_to(ROOT)} — run --record first")
        return 2
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    doc = ROOT / "docs" / "00-PATCH-REGISTRY.md"
    if not doc.is_file():
        print(f"no {doc.relative_to(ROOT)}")
        return 2

    rows = ["<!-- generated by scripts/patch_status.py --report; do not edit by hand -->",
            "",
            f"Base: `{lock['base_commit']}` ({lock['base_describe']}) — "
            f"recorded {lock['generated_at']}",
            "",
            "| # | Patch id | Patch file | Target file | Upstream sha256 (12) | Commit |",
            "|---|---|---|---|---|---|"]
    n = 0
    pairs = {pid: e["pairs"] for pid, e in patch_files().items()}
    for pid, entry in sorted(lock["patches"].items()):
        # Which patch file owns which target. The filename is not always a suffix
        # of the target (dashboard-pkg/ patches dashboard/package.json), so the
        # `diff --git` line is the only safe source.
        owner = {}
        for pf, targets in pairs.get(pid, {}).items():
            for t in targets:
                owner.setdefault(t, pf)
        # The commit that last touched the patch file: the answer to "which round
        # of work does this patch belong to". Recomputed every run, never cached.
        commits = {
            pf: (repo("log", "-1", "--format=%h", "--", str(PATCHES / pf)).strip()
                 or "uncommitted")
            for pf in pairs.get(pid, {})
        }
        for rel, hashes in sorted(entry["files"].items()):
            n += 1
            pf = owner.get(rel, "?")
            rows.append(
                f"| {n} | `{pid}` | `{pf}` | `{rel}` | "
                f"`{hashes['upstream_sha256'][:12]}` | `{commits.get(pf, '?')}` |"
            )
    rows.append("")
    rows.append(f"{n} patched file(s) across {len(lock['patches'])} patch id(s); "
                f"{len(lock['adds'])} overlay file(s) added by `src/`.")
    block = "\n".join(rows)

    text = doc.read_text(encoding="utf-8")
    begin, end = "<!-- BEGIN GENERATED -->", "<!-- END GENERATED -->"
    if begin not in text or end not in text:
        print(f"markers {begin} / {end} not found in {doc.name}")
        return 2
    head, rest = text.split(begin, 1)
    _, tail = rest.split(end, 1)
    doc.write_text(f"{head}{begin}\n{block}\n{end}{tail}", encoding="utf-8")
    print(f"updated {doc.relative_to(ROOT)} ({n} rows)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--record", action="store_true", help="rewrite patches/lock.json")
    g.add_argument("--apply-check", action="store_true", help="real git apply --check at HEAD")
    g.add_argument("--collisions", action="store_true", help="src/ files that shadow upstream")
    g.add_argument("--history", action="store_true", help="patch id -> introducing commits")
    g.add_argument("--report", action="store_true", help="regenerate docs/00-PATCH-REGISTRY.md")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not OCTOP.is_dir():
        print(f"octop submodule not found at {OCTOP}")
        return 2
    if args.record:
        return record()
    if args.apply_check:
        return apply_check()
    if args.collisions:
        return collisions()
    if args.history:
        return history()
    if args.report:
        return report()
    return check()


if __name__ == "__main__":
    sys.exit(main())

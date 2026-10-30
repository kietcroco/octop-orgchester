"""Regenerate the workflow-ui locale patches (en.json / zh.json) and vi.json.

The patches always carry the WHOLE flows copy from add_flows_i18n.py, so every
change to that copy means regenerating them. This does it in one go:

  1. scratch worktree of octop at its checked-out commit (submodule stays clean)
  2. apply every existing dashboard/src patch EXCEPT the workflow-ui locale ones
  3. run add_flows_i18n.py against it (writes en/zh there, rewrites vi.json here)
  4. git diff each locale file into patches/dashboard/src/locales/*.workflow-ui.patch
  5. drop the worktree

    python octop-orchester/scripts/regen_flows_locale_patches.py
"""
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OCTOP = ROOT / "octop"
PATCHES = ROOT / "octop-orchester" / "patches"
LOCALES = ("en.json", "zh.json")
SKIP = {f"{name}.workflow-ui.patch" for name in LOCALES}


def git(*args: str, cwd: pathlib.Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if git("status", "--short", cwd=OCTOP).stdout.strip():
        print("octop/ is dirty; refusing to run", file=sys.stderr)
        return 1

    wt = pathlib.Path(tempfile.mkdtemp(prefix="octo-flows-wt-"))
    added = git("-c", "core.autocrlf=false", "worktree", "add", "--detach", str(wt), "HEAD", cwd=OCTOP)
    if added.returncode != 0:
        print(added.stderr, file=sys.stderr)
        return 1
    try:
        patches = sorted(
            p for sub in ("dashboard", "src") for p in (PATCHES / sub).rglob("*.patch") if p.name not in SKIP
        )
        for patch in patches:
            applied = git("apply", "--whitespace=nowarn", str(patch), cwd=wt)
            if applied.returncode != 0:
                print(f"FAILED to apply {patch}:\n{applied.stderr}", file=sys.stderr)
                return 1
        git("add", "-A", cwd=wt)

        script = ROOT / "octop-orchester" / "scripts" / "add_flows_i18n.py"
        ran = subprocess.run(
            [sys.executable, str(script), "--octop-dir", str(wt)], capture_output=True, text=True, encoding="utf-8"
        )
        print(ran.stdout.strip())
        if ran.returncode != 0:
            print(ran.stderr, file=sys.stderr)
            return 1

        for name in LOCALES:
            diff = git("diff", "--", f"dashboard/src/locales/{name}", cwd=wt).stdout
            if "diff --git" not in diff:
                print(f"no diff produced for {name}", file=sys.stderr)
                return 1
            out = PATCHES / "dashboard/src/locales" / f"{name}.workflow-ui.patch"
            out.write_bytes(diff.encode("utf-8"))
            print(f"wrote {out.relative_to(ROOT)} ({diff.count(chr(10))} lines)")
        return 0
    finally:
        git("worktree", "remove", "--force", str(wt), cwd=OCTOP)
        git("worktree", "prune", cwd=OCTOP)


if __name__ == "__main__":
    sys.exit(main())

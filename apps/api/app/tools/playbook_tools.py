"""Local file-based clash playbook discovery and reading tools."""

from __future__ import annotations

import re
from pathlib import Path

from llama_index.core.tools import FunctionTool
from pydantic import BaseModel, Field

# apps/api/app/tools/playbook_tools.py -> parents[2] == apps/api
PLAYBOOKS_ROOT = (Path(__file__).resolve().parents[2] / "skills" / "playbooks").resolve()

_FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# Avoid blowing LLM context if a playbook grows unexpectedly large.
MAX_PLAYBOOK_BYTES = 64 * 1024


def _parse_frontmatter(text: str) -> dict[str, str]:
    """Tiny YAML subset: top-level `key: value` lines.

    Dependency-free (no PyYAML). List/array values are kept as one-line strings.
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    out: dict[str, str] = {}
    for line in m.group(1).splitlines():
        stripped = line.lstrip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip().strip("\"'")
    return out


def _category_summary(cat_dir: Path) -> str | None:
    readme = cat_dir / "README.md"
    if not readme.is_file():
        return None
    body = readme.read_text(encoding="utf-8").strip()
    if not body:
        return None
    first_para = body.split("\n\n", 1)[0]
    return first_para.replace("\n", " ").strip()


def _sanitize_segment(part: str) -> bool:
    if not part or ".." in part:
        return False
    if "/" in part or "\\" in part:
        return False
    if "\x00" in part:
        return False
    return True


def _resolve_category_dir(category: str) -> Path | None:
    """Return the category directory, case-insensitive match on name."""
    if not _sanitize_segment(category):
        return None
    want = category.strip().casefold()
    if not PLAYBOOKS_ROOT.is_dir():
        return None
    for p in PLAYBOOKS_ROOT.iterdir():
        if p.is_dir() and p.name.casefold() == want:
            return p
    return None


def _resolve_playbook_file(cat_dir: Path, filename: str) -> Path | None:
    """Return the playbook file path, case-insensitive match on filename."""
    if not _sanitize_segment(filename):
        return None
    name = filename.strip()
    if not name.lower().endswith(".md"):
        return None
    want = name.casefold()
    for f in cat_dir.iterdir():
        if f.is_file() and f.name.casefold() == want:
            return f
    return None


def get_playbook_directory() -> str:
    """Return a Markdown index of trade categories and playbooks with summaries.

    Use this FIRST to discover the correct `category` and `filename` for a clash,
    then call `read_clash_playbook` with those exact values (case-insensitive).
    """
    if not PLAYBOOKS_ROOT.is_dir():
        return "# Clash Playbook Index\n\n_No playbooks available._\n"

    lines: list[str] = ["# Clash Playbook Index", ""]
    for cat in sorted(p for p in PLAYBOOKS_ROOT.iterdir() if p.is_dir()):
        lines.append(f"## {cat.name}")
        summary = _category_summary(cat)
        if summary:
            lines.append(f"_{summary}_")
        lines.append("")
        playbooks = sorted(
            f
            for f in cat.iterdir()
            if f.is_file() and f.suffix == ".md" and f.name != "README.md"
        )
        if not playbooks:
            lines.append("_(no playbooks yet)_")
            lines.append("")
            continue
        for pb in playbooks:
            raw = pb.read_text(encoding="utf-8")
            fm = _parse_frontmatter(raw)
            title = fm.get("title", pb.stem.replace("_", " "))
            applies = fm.get("applies_when", "")
            severity = fm.get("severity_default", "")
            elements = fm.get("elements", "")
            sev = f" _(default severity: {severity})_" if severity else ""
            lines.append(f"- **{pb.name}** — {title}.{sev}")
            if elements:
                lines.append(f"  - Elements: {elements}")
            if applies:
                lines.append(f"  - Applies when: {applies}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


class ReadPlaybookArgs(BaseModel):
    category: str = Field(..., description="Top-level folder, e.g. Structural_x_MEP")
    filename: str = Field(..., description="File name, e.g. Primary_Beam_x_HVAC_Main_Duct.md")


def read_clash_playbook(category: str, filename: str) -> str:
    """Read a specific playbook's full Markdown (including frontmatter)."""
    for part in (category, filename):
        if not _sanitize_segment(part):
            return (
                "Invalid argument. Use get_playbook_directory() to list valid entries."
            )

    if not filename.strip().lower().endswith(".md"):
        return "Filename must end with .md."

    cat_dir = _resolve_category_dir(category)
    if cat_dir is None:
        return "File not found. Check directory using get_playbook_directory()."

    pb = _resolve_playbook_file(cat_dir, filename)
    if pb is None:
        return "File not found. Check directory using get_playbook_directory()."

    resolved = pb.resolve()
    if not resolved.is_relative_to(PLAYBOOKS_ROOT):
        return "Invalid path."

    try:
        data = resolved.read_bytes()
    except OSError:
        return "File not found. Check directory using get_playbook_directory()."

    if len(data) > MAX_PLAYBOOK_BYTES:
        truncated = data[:MAX_PLAYBOOK_BYTES].decode("utf-8", errors="replace")
        return (
            f"{truncated}\n\n---\n"
            f"_[Truncated: file exceeds {MAX_PLAYBOOK_BYTES} bytes.]_"
        )

    return data.decode("utf-8")


def playbook_tool_list() -> list[FunctionTool]:
    return [
        FunctionTool.from_defaults(get_playbook_directory),
        FunctionTool.from_defaults(read_clash_playbook, fn_schema=ReadPlaybookArgs),
    ]

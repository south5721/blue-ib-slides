#!/usr/bin/env python3
"""Public 4.4 regressions for divider text and compatibility-tool safety."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
NODE = os.environ.get("BLUE_IB_NODE") or shutil.which("node")
if not NODE:
    raise SystemExit("Node required")

spec = importlib.util.spec_from_file_location("content44", SCRIPTS / "check-content.py")
content = importlib.util.module_from_spec(spec)
spec.loader.exec_module(content)
checks = []


def ok(name, value):
    if not value:
        raise AssertionError(name)
    checks.append(name)


deck = {
    "title": "4.4 分隔页回归",
    "designSystem": "blue-editorial",
    "slides": [{
        "layout": "divider",
        "number": "01",
        "title": "战略方向",
        "subtitle": "面向新发展阶段，增强专业经营能力"
    }]
}
with tempfile.TemporaryDirectory(prefix="blue-ib-44-") as tmp:
    tmp = Path(tmp)
    source = tmp / "divider.json"
    output = tmp / "divider.pptx"
    source.write_text(json.dumps(deck, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(
        [NODE, str(SCRIPTS / "generate-pptx.mjs"), str(source), str(output)],
        capture_output=True,
        text=True,
        env={**os.environ, "BLUE_IB_PYTHON": sys.executable},
    )
    ok("Divider with subtitle generates", result.returncode == 0)
    if result.returncode:
        raise AssertionError(result.stderr)
    layout = json.loads(Path(str(output) + ".layout.json").read_text(encoding="utf-8"))
    subtitles = [o for o in layout["pages"][0]["objects"] if o["id"] == "section-subtitle"]
    ok("Divider subtitle is emitted exactly once", len(subtitles) == 1 and subtitles[0]["text"] == deck["slides"][0]["subtitle"])
    ok("Divider declared text is complete", content.check(deck, output)["ok"])

    retired = subprocess.run(
        [NODE, str(SCRIPTS / "pptd2pptx.mjs")],
        capture_output=True,
        text=True,
        env={**os.environ, "BLUE_IB_PYTHON": sys.executable},
    )
    ok("Legacy remote export remains retired", retired.returncode == 2 and "No credentials are read" in retired.stderr)

render_source = (SCRIPTS / "render-truth-scan.mjs").read_text(encoding="utf-8")
ok("PowerPoint QA never kills the application", "pkill" not in render_source and "quit saving no" not in render_source)
ok("PowerPoint QA supports a controlled PDF directory", "RENDER_TRUTH_PDF_DIR" in render_source)
frontmatter = (ROOT / "SKILL.md").read_text(encoding="utf-8").split("---", 2)[1]
keys = [line.split(":", 1)[0].strip() for line in frontmatter.splitlines() if line.strip()]
public_files = [ROOT / "SKILL.md"]
for directory, pattern in (("reference", "*.md"), ("assets", "*.pptd"), ("scripts", "*.mjs")):
    public_files.extend((ROOT / directory).rglob(pattern))
public_text = "\n".join(path.read_text(encoding="utf-8") for path in public_files)
private_markers = ("/Users/", "/tmp/tpl-analysis", "太保发〔", "太保产发〔", "ppt模板素材.pptx")
internal_records = {ROOT / "reference" / "cpic-source-profile.md", ROOT / "reference" / "haoshi-layout-learning.md"}
ok(
    "Skill frontmatter and public boundaries stay discovery-safe",
    keys == ["name", "description"]
    and not any(path.exists() for path in internal_records)
    and not any(marker in public_text for marker in private_markers),
)

print(json.dumps({
    "ok": True,
    "test_count": len(checks),
    "tests": checks,
    "visual_review": "separate target-application review required"
}, ensure_ascii=False, indent=2))

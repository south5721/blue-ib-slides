#!/usr/bin/env python3
"""Read-only OOXML checks; visual rendering remains a separate requirement."""
import argparse
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def nonnegative(value):
    result = int(value)
    if result < 0:
        raise argparse.ArgumentTypeError("expected a nonnegative integer")
    return result


def verify(pptx, expected_slides=None, expected_charts=None):
    with ZipFile(pptx) as z:
        bad = z.testzip()
        if bad:
            raise ValueError(f"corrupt ZIP member: {bad}")
        names = set(z.namelist())
        required = {"[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"}
        if required - names:
            raise ValueError(f"missing package parts: {sorted(required - names)}")
        roots = {n: ET.fromstring(z.read(n)) for n in names if n.endswith((".xml", ".rels"))}
        for name, root in roots.items():
            # Parsing XML alone does not validate Office enum values. A real
            # PowerPoint failure established that table anchor='mid' is invalid.
            for node in root.iter():
                if node.tag in (f"{{{A}}}bodyPr", f"{{{A}}}tcPr"):
                    anchor=node.get('anchor')
                    if anchor and anchor not in {'t','ctr','b','just','dist'}:
                        raise ValueError(f"invalid Office vertical anchor {anchor!r}: {name}")
                if node.tag==f'{{{A}}}prstGeom' and node.get('prst')=='ellipse' and node.find(f'{{{A}}}avLst/{{{A}}}gd') is not None:
                    raise ValueError(f'Unsupported radius/adjustment on generated preset {node.get("prst")}: {name}')
                for key, value in node.attrib.items():
                    if value in {'NaN','Infinity','-Infinity','undefined'}:
                        raise ValueError(f"non-finite/undefined attribute {key}: {name}")
        for name, root in roots.items():
            if not name.endswith(".rels"):
                continue
            base = "" if name == "_rels/.rels" else posixpath.dirname(posixpath.dirname(name))
            for relation in root.findall(f"{{{REL}}}Relationship"):
                if relation.get("TargetMode") == "External":
                    continue
                target = relation.get("Target")
                if not target:
                    raise ValueError(f"empty internal relationship in {name}")
                target = unquote(urlsplit(target).path)
                resolved = posixpath.normpath(posixpath.join(base, target)).lstrip("/")
                if resolved not in names:
                    raise ValueError(f"missing relationship target: {name} -> {resolved}")
        slides = sorted(n for n in names if re.fullmatch(r"ppt/slides/slide[0-9]+[.]xml", n))
        charts = sorted(n for n in names if re.fullmatch(r"ppt/charts/chart[0-9]+[.]xml", n))
        if not slides:
            raise ValueError("no PowerPoint slides detected")
        listed = roots["ppt/presentation.xml"].findall(f".//{{{P}}}sldId")
        if len(listed) != len(slides):
            raise ValueError("presentation slide count differs from slide parts")
        if expected_slides is not None and len(slides) != expected_slides:
            raise ValueError(f"expected {expected_slides} slides, found {len(slides)}")
        if expected_charts is not None and len(charts) != expected_charts:
            raise ValueError(f"expected {expected_charts} native charts, found {len(charts)}")
        shapes = text_runs = tables = 0
        for name in slides:
            root = roots[name]
            ids=[x.get('id') for x in root.findall(f'.//{{{P}}}cNvPr')]
            if len(ids)!=len(set(ids)):
                raise ValueError(f'duplicate shape IDs: {name}')
            page_text = root.findall(f".//{{{A}}}t")
            if not any(t.text and t.text.strip() for t in page_text):
                raise ValueError(f"slide has no editable text: {name}")
            text_runs += len(page_text)
            shapes += len(root.findall(f".//{{{P}}}sp"))
            tables += len(root.findall(f".//{{{A}}}tbl"))
        return f"PASS | slides={len(slides)} native_charts={len(charts)} tables={tables} editable_shapes={shapes} text_runs={text_runs} size={pptx.stat().st_size} bytes"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--expected-slides", type=nonnegative)
    parser.add_argument("--expected-charts", type=nonnegative)
    args = parser.parse_args()
    try:
        print(verify(args.pptx, args.expected_slides, args.expected_charts))
    except (OSError, BadZipFile, ET.ParseError, ValueError, KeyError) as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

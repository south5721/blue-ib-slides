#!/usr/bin/env python3
"""Read-only PPTX inventory. Uses Python's standard library; never follows links."""
import argparse
import hashlib
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "dgm": "http://schemas.openxmlformats.org/drawingml/2006/diagram",
}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
MAX_XML_BYTES = 64 * 1024 * 1024


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def target_part(owner, target):
    """Resolve package-relative targets, not filesystem paths or network URLs."""
    target = unquote(target).replace("\\", "/")
    if "://" in target or "\x00" in target:
        raise ValueError("Invalid internal relationship target")
    candidate = (target.lstrip("/") if target.startswith("/")
                 else posixpath.join(posixpath.dirname(owner), target))
    candidate = posixpath.normpath(candidate)
    if candidate == ".." or candidate.startswith("../"):
        raise ValueError("Relationship escapes the PPTX package")
    return candidate


def rels_part(owner):
    parent, name = posixpath.split(owner)
    return posixpath.join(parent, "_rels", name + ".rels")


def texts(element):
    return [node.text or "" for node in element.findall(".//a:t", NS)]


def paragraph_text(element):
    paragraphs = element.findall(".//a:p", NS)
    return "\n".join("".join(texts(item)) for item in paragraphs) if paragraphs else "".join(texts(element))


def inventory(path):
    source_hash = sha256_file(path)
    warnings = []
    with zipfile.ZipFile(path) as package:
        names = package.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate ZIP member names are not supported")
        members = set(names)

        def xml(part, optional=False):
            if part not in members:
                if optional:
                    return None
                raise ValueError("Missing required package part: " + part)
            info = package.getinfo(part)
            if info.file_size > MAX_XML_BYTES:
                raise ValueError("XML part exceeds the 64 MiB safety limit: " + part)
            return ET.fromstring(package.read(part))

        def relations(owner):
            root = xml(rels_part(owner), optional=True)
            result = {}
            if root is None:
                return result
            for item in root.findall("{" + REL_NS + "}Relationship"):
                external = item.get("TargetMode") == "External"
                raw = item.get("Target", "")
                resolved = None if external else target_part(owner, raw)
                result[item.get("Id")] = {
                    "type": item.get("Type", "").rsplit("/", 1)[-1],
                    "target": raw,
                    "external": external,
                    "part": resolved,
                    "present": resolved in members if resolved else None,
                }
            return result

        def object_meta(shape):
            node = shape.find(".//p:cNvPr", NS)
            return {
                "id": node.get("id") if node is not None else None,
                "name": node.get("name") if node is not None else None,
            }

        def chart_record(part):
            root = xml(part)
            result = {"part": part, "chart_types": [], "series": []}
            plot = root.find(".//c:plotArea", NS)
            if plot is not None:
                result["chart_types"] = [
                    node.tag.rsplit("}", 1)[-1]
                    for node in plot
                    if node.tag.rsplit("}", 1)[-1].endswith("Chart")
                ]
            for series in root.findall(".//c:ser", NS):
                record = {"name": [], "caches": [], "formulas": []}
                series_parents = {child: parent for parent in series.iter() for child in parent}
                for title in series.findall("c:tx", NS):
                    record["name"].extend(n.text or "" for n in title.findall(".//c:v", NS))
                for node in series.iter():
                    tag = node.tag.rsplit("}", 1)[-1]
                    if tag == "f":
                        record["formulas"].append(node.text or "")
                    if tag in ("strCache", "numCache", "strLit", "numLit", "multiLvlStrCache"):
                        ancestor = node
                        while series_parents.get(ancestor) is not None and series_parents[ancestor] is not series:
                            ancestor = series_parents[ancestor]
                        role = ancestor.tag.rsplit("}", 1)[-1]
                        values = []
                        for point in node.findall(".//c:pt", NS):
                            value = point.find("c:v", NS)
                            values.append({
                                "index": point.get("idx"),
                                "value": value.text if value is not None else None,
                            })
                        record["caches"].append({"role": role, "type": tag, "points": values})
                result["series"].append(record)
            rels = relations(part)
            result["embedded_workbooks"] = [
                {"part": rel["part"], "present": rel["present"]}
                for rel in rels.values()
                if rel["type"] == "package" and not rel["external"]
            ]
            result["external_relationships"] = [
                rel for rel in rels.values() if rel["external"]
            ]
            result["cache_is_authoritative"] = False
            return result

        presentation = xml("ppt/presentation.xml")
        main_rels = relations("ppt/presentation.xml")
        size = presentation.find("p:sldSz", NS)
        slides = []
        for number, entry in enumerate(presentation.findall("p:sldIdLst/p:sldId", NS), 1):
            relation_id = entry.get("{" + NS["r"] + "}id")
            rel = main_rels.get(relation_id)
            if not rel or rel["external"] or not rel["present"]:
                raise ValueError("Missing or external slide relationship: " + str(relation_id))
            part = rel["part"]
            root = xml(part)
            slide_rels = relations(part)
            parents = {child: parent for parent in root.iter() for child in parent}

            def in_group(node):
                current = parents.get(node)
                while current is not None:
                    if current.tag == "{" + NS["p"] + "}grpSp":
                        return True
                    current = parents.get(current)
                return False

            shapes = []
            for shape in root.findall(".//p:sp", NS):
                runs = texts(shape)
                if not runs:
                    continue
                record = object_meta(shape)
                record.update({"text_runs": runs, "grouped": in_group(shape)})
                shapes.append(record)
            tables = []
            charts = []
            smartart = []
            for frame in root.findall(".//p:graphicFrame", NS):
                table = frame.find(".//a:tbl", NS)
                if table is not None:
                    tables.append({
                        **object_meta(frame),
                        "grouped": in_group(frame),
                        "rows": [
                            [paragraph_text(cell) for cell in row.findall("a:tc", NS)]
                            for row in table.findall("a:tr", NS)
                        ],
                        "note": "Merged cells and row/column geometry are not reconstructed.",
                    })
                for chart in frame.findall(".//c:chart", NS):
                    chart_rel = slide_rels.get(chart.get("{" + NS["r"] + "}id"))
                    if chart_rel and not chart_rel["external"] and chart_rel["present"]:
                        charts.append({**object_meta(frame), **chart_record(chart_rel["part"])})
                    else:
                        warnings.append(f"Slide {number}: unresolved standard chart relationship")
                for diagram in frame.findall(".//dgm:relIds", NS):
                    diagram_rel = slide_rels.get(diagram.get("{" + NS["r"] + "}dm"))
                    data_part = diagram_rel["part"] if diagram_rel and not diagram_rel["external"] else None
                    data = xml(data_part, optional=True) if data_part else None
                    smartart.append({
                        **object_meta(frame),
                        "data_part": data_part,
                        "data_present": data is not None,
                        "text_runs": texts(data) if data is not None else [],
                        "note": "Data-model text only; layout and duplicated drawing labels are not reconstructed.",
                    })
            notes = []
            for slide_rel in slide_rels.values():
                if slide_rel["type"] == "notesSlide" and not slide_rel["external"] and slide_rel["present"]:
                    notes.extend(texts(xml(slide_rel["part"])))
            slides.append({
                "number": number,
                "part": part,
                "text_shapes": shapes,
                "native_tables": tables,
                "standard_charts": charts,
                "smartart": smartart,
                "notes_text_runs": notes,
                "picture_count": len(root.findall(".//p:pic", NS)),
                "group_count": len(root.findall(".//p:grpSp", NS)),
                "relationships": list(slide_rels.values()),
            })
        media = [
            {"part": name, "size_bytes": package.getinfo(name).file_size,
             "extension": posixpath.splitext(name)[1].lower()}
            for name in sorted(names) if name.startswith("ppt/media/") and not name.endswith("/")
        ]
        result = {
            "schema_version": "1.0",
            "source": {"path": str(path), "sha256": source_hash, "size_bytes": path.stat().st_size},
            "canvas_emu": {
                "width": int(size.get("cx")) if size is not None else None,
                "height": int(size.get("cy")) if size is not None else None,
            },
            "slide_count": len(slides),
            "slides": slides,
            "media": media,
            "warnings": warnings,
            "limitations": [
                "Inventory only, not a full-fidelity import or visual rendering.",
                "Reading order follows slide order and XML object order, not semantic reading order.",
                "Text in images, OLE objects, chart extensions, hidden masters/layouts, and font glyphs is not OCRed.",
                "Chart caches may be stale; workbook presence does not verify workbook contents or editability.",
                "SmartArt inventory reads the data model, not its visual geometry or unique visible labels.",
                "All relationships are recorded without fetching external targets; media is not extracted.",
            ],
        }
    if sha256_file(path) != source_hash:
        raise ValueError("Source changed during inspection; inventory discarded")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", required=True, type=Path, help="New JSON path; existing files are never overwritten.")
    args = parser.parse_args()
    try:
        source = args.source.resolve(strict=True)
        if source.suffix.lower() != ".pptx":
            raise ValueError("Expected a .pptx source")
        result = inventory(source)
        with args.out.open("x", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(json.dumps({"ok": True, "slides": result["slide_count"], "output": str(args.out.resolve())},
                         ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, RuntimeError, zipfile.BadZipFile, ET.ParseError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

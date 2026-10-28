#!/usr/bin/env python3
"""Validate a local PPTX package without extracting it or opening Office.

Usage:
    python check-pptx.py deck.pptx --expected-slides 10 --expected-charts 2 --expected-tables 1
    python check-pptx.py deck.pptx --report checks.json

This checks package integrity and native objects, not visual layout or the
complete ECMA-376 schema. External hyperlinks are allowed and reported;
externally linked charts and workbooks are errors.
"""

from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation
import io
import json
import math
import posixpath
import re
import stat
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
import zlib
from pathlib import Path


REL_NAMESPACES = {
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "http://purl.oclc.org/ooxml/officeDocument/relationships",
}
WORKBOOK_SUFFIXES = (".xlsx", ".xlsm", ".xlsb", ".xls", ".ods")
CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart"
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\Z")
CELL = re.compile(r"([A-Z]{1,3})([1-9]\d*)\Z")
FORMULA = re.compile(r"(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_. ]*))!\$([A-Z]{1,3})\$([1-9]\d*)(?::\$([A-Z]{1,3})\$([1-9]\d*))?\Z")


def finite_number(text: str) -> Decimal:
    if not NUMBER.fullmatch(text.strip()):
        raise ValueError(f"Invalid or nonfinite number: {text!r}")
    value = Decimal(text)
    if not value.is_finite() or not math.isfinite(float(value)) or (value != 0 and float(value) == 0):
        raise ValueError(f"Number exceeds Excel's numeric range: {text!r}")
    return value


def valid_cell(address: str) -> bool:
    match = CELL.fullmatch(address)
    if not match or not 1 <= int(match[2]) <= 1048576:
        return False
    column = 0
    for char in match[1]:
        column = column * 26 + ord(char) - 64
    return 1 <= column <= 16384


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def rel_kind(value: str) -> str:
    return value.rstrip("/").rsplit("/", 1)[-1]


def relationship_id(element: ET.Element) -> str | None:
    for namespace in REL_NAMESPACES:
        value = element.get("{" + namespace + "}id")
        if value is not None:
            return value
    return None


def relation_owner(name: str) -> str | None:
    if name == "_rels/.rels":
        return ""
    folder, filename = posixpath.split(name)
    if posixpath.basename(folder) != "_rels" or not filename.endswith(".rels"):
        return None
    return posixpath.join(posixpath.dirname(folder), filename[:-5])


def decoded(value: str) -> str:
    return urllib.parse.unquote(value, encoding="utf-8", errors="strict")


def unsafe_archive_name(name: str) -> bool:
    try:
        value = decoded(name).rstrip("/")
    except (UnicodeError, ValueError):
        return True
    if not value or value.startswith("/") or "\\" in value or "\x00" in value:
        return True
    if any(ord(char) < 32 for char in value) or ":" in value:
        return True
    return any(part in ("", ".", "..") for part in value.split("/"))


def resolve_target(owner: str, target: str) -> str:
    """Resolve an OPC URI, allowing package-root / paths but no traversal."""
    parsed = urllib.parse.urlsplit(target)
    if parsed.scheme or parsed.netloc or parsed.query:
        raise ValueError("internal relationship is not a local package URI")
    path = decoded(parsed.path)
    if "\\" in path or "\x00" in path or any(ord(c) < 32 for c in path):
        raise ValueError("relationship target has unsafe path characters")
    if ":" in path:
        raise ValueError("relationship target contains a drive or alternate-stream path")
    if not path:
        if owner and parsed.fragment:
            return owner
        raise ValueError("relationship target is empty")
    if path.startswith("/"):
        result = posixpath.normpath(path.lstrip("/"))
    else:
        result = posixpath.normpath(posixpath.join(posixpath.dirname(owner), path))
    if result in ("", ".", "..") or result.startswith("../"):
        raise ValueError("relationship target escapes the package")
    return result


class Validator:
    def __init__(self, path: Path, expected_slides: int | None, expected_charts: int | None,
                 expected_tables: int | None = None):
        self.path = path
        self.expected_slides = expected_slides
        self.expected_charts = expected_charts
        self.expected_tables = expected_tables
        self.errors: list[dict] = []
        self.warnings: list[dict] = []
        self.external: list[dict] = []
        self.xml: dict[str, ET.Element] = {}
        self.relations: dict[str, dict[str, dict]] = {}
        self.parts: set[str] = set()
        self.workbooks: dict[str, bytes] = {}
        self.counts = {
            "slides": 0,
            "native_charts": 0,
            "native_chart_parts": 0,
            "native_tables": 0,
            "validated_native_tables": 0,
            "native_table_cells": 0,
            "editable_table_cells": 0,
            "shapes": 0,
            "text_boxes": 0,
            "editable_text_shapes": 0,
            "connectors": 0,
            "groups": 0,
            "pictures": 0,
            "slide_text_runs": 0,
            "slide_text_characters": 0,
            "embedded_workbooks": 0,
            "charts_with_embedded_workbooks": 0,
            "validated_chart_workbooks": 0,
        }

    def error(self, code: str, part: str, message: str) -> None:
        self.errors.append({"code": code, "part": part, "message": message})

    def warn(self, code: str, part: str, message: str) -> None:
        self.warnings.append({"code": code, "part": part, "message": message})

    def inspect_zip(self, archive: zipfile.ZipFile) -> None:
        seen: set[str] = set()
        normalized_seen: set[str] = set()
        for info in archive.infolist():
            name = info.filename
            if unsafe_archive_name(name):
                self.error("unsafe_zip_path", name, "Unsafe archive member name.")
                continue
            normalized = decoded(name).rstrip("/")
            if name in seen or normalized in normalized_seen:
                self.error("duplicate_zip_part", name, "Duplicate or URI-equivalent archive member.")
            seen.add(name)
            normalized_seen.add(normalized)
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                self.error("zip_symlink", name, "Symbolic links are not valid PPTX parts.")
            if info.flag_bits & 1:
                self.error("encrypted_zip_part", name, "Encrypted ZIP parts cannot be validated.")
            if not info.is_dir():
                self.parts.add(name)
        if self.errors:
            # Unsafe/ambiguous/encrypted archives are rejected before content is read.
            return
        try:
            bad = archive.testzip()
            if bad:
                self.error("zip_crc", bad, "ZIP CRC verification failed.")
                return
        except (OSError, RuntimeError, NotImplementedError, zipfile.BadZipFile, EOFError, ValueError, zlib.error) as exc:
            self.error("zip_crc", "", str(exc))
            return
        for name in sorted(self.parts):
            if name.lower().endswith(".xlsx"):
                self.workbooks[name] = archive.read(name)
            if not (name.lower().endswith((".xml", ".rels")) or name == "[Content_Types].xml"):
                continue
            try:
                content = archive.read(name)
                # Reject declarations even in UTF-16 XML before ElementTree expands entities.
                declaration_probe = content.replace(b"\x00", b"").upper()
                if b"<!DOCTYPE" in declaration_probe or b"<!ENTITY" in declaration_probe:
                    raise ValueError("DTD/entity declarations are not allowed in PPTX XML")
                self.xml[name] = ET.fromstring(content)
            except (ET.ParseError, ValueError, OSError, RuntimeError, zipfile.BadZipFile, EOFError, zlib.error) as exc:
                self.error("xml_parse", name, str(exc))

    def inspect_relationships(self) -> None:
        for name, root in sorted(self.xml.items()):
            if not name.endswith(".rels"):
                continue
            owner = relation_owner(name)
            if owner is None:
                self.error("relationship_path", name, "Invalid relationship part location.")
                continue
            if local_name(root.tag) != "Relationships":
                self.error("relationship_root", name, "Expected a Relationships root.")
                continue
            if owner and owner not in self.parts:
                self.error("missing_relationship_owner", name, f"Missing owner part: {owner}")
            owner_rels: dict[str, dict] = {}
            self.relations[owner] = owner_rels
            for element in root:
                if local_name(element.tag) != "Relationship":
                    continue
                rid = element.get("Id", "")
                target = element.get("Target", "")
                kind = element.get("Type", "")
                mode = element.get("TargetMode", "Internal")
                if not rid or not target or not kind:
                    self.error("relationship_fields", name, "Relationship requires Id, Type and Target.")
                    continue
                if rid in owner_rels:
                    self.error("duplicate_relationship_id", name, f"Duplicate relationship Id: {rid}")
                    continue
                if mode not in ("Internal", "External"):
                    self.error("relationship_mode", name, f"Invalid TargetMode: {mode}")
                    continue
                relation = {"id": rid, "type": kind, "target": target, "external": mode == "External"}
                owner_rels[rid] = relation
                if mode == "External":
                    item = {"owner": owner or "/", **relation}
                    self.external.append(item)
                    short_kind = rel_kind(kind).lower()
                    try:
                        external_path = decoded(urllib.parse.urlsplit(target).path).lower()
                    except (UnicodeError, ValueError):
                        external_path = target.lower()
                    if short_kind == "hyperlink":
                        continue
                    if (
                        short_kind in ("chart", "chartex", "package", "externallink", "externallinkpath")
                        or external_path.endswith(WORKBOOK_SUFFIXES)
                    ):
                        self.error("external_chart_or_workbook", name, f"{rid}: {target}")
                    else:
                        self.warn("external_relationship", name, f"{rid} ({short_kind}): {target}")
                    continue
                try:
                    resolved = resolve_target(owner, target)
                    # Producers may retain URI escaping in the ZIP member itself.
                    if resolved not in self.parts:
                        encoded = urllib.parse.quote(resolved, safe="/!$&'()*+,;=@-._~")
                        if encoded in self.parts:
                            resolved = encoded
                    relation["resolved"] = resolved
                    if resolved not in self.parts:
                        self.error("missing_relationship_target", name, f"{rid}: {resolved}")
                except (UnicodeError, ValueError) as exc:
                    self.error("unsafe_relationship_target", name, f"{rid}: {exc}")
        for name, root in self.xml.items():
            if name.endswith(".rels"):
                continue
            rels = self.relations.get(name, {})
            for element in root.iter():
                for key, rid in element.attrib.items():
                    if not key.startswith("{"):
                        continue
                    namespace, attribute = key[1:].split("}", 1)
                    if namespace in REL_NAMESPACES and attribute in ("id", "embed", "link") and rid not in rels:
                        self.error("missing_relationship_id", name, f"{local_name(element.tag)} references missing {rid}.")

    def inspect_presentation(self) -> None:
        if "[Content_Types].xml" not in self.parts:
            self.error("missing_content_types", "", "Missing [Content_Types].xml.")
        elif "[Content_Types].xml" in self.xml:
            if local_name(self.xml["[Content_Types].xml"].tag) != "Types":
                self.error("content_types_root", "[Content_Types].xml", "Expected a Types root.")
        if "_rels/.rels" not in self.parts:
            self.error("missing_package_relationships", "", "Missing _rels/.rels.")
        documents = [
            rel for rel in self.relations.get("", {}).values()
            if rel_kind(rel["type"]) == "officeDocument" and not rel["external"]
        ]
        if len(documents) != 1:
            self.error("presentation_relationship", "_rels/.rels", "Expected exactly one internal officeDocument relationship.")
            return
        presentation_name = documents[0].get("resolved", "")
        presentation = self.xml.get(presentation_name)
        if presentation is None or local_name(presentation.tag) != "presentation":
            self.error("presentation_xml", presentation_name, "Missing or invalid presentation XML.")
            return
        slide_parts = []
        rels = self.relations.get(presentation_name, {})
        for element in presentation.iter():
            if local_name(element.tag) != "sldId":
                continue
            rid = relationship_id(element)
            relation = rels.get(rid or "")
            if not relation or relation["external"] or rel_kind(relation["type"]) != "slide":
                self.error("slide_relationship", presentation_name, f"Invalid slide relationship: {rid}")
                continue
            target = relation.get("resolved", "")
            slide = self.xml.get(target)
            if slide is None or local_name(slide.tag) != "sld":
                self.error("slide_xml", target, "Missing or invalid slide XML.")
                continue
            slide_parts.append(target)
        if len(set(slide_parts)) != len(slide_parts):
            self.error("duplicate_slide_reference", presentation_name, "Presentation references a slide part more than once.")
        self.counts["slides"] = len(slide_parts)
        if not slide_parts:
            self.error("empty_presentation", presentation_name, "Presentation has no valid slides.")
        for name in slide_parts:
            root = self.xml[name]
            for element in root.iter():
                tag = local_name(element.tag)
                if tag == "sp":
                    self.counts["shapes"] += 1
                    if any(local_name(child.tag) == "txBody" for child in element):
                        self.counts["editable_text_shapes"] += 1
                    if any(local_name(child.tag) == "cNvSpPr" and child.get("txBox") in ("1", "true") for child in element.iter()):
                        self.counts["text_boxes"] += 1
                elif tag == "cxnSp":
                    self.counts["connectors"] += 1
                elif tag == "grpSp":
                    self.counts["groups"] += 1
                elif tag == "pic":
                    self.counts["pictures"] += 1
                elif tag == "tbl":
                    self.counts["native_tables"] += 1
                    self.inspect_table(name, element)
                elif tag == "t":
                    self.counts["slide_text_runs"] += 1
                    self.counts["slide_text_characters"] += len(element.text or "")
                elif tag in ("chart", "chartEx") and relationship_id(element):
                    relation = self.relations.get(name, {}).get(relationship_id(element), {})
                    chart_root = self.xml.get(relation.get("resolved", ""))
                    if chart_root is not None and local_name(chart_root.tag) == "chartSpace":
                        self.counts["native_charts"] += 1
                    else:
                        self.error("native_chart_part", name, "Chart reference does not resolve to a chartSpace XML part.")
        self.counts["native_chart_parts"] = sum(local_name(root.tag) == "chartSpace" for root in self.xml.values())
        self.counts["embedded_workbooks"] = sum(name.lower().endswith(WORKBOOK_SUFFIXES) for name in self.parts)
        for key, expected in (("slides", self.expected_slides), ("native_charts", self.expected_charts),
                              ("native_tables", self.expected_tables)):
            if expected is not None and self.counts[key] != expected:
                self.error("expected_count", presentation_name, f"{key}: expected {expected}, found {self.counts[key]}.")

    def inspect_table(self, name: str, table: ET.Element) -> None:
        """Check genuine DrawingML table structure and editable cell text bodies.

        This is structural verification, not a claim about target-application
        rendering, arithmetic, or pixel-perfect styling.
        """
        previous_errors = len(self.errors)
        namespace = table.tag.split("}", 1)[0] + "}" if "}" in table.tag else ""
        grid = table.find(namespace + "tblGrid")
        columns = list(grid.findall(namespace + "gridCol")) if grid is not None else []
        rows = table.findall(namespace + "tr")
        if not columns or not rows:
            self.error("native_table_structure", name, "Table needs tblGrid columns and table rows.")
        for column in columns:
            width = column.get("w", "")
            if not width.isdigit() or int(width) <= 0:
                self.error("native_table_geometry", name, f"Invalid column width: {width!r}.")
        for index, row in enumerate(rows):
            height = row.get("h", "")
            if not height.isdigit() or int(height) < 0:
                self.error("native_table_geometry", name, f"Invalid row {index} height: {height!r}.")
            cells = row.findall(namespace + "tc")
            # Merged tables remain valid candidates; plain rectangular tables
            # must have one cell per grid column. Do not infer merge semantics.
            merged = any(any(attr in cell.attrib for attr in
                             ("gridSpan", "rowSpan", "hMerge", "vMerge")) for cell in cells)
            if not cells or (not merged and len(cells) != len(columns)):
                self.error("native_table_structure", name,
                           f"Row {index} has {len(cells)} cells for {len(columns)} grid columns.")
            for cell in cells:
                self.counts["native_table_cells"] += 1
                bodies = cell.findall(namespace + "txBody")
                if len(bodies) == 1 and bodies[0].find(namespace + "p") is not None:
                    self.counts["editable_table_cells"] += 1
                else:
                    self.error("native_table_cell_text", name,
                               f"Row {index} cell lacks one editable txBody with a paragraph.")
        if len(self.errors) == previous_errors:
            self.counts["validated_native_tables"] += 1

    def workbook_cells(self, name: str) -> dict[str, dict[str, tuple[str, str]]] | None:
        """Independently validate the embedded ZIP/XML and read literal cells."""
        child = Validator(Path(name), None, None)
        try:
            with zipfile.ZipFile(io.BytesIO(self.workbooks[name])) as archive:
                child.inspect_zip(archive)
            child.inspect_relationships()
            if child.errors or child.external:
                raise ValueError(f"Invalid workbook package: {child.errors or child.external}")
            ct = child.xml.get("[Content_Types].xml")
            if ct is None or local_name(ct.tag) != "Types":
                raise ValueError("Invalid XLSX content types.")
            types = {e.get("PartName", "").lstrip("/"): e.get("ContentType", "") for e in ct if local_name(e.tag) == "Override"}
            roots = [rel for rel in child.relations.get("", {}).values() if rel_kind(rel["type"]) == "officeDocument" and not rel["external"]]
            if len(roots) != 1:
                raise ValueError("Workbook needs exactly one internal officeDocument relationship.")
            workbook_name = roots[0].get("resolved", "")
            if types.get(workbook_name) != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml":
                raise ValueError("Missing/invalid XLSX workbook content type.")
            root = child.xml.get(workbook_name)
            if root is None or root.tag != "{" + SHEET_NS + "}workbook":
                raise ValueError("Embedded XLSX has no supported workbook root.")
            if any(local_name(e.tag) in ("externalReferences", "definedNames") and len(e) for e in root):
                raise ValueError("External workbook references or defined formulas are not supported.")
            if any(part.lower().endswith((".bin", ".vba")) for part in child.parts):
                raise ValueError("Binary/executable workbook parts are not supported.")
            forbidden = {"f", "formula", "formula1", "formula2", "calculatedColumnFormula", "totalsRowFormula",
                         "definedName", "externalReference", "externalLink", "connection", "oleObject"}
            if any(local_name(e.tag) in forbidden for xml in child.xml.values() for e in xml.iter()):
                raise ValueError("Executable formula or external data structure in workbook.")
            shared = []
            shared_parts = [rel["resolved"] for rel in child.relations.get(workbook_name, {}).values() if rel_kind(rel["type"]) == "sharedStrings"]
            if len(shared_parts) > 1:
                raise ValueError("Duplicate shared strings parts.")
            if shared_parts:
                shared = ["".join(e.text or "" for e in item.iter("{" + SHEET_NS + "}t"))
                          for item in child.xml[shared_parts[0]].findall("{" + SHEET_NS + "}si")]
            sheets = {}
            for sheet in root.findall("./{" + SHEET_NS + "}sheets/{" + SHEET_NS + "}sheet"):
                sheet_name = sheet.get("name", "")
                if not sheet_name or sheet_name in sheets:
                    raise ValueError("Missing or duplicate sheet name.")
                relation = child.relations.get(workbook_name, {}).get(relationship_id(sheet) or "", {})
                sheet_root = child.xml.get(relation.get("resolved", ""))
                if rel_kind(relation.get("type", "")) != "worksheet" or sheet_root is None or sheet_root.tag != "{" + SHEET_NS + "}worksheet":
                    raise ValueError(f"Missing/invalid worksheet: {sheet_name}")
                if types.get(relation["resolved"]) != "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml":
                    raise ValueError("Missing/invalid worksheet content type.")
                if any(local_name(e.tag) in ("f", "formula", "formula1", "formula2") for e in sheet_root.iter()):
                    raise ValueError("Executable cell formulas are not supported in embedded chart data.")
                cells = {}
                for cell in sheet_root.iter("{" + SHEET_NS + "}c"):
                    address = cell.get("r", "")
                    if not valid_cell(address) or address in cells:
                        raise ValueError(f"Invalid/duplicate cell address: {address}")
                    typ = cell.get("t", "n")
                    value = cell.find("{" + SHEET_NS + "}v")
                    raw = (value.text or "") if value is not None else ""
                    if typ == "inlineStr":
                        cells[address] = ("text", "".join(e.text or "" for e in cell.iter("{" + SHEET_NS + "}t")))
                    elif typ == "s":
                        if not raw.isdigit() or int(raw) >= len(shared):
                            raise ValueError("Invalid shared string index.")
                        cells[address] = ("text", shared[int(raw)])
                    elif typ in ("n", ""):
                        if raw.strip():
                            finite_number(raw)
                            cells[address] = ("number", raw)
                    elif typ == "str":
                        cells[address] = ("text", raw)
                    else:
                        raise ValueError(f"Unsupported cell type: {typ}")
                sheets[sheet_name] = cells
            if not sheets:
                raise ValueError("Workbook has no worksheets.")
            return sheets
        except Exception as exc:
            self.error("invalid_chart_workbook", name, str(exc))
            return None

    def inspect_chart_data(self) -> None:
        validated = {}
        for name, root in self.xml.items():
            if local_name(root.tag) != "chartSpace":
                continue
            for container in root.iter():
                if local_name(container.tag) not in ("numCache", "numLit"):
                    continue
                for point in container:
                    if local_name(point.tag) != "pt":
                        continue
                    value = point.find("{" + CHART_NS + "}v")
                    if value is not None and (value.text or "").strip():
                        try:
                            finite_number(value.text)
                        except (ValueError, InvalidOperation, OverflowError) as exc:
                            self.error("nonfinite_chart_number", name, str(exc))
            externals = root.findall("{" + CHART_NS + "}externalData")
            if len(externals) != 1:
                self.error("chart_missing_embedded_workbook", name, "Chart requires exactly one externalData linked to an internal XLSX.")
                continue
            relation = self.relations.get(name, {}).get(relationship_id(externals[0]) or "", {})
            workbook_name = relation.get("resolved", "")
            if relation.get("external") or rel_kind(relation.get("type", "")) != "package" or workbook_name not in self.workbooks:
                self.error("chart_workbook_relationship", name, "externalData does not resolve to an internal XLSX package.")
                continue
            self.counts["charts_with_embedded_workbooks"] += 1
            if workbook_name not in validated:
                validated[workbook_name] = self.workbook_cells(workbook_name)
            sheets = validated[workbook_name]
            if sheets is None:
                continue
            try:
                formula_nodes, references = set(), 0
                for reference in root.iter():
                    kind = local_name(reference.tag)
                    if kind not in ("strRef", "numRef", "multiLvlStrRef"):
                        continue
                    formula = reference.find("{" + CHART_NS + "}f")
                    number = kind == "numRef"
                    cache = reference.find("{" + CHART_NS + "}" + ("numCache" if number else "multiLvlStrCache" if kind == "multiLvlStrRef" else "strCache"))
                    if formula is None or cache is None or len(reference) != 2:
                        raise ValueError("Reference requires exactly one formula and cache.")
                    formula_nodes.add(id(formula))
                    match = FORMULA.fullmatch(formula.text or "")
                    if not match:
                        raise ValueError(f"Unsupported/unsafe chart formula: {formula.text!r}")
                    quoted, simple, col, first, last_col, last = match.groups()
                    sheet_name = quoted.replace("''", "'") if quoted is not None else simple
                    if len(sheet_name) > 31 or any(c in sheet_name for c in "[]:*?/\\"):
                        raise ValueError("Invalid sheet name in chart formula.")
                    first, last = int(first), int(last or first)
                    if last_col not in (None, col) or last < first or not valid_cell(f"{col}{first}") or not valid_cell(f"{col}{last}"):
                        raise ValueError("Formula must reference one bounded vertical column.")
                    if sheet_name not in sheets:
                        raise ValueError(f"Missing formula worksheet: {sheet_name}")
                    counts = cache.findall("{" + CHART_NS + "}ptCount")
                    if len(counts) != 1 or not counts[0].get("val", "").isdigit():
                        raise ValueError("Invalid cache ptCount.")
                    count = int(counts[0].get("val"))
                    if count != last - first + 1:
                        raise ValueError("Cache length and formula range disagree.")
                    points = {}
                    point_container = cache
                    if kind == "multiLvlStrRef":
                        levels = cache.findall("{" + CHART_NS + "}lvl")
                        if len(levels) != 1:
                            raise ValueError("Only a single category level is supported by this preset; multi-level category hierarchies require separate validation.")
                        point_container = levels[0]
                    for point in point_container.findall("{" + CHART_NS + "}pt"):
                        index = point.get("idx", "")
                        values = point.findall("{" + CHART_NS + "}v")
                        if not index.isdigit() or not 0 <= int(index) < count or int(index) in points or len(values) != 1:
                            raise ValueError("Invalid/repeated cache point index/value.")
                        points[int(index)] = values[0].text or ""
                    for index in range(count):
                        cell = sheets[sheet_name].get(f"{col}{first + index}")
                        value = points.get(index)
                        if value is None or (number and not value.strip()):
                            if cell is not None and cell[1] != "":
                                raise ValueError("Blank cache point has nonblank workbook cell.")
                        elif number:
                            if cell is None or cell[0] != "number" or finite_number(value) != finite_number(cell[1]):
                                raise ValueError("Numeric cache disagrees with workbook cell.")
                        elif cell is None or cell[1] != value:
                            raise ValueError("String cache disagrees with workbook cell.")
                    references += 1
                if not references or any(id(e) not in formula_nodes for e in root.iter("{" + CHART_NS + "}f")):
                    raise ValueError("Missing or unsupported chart data formula.")
                if any(local_name(e.tag) in ("strLit", "numLit") for e in root.iter()):
                    raise ValueError("Workbook chart contains unbound literal data.")
            except (ValueError, InvalidOperation, OverflowError) as exc:
                self.error("chart_formula_or_cache", name, str(exc))
        self.counts["validated_chart_workbooks"] = sum(value is not None for value in validated.values())

    def run(self) -> dict:
        try:
            with zipfile.ZipFile(self.path) as archive:
                self.inspect_zip(archive)
        except (OSError, RuntimeError, NotImplementedError, zipfile.BadZipFile, EOFError, ValueError, zlib.error) as exc:
            self.error("zip_open", "", str(exc))
        if self.xml:
            self.inspect_relationships()
            self.inspect_presentation()
            self.inspect_chart_data()
        elif not self.errors:
            self.error("empty_package", "", "Package contains no parseable XML parts.")
        return {
            "file": str(self.path.resolve()),
            "ok": not self.errors,
            "counts": self.counts,
            "expected": {"slides": self.expected_slides, "native_charts": self.expected_charts,
                         "native_tables": self.expected_tables},
            "external_relationships": self.external,
            "errors": self.errors,
            "warnings": self.warnings,
            "scope": "ZIP CRC, XML syntax, safe paths, relationship targets, native object counts, native table grids/rows/editable cell text bodies, finite chart caches and embedded XLSX/formula consistency. editable_text_shapes counts slide shapes with txBody; text_boxes counts only shapes explicitly marked txBox. Native table checks do not verify application rendering or styling. Not visual layout or full OOXML schema validation.",
        }


def nonnegative(value: str) -> int:
    result = int(value)
    if result < 0:
        raise argparse.ArgumentTypeError("Expected a nonnegative integer.")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--expected-slides", type=nonnegative)
    parser.add_argument("--expected-charts", type=nonnegative)
    parser.add_argument("--expected-tables", type=nonnegative)
    parser.add_argument("--report", type=Path, help="Also save the JSON result to this file.")
    args = parser.parse_args()
    if args.report and args.report.resolve() == args.pptx.resolve():
        parser.error("--report must not overwrite the input PPTX.")
    result = Validator(args.pptx, args.expected_slides, args.expected_charts, args.expected_tables).run()
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        try:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(serialized + "\n", encoding="utf-8")
        except OSError as exc:
            print(f"Cannot write report: {exc}", file=sys.stderr)
            return 2
    try:
        print(serialized)
    except UnicodeEncodeError:
        print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

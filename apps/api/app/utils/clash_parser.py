"""Utilities for parsing Navisworks clash XML into backend-friendly objects."""

from __future__ import annotations

from pathlib import Path
import xml.etree.ElementTree as ET
from typing import Any


def text_or_none(node: ET.Element, path: str) -> str | None:
    child = node.find(path)
    return child.text.strip() if child is not None and child.text else None


def to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_name_value_nodes(parent: ET.Element, path: str) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for item in parent.findall(path):
        name = text_or_none(item, "name")
        value = text_or_none(item, "value")
        if name:
            out[name] = value
    return out


def extract_created_at(clashresult: ET.Element) -> str | None:
    date_node = clashresult.find("./createddate/date")
    if date_node is None:
        return None
    try:
        return (
            f"{int(date_node.attrib.get('year')):04d}-"
            f"{int(date_node.attrib.get('month')):02d}-"
            f"{int(date_node.attrib.get('day')):02d}T"
            f"{int(date_node.attrib.get('hour', 0)):02d}:"
            f"{int(date_node.attrib.get('minute', 0)):02d}:"
            f"{int(date_node.attrib.get('second', 0)):02d}"
        )
    except Exception:
        return None


def extract_clash_point(clashresult: ET.Element) -> dict[str, float | None] | None:
    pt = clashresult.find("./clashpoint/pos3f")
    if pt is None:
        return None
    return {
        "x": to_float(pt.attrib.get("x")),
        "y": to_float(pt.attrib.get("y")),
        "z": to_float(pt.attrib.get("z")),
    }


def extract_revit_global_id(attrs: dict[str, str | None]) -> str | None:
    candidate_keys = (
        "Revit UniqueId",
        "Revit Unique ID",
        "UniqueId",
        "Unique ID",
        "GlobalId",
        "Global ID",
        "IfcGUID",
        "Ifc GUID",
    )
    for key in candidate_keys:
        value = attrs.get(key)
        if value:
            return value
    return None


def parse_clash_object(clashobject: ET.Element) -> dict[str, Any]:
    attrs = parse_name_value_nodes(clashobject, "./objectattribute")
    tags = parse_name_value_nodes(clashobject, "./smarttags/smarttag")
    return {
        "revitGlobalId": extract_revit_global_id(attrs),
        "elementId": attrs.get("Element ID"),
        "clashMetadata": {
            "layer": text_or_none(clashobject, "./layer"),
            "itemName": tags.get("Item Name"),
            "itemType": tags.get("Item Type"),
        },
        "rawAttributes": attrs,
        "rawSmartTags": tags,
    }


def parse_clash_result(clashresult: ET.Element) -> dict[str, Any]:
    return {
        "clashName": clashresult.attrib.get("name"),
        "clashGuid": clashresult.attrib.get("guid"),
        "clashMetadata": {
            "status": clashresult.attrib.get("status"),
            "description": text_or_none(clashresult, "./description"),
            "resultStatus": text_or_none(clashresult, "./resultstatus"),
            "distance": to_float(clashresult.attrib.get("distance")),
            "href": clashresult.attrib.get("href"),
            "gridLocation": text_or_none(clashresult, "./gridlocation"),
            "createdAt": extract_created_at(clashresult),
            "clashPoint": extract_clash_point(clashresult),
        },
        "objects": [
            parse_clash_object(obj)
            for obj in clashresult.findall("./clashobjects/clashobject")
        ],
    }


def parse_clash_xml(xml_path: str | Path) -> dict[str, Any]:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    output: dict[str, Any] = {
        "sourceFile": Path(xml_path).name,
        "sourcePath": str(Path(xml_path).resolve()),
        "units": root.attrib.get("units"),
        "tests": [],
    }
    for clashtest in root.findall(".//clashtest"):
        summary = clashtest.find("./summary")
        test_data: dict[str, Any] = {
            "testName": clashtest.attrib.get("name"),
            "testType": clashtest.attrib.get("test_type"),
            "testStatus": clashtest.attrib.get("status"),
            "tolerance": clashtest.attrib.get("tolerance"),
            "summary": {
                "total": int(summary.attrib["total"]) if summary is not None and summary.attrib.get("total") else None,
                "new": int(summary.attrib["new"]) if summary is not None and summary.attrib.get("new") else None,
                "active": int(summary.attrib["active"]) if summary is not None and summary.attrib.get("active") else None,
                "reviewed": int(summary.attrib["reviewed"]) if summary is not None and summary.attrib.get("reviewed") else None,
                "approved": int(summary.attrib["approved"]) if summary is not None and summary.attrib.get("approved") else None,
                "resolved": int(summary.attrib["resolved"]) if summary is not None and summary.attrib.get("resolved") else None,
            },
            "clashes": [],
        }
        for clashresult in clashtest.findall("./clashresults/clashresult"):
            test_data["clashes"].append(parse_clash_result(clashresult))
        output["tests"].append(test_data)
    return output


def optimize_clash_for_agent(clash: dict[str, Any]) -> dict[str, Any]:
    """Minify a clash object for LLM inference."""
    return {
        "id": clash.get("clashGuid"),
        "type": clash.get("clashMetadata", {}).get("description"),
        "items": [
            {
                "n": obj.get("clashMetadata", {}).get("itemName"),
                "t": obj.get("clashMetadata", {}).get("itemType"),
            }
            for obj in clash.get("objects", [])
        ],
    }


def parse_and_optimize_clashes(xml_path: str | Path) -> list[dict[str, Any]]:
    """Convenience helper: parse XML and return optimized clashes from all tests."""
    parsed = parse_clash_xml(xml_path)
    optimized: list[dict[str, Any]] = []
    for test in parsed.get("tests", []):
        for clash in test.get("clashes", []):
            optimized.append(optimize_clash_for_agent(clash))
    return optimized

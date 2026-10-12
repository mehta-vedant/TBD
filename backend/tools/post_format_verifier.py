"""Deterministic facts and checks for the generated DOCX artifact."""
from __future__ import annotations

from typing import Any

from docx import Document
from docx.shared import Pt

from tools.docx_reader import extract_docx_structured


def verify_generated_docx(filepath: str, rules: dict[str, Any]) -> dict[str, Any]:
    """Inspect generated DOCX formatting without relying on model output.

    This is intentionally narrower than the AI validator: every reported pass or
    failure is backed by a fact obtained from python-docx. Unobservable rules are
    marked unverified instead of guessed.
    """
    structured = extract_docx_structured(filepath)
    metadata = structured["metadata"]
    paragraphs = structured["paragraphs"]
    checks = []

    body_font = rules.get("document", {}).get("font")
    observed_fonts = {p.get("font_name") for p in paragraphs if p.get("font_name")}
    if body_font:
        passed = bool(observed_fonts) and all(font.lower() == body_font.lower() for font in observed_fonts)
        checks.append({"id": "generated_font", "section": "document_format", "status": "pass" if passed else "fail", "expected": body_font, "observed": sorted(observed_fonts) or ["inherit/default"], "detail": "Generated document run fonts match the journal rule." if passed else "Generated document contains a font that does not match the journal rule."})

    expected_size = rules.get("document", {}).get("font_size")
    observed_size = metadata.get("body_font_size")
    if expected_size:
        passed = abs(float(observed_size) - float(expected_size)) <= 0.25
        checks.append({"id": "generated_font_size", "section": "document_format", "status": "pass" if passed else "fail", "expected": expected_size, "observed": observed_size, "detail": "Generated body font size matches the rule." if passed else "Generated body font size differs from the rule."})

    has_headings = metadata.get("has_headings", False)
    checks.append({"id": "generated_headings", "section": "headings", "status": "pass" if has_headings else "unverified", "expected": "detectable heading structure", "observed": has_headings, "detail": "Heading structure was detected in the generated DOCX." if has_headings else "Heading structure could not be verified from generated DOCX styles."})

    observed_sections = {check["section"] for check in checks if check["status"] in {"pass", "fail"}}
    passed = sum(1 for check in checks if check["status"] == "pass")
    failed = sum(1 for check in checks if check["status"] == "fail")
    return {
        "status": "pass" if failed == 0 else "needs_review",
        "checks": checks,
        "verified_categories": sorted(observed_sections),
        "coverage": round(100 * len(observed_sections) / 7),
        "summary": f"{passed} generated-document checks passed; {failed} require review.",
        "document_facts": metadata,
    }


def repair_generated_docx_once(filepath: str, rules: dict[str, Any], critic_report: dict[str, Any]) -> dict[str, Any]:
    """Apply one narrow, deterministic repair pass for verified DOCX defects.

    This function deliberately never changes manuscript words, citations, or
    headings. It fixes only explicit global font-family/font-size failures that
    are objectively measurable in the generated artifact, then the caller must
    verify again. Returning an audit record makes the bounded repair visible.
    """
    failed_ids = {check.get("id") for check in critic_report.get("checks", []) if check.get("status") == "fail"}
    can_fix_font = bool(failed_ids & {"generated_font", "generated_font_size"})
    if not can_fix_font:
        return {"attempted": False, "reason": "No safely repairable generated-DOCX defect was found."}

    document_rules = rules.get("document", {})
    expected_font = document_rules.get("font")
    expected_size = document_rules.get("font_size")
    if not expected_font and not expected_size:
        return {"attempted": False, "reason": "Journal rules do not define a global font repair target."}

    doc = Document(filepath)
    changed_runs = 0
    for paragraph in list(doc.paragraphs) + [p for table in doc.tables for row in table.rows for cell in row.cells for p in cell.paragraphs]:
        for run in paragraph.runs:
            if not run.text.strip():
                continue
            changed = False
            if expected_font and run.font.name != expected_font:
                run.font.name = expected_font
                changed = True
            if expected_size and (not run.font.size or abs(run.font.size.pt - float(expected_size)) > 0.25):
                run.font.size = Pt(float(expected_size))
                changed = True
            if changed:
                changed_runs += 1
    doc.save(filepath)
    return {
        "attempted": True,
        "repair_type": "global_font_normalization",
        "changed_runs": changed_runs,
        "reason": "Applied one deterministic global font repair, then requires re-verification.",
    }

"""Evidence-backed discovery and approval for journal formatting rules.

Discovery is deliberately a bounded workflow: search several sources, rank likely
official sources, extract a normalized rules draft, validate it, then require an
explicit approval before the rules become reusable by the formatter.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from tools.journal_discovery import extract_rules_from_text, fetch_journal_page, search_journal
from tools.logger import get_logger

logger = get_logger(__name__)

RULES_DIR = Path(__file__).resolve().parent.parent / "rules"
DRAFTS_DIR = RULES_DIR / "discovery_drafts"
APPROVED_DIR = RULES_DIR / "approved"
for _directory in (DRAFTS_DIR, APPROVED_DIR):
    _directory.mkdir(exist_ok=True)

DRAFT_TTL_SECONDS = 60 * 60
_OFFICIAL_HINTS = (
    "nature.com", "springer.com", "elsevier.com", "wiley.com", "tandfonline.com",
    "sagepub.com", "oup.com", "academic.oup.com", "cambridge.org", "plos.org",
    "bmj.com", "nejm.org", "thelancet.com", "jamanetwork.com", "ieee.org",
    "acm.org", "aps.org", "cell.com", "sciencedirect.com", "frontiersin.org",
)


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:60]


def _source_score(source: dict[str, str], journal_name: str) -> int:
    """Rank sources deterministically; the model never invents source trust."""
    url = source.get("url", "")
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    text = f"{source.get('title', '')} {source.get('snippet', '')}".lower()
    score = 0
    if any(host == hint or host.endswith(f".{hint}") for hint in _OFFICIAL_HINTS):
        score += 70
    if "author" in text or "submission" in text or "instruction" in text or "guideline" in text:
        score += 20
    if journal_name.lower() in text:
        score += 10
    if parsed.scheme == "https":
        score += 5
    if any(noisy in host for noisy in ("facebook.", "linkedin.", "researchgate.", "impactfactor")):
        score -= 80
    return score


def rank_sources(journal_name: str, sources: list[dict[str, str]]) -> list[dict[str, Any]]:
    ranked = []
    seen: set[str] = set()
    for source in sources:
        url = source.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        rank = _source_score(source, journal_name)
        ranked.append({
            "id": hashlib.sha256(url.encode()).hexdigest()[:12],
            "title": source.get("title", url),
            "url": url,
            "snippet": source.get("snippet", "")[:300],
            "score": rank,
            "official_likelihood": "high" if rank >= 70 else "medium" if rank >= 25 else "low",
        })
    return sorted(ranked, key=lambda item: item["score"], reverse=True)


def _validate_rules(rules: dict) -> list[str]:
    """Return actionable errors instead of allowing malformed drafts to be approved."""
    required = {"style_name", "document", "abstract", "headings", "citations", "references", "figures", "tables", "general_rules"}
    missing = sorted(required - set(rules)) if isinstance(rules, dict) else sorted(required)
    errors = [f"Missing required section: {key}" for key in missing]
    if not isinstance(rules, dict):
        return errors
    try:
        from tools.rule_loader import _get_schema
        import jsonschema
        schema = _get_schema()
        if schema:
            jsonschema.validate(instance=rules, schema=schema)
    except Exception as exc:
        errors.append(f"Schema validation failed: {str(exc)[:220]}")
    return errors


def _rule_evidence(rules: dict, source_text: str, url: str) -> list[dict[str, Any]]:
    """Expose provenance honestly. Unsupported fields are explicitly unverified."""
    lower = source_text.lower()
    topics = {
        "document": ("font", "margin", "spacing", "manuscript"),
        "abstract": ("abstract", "word"),
        "headings": ("heading", "section"),
        "citations": ("citation", "reference"),
        "references": ("reference", "bibliography"),
        "figures": ("figure", "caption"),
        "tables": ("table", "caption"),
    }
    evidence = []
    lines = [line.strip() for line in source_text.splitlines() if line.strip()]
    for field, keywords in topics.items():
        matching = next((line for line in lines if any(word in line.lower() for word in keywords)), "")
        evidence.append({
            "rule_section": field,
            "source_url": url,
            "excerpt": matching[:400] if matching else None,
            "verified": bool(matching),
        })
    return evidence


def _coverage(evidence: list[dict[str, Any]]) -> int:
    if not evidence:
        return 0
    return round(100 * sum(1 for item in evidence if item["verified"]) / len(evidence))


def _draft_path(draft_id: str) -> Path:
    return DRAFTS_DIR / f"{draft_id}.json"


def _load_draft(draft_id: str) -> dict:
    path = _draft_path(draft_id)
    if not path.exists():
        raise ValueError("Journal discovery draft was not found or has expired.")
    draft = json.loads(path.read_text(encoding="utf-8"))
    if time.time() - draft.get("created_at", 0) > DRAFT_TTL_SECONDS:
        path.unlink(missing_ok=True)
        raise ValueError("Journal discovery draft expired. Search again to refresh the evidence.")
    return draft


def discover_journal(journal_name: str) -> dict:
    query = journal_name.strip()
    if len(query) < 2:
        raise ValueError("Journal name must contain at least two characters.")
    candidates = rank_sources(query, search_journal(query, max_results=8))
    if not candidates:
        raise ValueError("No journal guideline sources were found.")
    return analyze_source(query, candidates, candidates[0]["id"])


def analyze_source(journal_name: str, candidates: list[dict[str, Any]], source_id: str) -> dict:
    source = next((item for item in candidates if item["id"] == source_id), None)
    if not source:
        raise ValueError("Selected source is not part of this discovery result.")
    if source["official_likelihood"] == "low":
        raise ValueError("That source is not credible enough for automatic rule extraction. Choose an official guideline page or upload a guideline document.")
    source_text = fetch_journal_page(source["url"])
    if len(source_text.strip()) < 200:
        raise ValueError("The selected source did not provide enough readable guideline text.")
    rules = extract_rules_from_text(source_text, journal_name)
    rules["style_name"] = journal_name
    validation_errors = _validate_rules(rules)
    evidence = _rule_evidence(rules, source_text, source["url"])
    draft = {
        "draft_id": uuid.uuid4().hex,
        "created_at": time.time(),
        "journal_name": journal_name,
        "status": "ready_for_approval" if not validation_errors else "invalid",
        "selected_source": source,
        "candidates": candidates,
        "rules": rules,
        "evidence": evidence,
        "verification_coverage": _coverage(evidence),
        "validation_errors": validation_errors,
    }
    _draft_path(draft["draft_id"]).write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")
    return public_draft(draft)


def select_source(draft_id: str, source_id: str) -> dict:
    draft = _load_draft(draft_id)
    return analyze_source(draft["journal_name"], draft["candidates"], source_id)


def public_draft(draft: dict) -> dict:
    return {
        "draft_id": draft["draft_id"], "journal_name": draft["journal_name"], "status": draft["status"],
        "selected_source": draft["selected_source"], "candidates": draft["candidates"],
        "rules": draft["rules"], "evidence": draft["evidence"],
        "verification_coverage": draft["verification_coverage"], "validation_errors": draft["validation_errors"],
    }


def approve_draft(draft_id: str) -> dict:
    draft = _load_draft(draft_id)
    if draft["status"] != "ready_for_approval" or draft["validation_errors"]:
        raise ValueError("Only a valid, evidence-backed journal draft can be approved.")
    version = time.strftime("%Y%m%d-%H%M%S")
    slug = _slugify(draft["journal_name"])
    rule_set_id = f"{slug}:{version}"
    approved = copy.deepcopy(draft)
    approved.update({"rule_set_id": rule_set_id, "approved_at": time.time(), "status": "approved"})
    (APPROVED_DIR / f"{slug}--{version}.json").write_text(json.dumps(approved, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("[JOURNAL_INTELLIGENCE] Approved %s from %s", rule_set_id, draft["selected_source"]["url"])
    return {"rule_set_id": rule_set_id, "journal_name": draft["journal_name"], "rules": draft["rules"], "source": draft["selected_source"], "verification_coverage": draft["verification_coverage"]}


def load_approved_rule_set(rule_set_id: str) -> dict:
    for path in APPROVED_DIR.glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if payload.get("rule_set_id") == rule_set_id:
                return payload
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
    raise ValueError("Approved journal rule set was not found.")

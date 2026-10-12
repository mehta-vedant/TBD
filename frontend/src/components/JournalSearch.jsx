import { useState, useEffect, useRef, useMemo } from 'react'

// Keep discovery on the same backend as upload, scoring, and formatting.
// VITE_BACKEND_URL is the documented production setting; VITE_API_URL remains
// as a compatibility fallback for older local environments.
const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000'

const POPULAR_JOURNALS = [
  'APA 7th Edition',
  'IEEE',
  'Vancouver',
  'Springer',
  'Chicago',
  'Nature',
  'Science',
  'Cell',
  'The Lancet',
  'NEJM',
  'PNAS',
  'PLOS ONE',
  'Nature Medicine',
  'Nature Biotechnology',
  'Nature Communications',
  'JAMA',
  'BMJ',
  'ACS Nano',
  'Advanced Materials',
  'Angewandte Chemie',
  'Chemical Reviews',
  'Environmental Science & Technology',
  'Journal of the American Chemical Society',
  'Physical Review Letters',
  'Applied Physics Letters',
  'Journal of Biological Chemistry',
  'Molecular Cell',
  'Neuron',
  'Immunity',
  'Cancer Research',
  'The Astrophysical Journal',
  'Monthly Notices of the Royal Astronomical Society',
  'Economics Letters',
  'Quarterly Journal of Economics',
  'American Economic Review',
  'Political Analysis',
  'Journal of Political Economy',
  'ACM Computing Surveys',
  'IEEE Transactions on Pattern Analysis',
  'Neural Computation',
  'Artificial Intelligence',
  'Journal of Machine Learning Research',
  'Computer Networks',
  'Information Sciences',
  'Software Engineering Notes',
  'IEEE Access',
  'MDPI',
  'Elsevier',
  'Taylor & Francis',
  'Wiley',
  'SAGE',
  'Oxford Academic',
  'Cambridge University Press',
  'PLoS Biology',
  'PLoS Genetics',
  'PLoS Computational Biology',
  'eLife',
  'PeerJ',
  'Scientific Reports',
  'Frontiers in Immunology',
  'Frontiers in Neuroscience',
  'BMC Genomics',
  'Genome Biology',
  'Nucleic Acids Research',
  'Bioinformatics',
  'Genetics',
  'Plant Cell',
  'Plant Physiology',
  'Marine Ecology Progress Series',
  'Ecology Letters',
  'Global Change Biology',
  'Conservation Biology',
  'Journal of Ecology',
  'Oikos',
  'Animal Behaviour',
  'Behavioral Ecology',
  'Proceedings of the Royal Society B',
  'Philosophical Transactions of the Royal Society',
  'Mind',
  'The Journal of Philosophy',
  'Ethics',
  'Noûs',
  'Philosophy and Phenomenological Research',
  'Legal Studies',
  'Harvard Law Review',
  'Yale Law Journal',
  'Stanford Law Review',
  'Columbia Law Review',
  'Journal of International Economics',
  'World Development',
  'Journal of Development Economics',
  'American Journal of Political Science',
  'Comparative Political Studies',
  'Journal of Conflict Resolution',
  'International Organization',
  'Journal of Marriage and Family',
  'Demography',
  'Social Forces',
  'Criminology',
  'Journal of Research in Crime and Delinquency',
  'Journal of Abnormal Psychology',
  'Health Psychology',
  'Annals of Behavioral Medicine',
  'Journal of Consulting and Clinical Psychology',
  'Academic Medicine',
  'Medical Education',
  'BMC Medical Education',
  'Radiology',
  'Journal of Nuclear Medicine',
  'Anesthesiology',
  'Anesthesia & Analgesia',
  'British Journal of Anaesthesia',
  'Critical Care Medicine',
  'Chest',
  'Heart',
  'Circulation',
  'Hypertension',
  'Diabetes Care',
  'The Journal of Clinical Endocrinology & Metabolism',
  'Gastroenterology',
  'Hepatology',
  'Journal of Hepatology',
  'Kidney International',
  'Journal of the American Society of Nephrology',
  'Arthritis & Rheumatology',
  'Annals of the Rheumatic Diseases',
  'Journal of Allergy and Clinical Immunology',
  'Blood',
  'Leukemia',
  'Journal of Clinical Oncology',
  'Cancer',
  'Neurology',
  'Brain',
  'The Lancet Neurology',
  'Annals of Neurology',
  'Stroke',
  'Journal of Cerebral Blood Flow & Metabolism',
  'Schizophrenia Bulletin',
  'Bipolar Disorders',
  'Journal of Psychiatric Research',
  'Addiction',
  'Journal of Studies on Alcohol and Drugs',
]

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeLinecap="round" />
  </svg>
)

export default function JournalSearch({ onSelect, selectedJournal, disabled }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [extracting, setExtracting] = useState(null)
  const [draft, setDraft] = useState(null)
  const [approvalError, setApprovalError] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return POPULAR_JOURNALS.filter(j => j.toLowerCase().includes(q)).slice(0, 8)
  }, [query])

  const showDropdown = focused && query.trim().length > 0

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      if (highlightIdx >= 0 && filtered[highlightIdx]) {
        handlePick(filtered[highlightIdx])
      } else if (query.trim().length >= 2) {
        await handleDiscover(query.trim())
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  const BUILTIN_JOURNALS = ['APA 7th Edition', 'IEEE', 'Vancouver', 'Springer', 'Chicago']

  const handlePick = (name) => {
    if (!BUILTIN_JOURNALS.includes(name)) {
      handleDiscover(name)
      return
    }
    setQuery(name)
    setFocused(false)
    onSelect(name, 'built-in')
  }

  const handleDiscover = async (name) => {
    setExtracting(name)
    setFocused(false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const res = await fetch(`${API_BASE}/journals/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.success) {
        setDraft(data.draft)
        setQuery(name)
      } else {
        alert(data?.detail?.error || `Could not find rules for "${name}". Try a more specific journal name or use Full Custom.`)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('Extraction took too long. Please try again or use Full Custom mode.')
      } else {
        alert('Discovery failed. Please try again or use Full Custom mode.')
      }
    } finally {
      clearTimeout(timer)
      setExtracting(null)
    }
  }

  const selectSource = async (sourceId) => {
    if (!draft) return
    setExtracting(draft.journal_name)
    setApprovalError('')
    try {
      const res = await fetch(`${API_BASE}/journals/discover/${draft.draft_id}/select-source`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data?.detail?.error || 'Could not analyze that source.')
      setDraft(data.draft)
    } catch (err) { setApprovalError(err.message) }
    finally { setExtracting(null) }
  }

  const approveDraft = async () => {
    if (!draft) return
    setExtracting(draft.journal_name)
    setApprovalError('')
    try {
      const res = await fetch(`${API_BASE}/journals/discover/${draft.draft_id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data?.detail?.error || 'This rule draft could not be approved.')
      setDraft(null)
      onSelect(data.rule_set.journal_name, 'approved', data.rule_set.rule_set_id)
    } catch (err) { setApprovalError(err.message) }
    finally { setExtracting(null) }
  }

  const isBuiltin = selectedJournal && BUILTIN_JOURNALS.includes(selectedJournal)

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff',
        border: focused ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
      }}>
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0, display: 'flex' }}><SearchIcon /></span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlightIdx(-1) }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedJournal ? selectedJournal : 'Search journal (e.g. Nature, Cell, PLOS ONE...)'}
          disabled={disabled || extracting !== null}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '0.9rem', padding: 0,
          }}
        />
        {extracting && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--blue)' }}>
            <SpinnerIcon />
            Discovering...
          </span>
        )}
        {!extracting && selectedJournal && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
            borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
            background: isBuiltin ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)',
            color: isBuiltin ? 'var(--success)' : '#a855f7',
          }}>
            <CheckIcon />
            {selectedJournal}
          </span>
        )}
      </div>

      {/* Dropdown suggestions */}
      {showDropdown && !extracting && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 100, overflow: 'hidden',
        }}>
          {filtered.length > 0 && filtered.map((name, i) => (
            <button
              key={name}
              onClick={() => handlePick(name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', background: i === highlightIdx ? 'var(--bg-soft)' : '#fff',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: '0.85rem', color: 'var(--text)', borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span style={{ fontWeight: 600, flex: 1 }}>{name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>select</span>
            </button>
          ))}

          {/* Discover option for unknown journals */}
          {query.trim().length >= 2 && !POPULAR_JOURNALS.some(j => j.toLowerCase() === query.toLowerCase()) && (
            <button
              onClick={() => handleDiscover(query.trim())}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', background: '#fff', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                fontSize: '0.85rem', color: 'var(--blue)',
              }}
            >
              <span>Discover rules for "{query.trim()}"</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.6 }}>Enter ↵</span>
            </button>
          )}
        </div>
      )}

      {draft && (
        <div style={{ marginTop: 10, padding: 14, border: '1.5px solid var(--blue)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-soft)' }}>
          <div style={{ fontWeight: 700, marginBottom: 5 }}>Review journal-rule evidence</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            {draft.verification_coverage}% of rule sections have source evidence. Approve before this journal can format a paper.
          </div>
          {draft.selected_source && <div style={{ fontSize: '0.8rem', marginBottom: 10 }}><strong>Selected source:</strong> <a href={draft.selected_source.url} target="_blank" rel="noreferrer">{draft.selected_source.title}</a></div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {(draft.candidates || []).slice(0, 4).map(source => <button key={source.id} onClick={() => selectSource(source.id)} disabled={extracting || source.id === draft.selected_source?.id} style={{ border: '1px solid var(--border)', background: source.id === draft.selected_source?.id ? 'var(--blue)' : '#fff', color: source.id === draft.selected_source?.id ? '#fff' : 'var(--text)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.72rem' }}>{source.official_likelihood} source</button>)}
          </div>
          {draft.validation_errors?.length > 0 && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginBottom: 8 }}>{draft.validation_errors[0]}</div>}
          {approvalError && <div style={{ color: 'var(--error)', fontSize: '0.78rem', marginBottom: 8 }}>{approvalError}</div>}
          <button onClick={approveDraft} disabled={extracting || draft.status !== 'ready_for_approval'} className="btn-primary" style={{ width: 'auto', margin: 0, padding: '8px 12px', fontSize: '0.8rem' }}>Approve verified rules</button>
        </div>
      )}
    </div>
  )
}

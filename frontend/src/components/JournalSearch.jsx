import { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
)

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeLinecap="round" />
  </svg>
)

export default function JournalSearch({ onSelect, selectedJournal, disabled }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [extracting, setExtracting] = useState(null)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      searchJournals(query.trim())
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const searchJournals = async (q) => {
    setLoading(true)
    setShowDropdown(true)
    try {
      const res = await fetch(`${API_BASE}/journals/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.success) {
        setResults(data.results)
      }
    } catch (err) {
      console.error('Journal search failed:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (item) => {
    if (item.source === 'built-in') {
      onSelect(item.title, 'built-in')
      setQuery(item.title)
      setShowDropdown(false)
    } else {
      setExtracting(item.title)
      setShowDropdown(false)
      try {
        const res = await fetch(`${API_BASE}/journals/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.title, url: item.url }),
        })
        const data = await res.json()
        if (data.success) {
          onSelect(item.title, 'extracted')
          setQuery(item.title)
        } else {
          alert(data.error || 'Failed to extract rules. Try uploading a guidelines PDF instead.')
        }
      } catch (err) {
        console.error('Extraction failed:', err)
        alert('Extraction failed. Try uploading a guidelines PDF instead.')
      } finally {
        setExtracting(null)
      }
    }
  }

  const builtInResults = results.filter(r => r.source === 'built-in')
  const webResults = results.filter(r => r.source === 'web')

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-soft)', border: '1.5px solid var(--bg-soft)',
        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
        transition: 'border-color 0.2s',
        ...(showDropdown ? { borderColor: 'var(--blue)' } : {}),
      }}>
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}><SearchIcon /></span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search for any journal (e.g. Nature, Cell, PLOS ONE...)"
          disabled={disabled}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '0.9rem', padding: 0,
          }}
        />
        {loading && <SpinnerIcon />}
        {selectedJournal && !loading && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
            background: 'rgba(34,197,94,0.15)', color: 'var(--success)',
          }}>
            <CheckIcon />
            {selectedJournal}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1.5px solid var(--bg-soft)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          maxHeight: 320, overflowY: 'auto', zIndex: 100,
        }}>
          {builtInResults.length === 0 && webResults.length === 0 && !loading && (
            <div style={{ padding: '16px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
              No results found. Try a different search term.
            </div>
          )}

          {builtInResults.length > 0 && (
            <div>
              <div style={{
                padding: '8px 14px', fontSize: '0.7rem', fontWeight: 700,
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Built-in Styles
              </div>
              {builtInResults.map((item, i) => (
                <button
                  key={`built-${i}`}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-soft)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(34,197,94,0.15)', color: 'var(--success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <CheckIcon />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                    {item.title}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Instant
                  </span>
                </button>
              ))}
            </div>
          )}

          {webResults.length > 0 && (
            <div>
              <div style={{
                padding: '8px 14px', fontSize: '0.7rem', fontWeight: 700,
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                borderTop: builtInResults.length > 0 ? '1px solid var(--bg-soft)' : 'none',
              }}>
                Web Results
              </div>
              {webResults.map((item, i) => (
                <button
                  key={`web-${i}`}
                  onClick={() => handleSelect(item)}
                  disabled={extracting !== null}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: extracting ? 'wait' : 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-soft)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: extracting === item.title ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                    color: extracting === item.title ? 'var(--blue)' : '#a855f7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {extracting === item.title ? <SpinnerIcon /> : <GlobeIcon />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    {item.snippet && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.snippet.slice(0, 100)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {extracting === item.title ? 'Extracting...' : 'Auto-extract'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

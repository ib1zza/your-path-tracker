import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type PlaceSearchResult } from '../../lib/geo/geocode';

interface PlaceSearchProps {
  onSelect: (place: PlaceSearchResult) => void;
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      void searchPlaces(query)
        .then((items) => {
          if (!controller.signal.aborted) {
            setResults(items);
            setIsOpen(true);
            setError(null);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError('Search failed');
            setResults([]);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  return (
    <div className="place-search">
      <input
        type="search"
        className="place-search__input"
        placeholder="Search city or place…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
      />
      {error && <div className="place-search__error">{error}</div>}
      {isOpen && results.length > 0 && (
        <ul className="place-search__results">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(place);
                  setQuery(place.label);
                  setIsOpen(false);
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

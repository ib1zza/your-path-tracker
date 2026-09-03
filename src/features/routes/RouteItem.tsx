import { useEffect, useState } from 'react';
import { formatDate, formatDistance } from '../../types/route';
import type { RouteFeature } from '../../types/route';

interface RouteItemProps {
  route: RouteFeature;
  isSelected: boolean;
  isVisible: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onNotesChange: (notes: string) => void;
  onEditGeometry: () => void;
  onExport: () => void;
}

export function RouteItem({
  route,
  isSelected,
  isVisible,
  onSelect,
  onToggleVisibility,
  onDelete,
  onRename,
  onNotesChange,
  onEditGeometry,
  onExport,
}: RouteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(route.properties.name);
  const [notes, setNotes] = useState(route.properties.notes ?? '');

  useEffect(() => {
    setName(route.properties.name);
    setNotes(route.properties.notes ?? '');
  }, [route.properties.name, route.properties.notes]);

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== route.properties.name) {
      onRename(trimmed);
    } else {
      setName(route.properties.name);
    }
    setIsEditing(false);
  };

  const handleSaveNotes = () => {
    const trimmed = notes.trim();
    if (trimmed !== (route.properties.notes ?? '')) {
      onNotesChange(trimmed);
    }
  };

  return (
    <article className={`route-item ${isSelected ? 'route-item--selected' : ''}`}>
      <button type="button" className="route-item__main" onClick={onSelect}>
        <span
          className="route-item__color"
          style={{ backgroundColor: route.properties.color }}
          aria-hidden
        />
        <span className="route-item__info">
          {isEditing ? (
            <input
              className="route-item__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveName();
                if (event.key === 'Escape') {
                  setName(route.properties.name);
                  setIsEditing(false);
                }
              }}
              autoFocus
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <strong>{route.properties.name}</strong>
          )}
          <span className="route-item__meta">
            {formatDistance(route.properties.distanceMeters)} · {formatDate(route.properties.createdAt)}
            {route.properties.placeName ? ` · ${route.properties.placeName}` : ''}
            {route.properties.source === 'gps'
              ? ' · GPS'
              : route.properties.source === 'import'
                ? ' · Import'
                : ''}
          </span>
        </span>
      </button>

      {isSelected && (
        <label className="route-item__notes">
          <span>Notes</span>
          <textarea
            value={notes}
            rows={2}
            placeholder="Add a note…"
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleSaveNotes}
          />
        </label>
      )}

      <div className="route-item__actions">
        <button
          type="button"
          className="btn btn--icon"
          title={isVisible ? 'Hide on map' : 'Show on map'}
          onClick={onToggleVisibility}
        >
          {isVisible ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          className="btn btn--icon"
          title="Rename"
          onClick={() => setIsEditing(true)}
        >
          Rename
        </button>
        <button type="button" className="btn btn--icon" title="Edit path" onClick={onEditGeometry}>
          Path
        </button>
        <button type="button" className="btn btn--icon" title="Export" onClick={onExport}>
          Export
        </button>
        <button type="button" className="btn btn--icon btn--danger" title="Delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

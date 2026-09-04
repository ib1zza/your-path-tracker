import { useState } from 'react';
import { MAP_STYLE_OPTIONS, type MapStyleId } from '../../lib/map/basemapStyles';

interface MapStyleMenuProps {
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
}

export function MapStyleMenu({ value, onChange }: MapStyleMenuProps) {
  const [open, setOpen] = useState(false);
  const current = MAP_STYLE_OPTIONS.find((option) => option.id === value);

  return (
    <div className="draw-menu">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((next) => !next)}
      >
        {current?.label ?? 'Style'}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="draw-menu__backdrop"
            aria-label="Close map style menu"
            onClick={() => setOpen(false)}
          />
          <div className="draw-menu__list" role="menu">
            {MAP_STYLE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`draw-menu__item ${value === option.id ? 'draw-menu__item--active' : ''}`}
                role="menuitem"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

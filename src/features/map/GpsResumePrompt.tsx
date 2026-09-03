import { useEffect, useState } from 'react';
import { getGpsDraft } from '../../db/routesDb';
import { calculateDistanceMeters } from '../../lib/geo/distance';
import { useDrawStore } from '../../stores/drawStore';
import { formatDistance } from '../../types/route';

export function GpsResumePrompt() {
  const mode = useDrawStore((state) => state.mode);
  const resumeGpsDraft = useDrawStore((state) => state.resumeGpsDraft);
  const clearGpsSession = useDrawStore((state) => state.clearGpsSession);
  const [draftInfo, setDraftInfo] = useState<{ points: number; distance: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'gps') {
      setDraftInfo(null);
      return;
    }

    void getGpsDraft().then((draft) => {
      if (!draft?.active || draft.points.length < 2) {
        setDraftInfo(null);
        return;
      }
      setDraftInfo({
        points: draft.points.length,
        distance: formatDistance(
          calculateDistanceMeters({ type: 'LineString', coordinates: draft.points }),
        ),
      });
    });
  }, [mode]);

  if (!draftInfo) {
    return null;
  }

  return (
    <div className="gps-resume">
      <div>
        <strong>Unfinished GPS track</strong>
        <p>
          {draftInfo.points} points · {draftInfo.distance}. Resume recording?
        </p>
      </div>
      <div className="gps-resume__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void clearGpsSession().finally(() => {
              setDraftInfo(null);
              setBusy(false);
            });
          }}
        >
          Discard
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void resumeGpsDraft().finally(() => {
              setDraftInfo(null);
              setBusy(false);
            });
          }}
        >
          Resume
        </button>
      </div>
    </div>
  );
}

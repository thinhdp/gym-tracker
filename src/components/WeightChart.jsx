import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { loadLS } from '../lib/storage';

/**
 * Scrollable line chart for displaying body‑weight logs.  The chart renders a
 * maximum of two weeks (14 days) at a time and provides navigation
 * controls to move forward or backward in the historical data.  When
 * mounted without explicit props, the component reads the weight logs
 * from localStorage under the `weightLogs` key, which is the same
 * structure used elsewhere in the app to persist weight entries【840933310584735†L56-L60】.
 *
 * Example weightLogs structure:
 * {
 *   "2025-09-21": 70.5,
 *   "2025-09-22": 70.3,
 *   ...
 * }
 *
 * Props:
 *   logs (optional) – a plain object mapping ISO date strings to
 *   numeric weights.  If omitted, data is loaded from localStorage.
 */
export default function WeightChart({ logs, view = 'daily' }) {
  // Read weight logs from props or localStorage
  const rawLogs = logs || loadLS('weightLogs', {});

  /**
   * Normalize the weight data.  Depending on the `view` prop, this
   * function either returns daily entries (sorted ascending) or
   * aggregates data by month.  Monthly data is computed by grouping
   * all entries with the same `YYYY‑MM` prefix and averaging their
   * weights.  The returned array is sorted chronologically.
   */
  const weightData = useMemo(() => {
    const entries = Object.keys(rawLogs).sort();
    if (view === 'monthly') {
      const byMonth = {};
      entries.forEach((date) => {
        const month = date.slice(0, 7); // YYYY-MM
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(rawLogs[date]);
      });
      return Object.keys(byMonth)
        .sort()
        .map((month) => {
          const weights = byMonth[month];
          const avg =
            weights.reduce((sum, w) => sum + w, 0) /
            (weights.length || 1);
          return { date: month, weight: parseFloat(avg.toFixed(2)) };
        });
    }
    // Daily view: just map to date/weight pairs
    return entries.map((date) => ({ date, weight: rawLogs[date] }));
  }, [rawLogs, view]);

  // Determine page size based on view: two weeks for daily, 12 months for monthly
  const PAGE_SIZE = view === 'monthly' ? 12 : 14;
  const [startIndex, setStartIndex] = useState(
    Math.max(0, weightData.length - PAGE_SIZE)
  );

  // Compute the slice of data to display on the current page
  const displayedData = useMemo(() => {
    return weightData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [weightData, startIndex]);

  // Determine whether navigation buttons should be disabled
  const canGoPrev = startIndex > 0;
  const canGoNext = startIndex + PAGE_SIZE < weightData.length;

  return (
    <div>
      {/* Scrollable chart wrapper: sets the width based on the number of entries */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ width: `${Math.max(displayedData.length, PAGE_SIZE) * 60}px`, height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayedData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#3b82f6" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Navigation controls for paging through the data */}
      <div className="flex justify-between items-center mt-2 space-x-4">
        <button
          onClick={() => setStartIndex((prev) => Math.max(0, prev - PAGE_SIZE))}
          disabled={!canGoPrev}
          className={`px-3 py-1 border rounded ${canGoPrev ? 'bg-white hover:bg-gray-100' : 'bg-gray-200 cursor-not-allowed'}`}
        >
          ◀ Previous
        </button>
        <button
          onClick={() => setStartIndex((prev) => Math.min(prev + PAGE_SIZE, Math.max(0, weightData.length - PAGE_SIZE)))}
          disabled={!canGoNext}
          className={`px-3 py-1 border rounded ${canGoNext ? 'bg-white hover:bg-gray-100' : 'bg-gray-200 cursor-not-allowed'}`}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
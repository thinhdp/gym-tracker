import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { loadLS } from '../lib/storage';

/**
 * Scrollable line chart for displaying body‑weight logs. The chart
 * renders a maximum of two weeks (14 days) at a time in daily mode
 * or twelve weeks in weekly mode. The most recent data points are
 * shown, and the container scrolls horizontally when there are
 * fewer data points than the page size. There are no explicit
 * navigation buttons; users can simply swipe or scroll sideways.
 *
 * Props:
 *   logs (optional) – a plain object mapping ISO date strings to
 *   numeric weights. If omitted, data is loaded from localStorage.
 *   view – "daily" or "weekly" to determine aggregation.
 */
export default function WeightChart({ logs, view = 'daily' }) {
  // Read weight logs from props or localStorage
  const rawLogs = logs || loadLS('weightLogs', {});

  // Helper to compute Monday as the start of week
  const startOfWeekMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diffToMon);
    return d;
  };

  // Normalize the weight data based on view
  const weightData = useMemo(() => {
    const entries = Object.keys(rawLogs).sort();
    if (view === 'weekly') {
      // Group entries by the start of their week and average
      const byWeek = {};
      entries.forEach((date) => {
        const d = new Date(date + 'T00:00:00');
        const weekStart = startOfWeekMonday(d);
        const wkKey = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD
        if (!byWeek[wkKey]) byWeek[wkKey] = [];
        byWeek[wkKey].push(rawLogs[date]);
      });
      return Object.keys(byWeek)
        .sort()
        .map((wk) => {
          const weights = byWeek[wk];
          const avg =
            weights.reduce((sum, w) => sum + w, 0) /
            (weights.length || 1);
          return { date: wk, weight: parseFloat(avg.toFixed(2)) };
        });
    }
    // Daily view: just map to date/weight pairs
    return entries.map((date) => ({ date, weight: rawLogs[date] }));
  }, [rawLogs, view]);

  // Determine page size based on view: two weeks for daily, 12 weeks for weekly
  const PAGE_SIZE = view === 'weekly' ? 12 : 14;

  // Slice the most recent PAGE_SIZE entries
  const displayedData = useMemo(() => {
    if (!weightData.length) return [];
    return weightData.slice(Math.max(0, weightData.length - PAGE_SIZE));
  }, [weightData, PAGE_SIZE]);

  // Calculate container width; ensure it’s wide enough to show PAGE_SIZE slots
  const containerWidth = `${Math.max(displayedData.length, PAGE_SIZE) * 60}px`;

  return (
    <div>
      {/* Scrollable chart wrapper: sets the width based on the number of entries */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ width: containerWidth, height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayedData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

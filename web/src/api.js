// web/src/api.js
// Centralized helper for calling the Flask backend.

/**
 * Fetch dashboard data for the given date range.
 * Until the UI is refactored to consume metrics, this returns
 * ONLY the `records` array so existing components continue to work.
 */
export async function fetchDashboard(start, end) {
  const url = `/live-details?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  // Legacy shape (backend returns array)
  if (Array.isArray(data)) return data;

  // New shape: { metrics, records }
  return data.records;
}
"use client";

import { useState } from "react";

interface TimeRangeRow {
  id: number;
  start: string; // date string: YYYY-MM-DD
  end: string;
}

type CalcMode = "STATE_JAIL" | "TCJ_TDCJ";

// Get duration in whole days based on mode
function getDurationDays(row: TimeRangeRow, mode: CalcMode): number {
  if (!row.start || !row.end) return 0;

  const start = new Date(row.start);
  const end = new Date(row.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  const diffMs = Math.abs(end.getTime() - start.getTime());
  const dayMs = 1000 * 60 * 60 * 24;
  const baseDays = Math.floor(diffMs / dayMs);

  if (mode === "STATE_JAIL") {
    return baseDays > 0 ? baseDays : 0;
  }

  const withExtra = baseDays + 1;
  return withExtra > 0 ? withExtra : 0;
}

function formatDays(days: number): string {
  if (days <= 0) return "0 days";
  return days === 1 ? "1 day" : `${days} days`;
}

// The card with the calculator
function BacktimeCard() {
  const [rows, setRows] = useState<TimeRangeRow[]>([
    { id: Date.now(), start: "", end: "" },
  ]);
  const [mode, setMode] = useState<CalcMode>("STATE_JAIL");

  const totalDays = rows.reduce(
    (sum, row) => sum + getDurationDays(row, mode),
    0
  );

  function updateRow(id: number, field: "start" | "end", value: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), start: "", end: "" },
    ]);
  }

  // Remove the last row, but never remove the final remaining one (just clears it)
  function removeLastRow() {
    setRows((prev) => {
      if (prev.length <= 1) {
        return prev.map((row) => ({ ...row, start: "", end: "" }));
      }
      return prev.slice(0, -1);
    });
  }

  function handleClearAll() {
    setRows([{ id: Date.now() + Math.random(), start: "", end: "" }]);
  }

  return (
    <div
      className="
        relative w-full max-w-md
        rounded-xl border border-gray-200 bg-white shadow-md
        p-6 space-y-6
        text-xs
        transition-all duration-300
        flex flex-col items-center
      "
    >
      {/* Header row with title + clear button */}
      <div className="w-full flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-gray-900">
          Clerk Calculator
        </h3>

        <button
          type="button"
          onClick={handleClearAll}
          className="text-[11px] px-4 py-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          Clear
        </button>
      </div>

      {/* Mode toggle */}
      <div className="w-full flex justify-center mb-4">
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setMode("STATE_JAIL")}
            className={`px-5 py-2 rounded-md border text-[11px] whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
              mode === "STATE_JAIL"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm active:bg-gray-800"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
            }`}
          >
            State jail
          </button>
          <button
            type="button"
            onClick={() => setMode("TCJ_TDCJ")}
            className={`px-5 py-2 rounded-md border text-[11px] whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
              mode === "TCJ_TDCJ"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm active:bg-gray-800"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
            }`}
          >
            TCJ/TDCJ (+1 day)
          </button>
        </div>
      </div>

      {/* Rows – more space around and between date fields */}
      <div className="w-full mt-2 mb-4 space-y-5">
        {rows.map((row, index) => {
          const days = getDurationDays(row, mode);
          const display =
            row.start && row.end ? formatDays(days) : "—";

          const isLast = index === rows.length - 1;
          const isFirst = index === 0;
          const rowComplete = !!(row.start && row.end);

          // Buttons appear:
          // - when there's only one row AND that row is complete
          // - OR when there are multiple rows and this is the last one
          const showRowControls =
            (rows.length === 1 && isFirst && rowComplete) ||
            (rows.length > 1 && isLast);

          // tab order: start (row0) = 1, end (row0) = 2, start (row1) = 3, etc.
          const baseTabIndex = index * 2 + 1;

          return (
            <div key={row.id} className="space-y-3">
              {/* Date row */}
              <div className="flex flex-wrap items-center justify-center gap-5">
                <input
                  type="date"
                  value={row.start}
                  onChange={(e) =>
                    updateRow(row.id, "start", e.target.value)
                  }
                  tabIndex={baseTabIndex}
                  className="border rounded px-3 py-1.5 text-[11px] w-[9.5rem] text-center"
                />

                <input
                  type="date"
                  value={row.end}
                  onChange={(e) =>
                    updateRow(row.id, "end", e.target.value)
                  }
                  tabIndex={baseTabIndex + 1}
                  className="border rounded px-3 py-1.5 text-[11px] w-[9.5rem] text-center"
                />

                <span className="text-[11px] font-semibold px-1">=</span>

                <span className="min-w-[80px] text-[11px] font-medium text-center">
                  {display}
                </span>
              </div>

              {/* Row controls – only under the correct row based on rules above */}
              {showRowControls && (
                <div className="w-full flex justify-center mt-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={addRow}
                      tabIndex={rows.length * 2 + 1}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-[10px] hover:bg-gray-100 whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      + Add row
                    </button>
                    <button
                      type="button"
                      onClick={removeLastRow}
                      tabIndex={rows.length * 2 + 2}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-[10px] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      − Remove row
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Combined total */}
      <div className="w-full pt-3 border-t mt-4 flex flex-col items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-700 text-center">
          Combined total ({mode === "STATE_JAIL" ? "State jail" : "TCJ/TDCJ"})
        </span>
        <span className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-gray-900 text-white text-[11px] font-bold whitespace-nowrap">
          {formatDays(totalDays)}
        </span>
      </div>
    </div>
  );
}

// This wraps the card and centers it in the window
export default function BacktimeCalculator() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <BacktimeCard />
    </main>
  );
}

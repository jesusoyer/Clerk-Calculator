"use client";

import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";

interface TimeRangeRow {
  id: number;
  start: string; // short date string: flexible input, normalized to MM/DD/YY
  end: string;
}

type CalcMode = "STATE_JAIL" | "TCJ_TDCJ";

const STORAGE_KEY = "clerk-calculator-state-v1";

/**
 * Normalize whatever the user typed into MM/DD/YY when possible.
 */
function normalizeShortDateDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digitsOnly = trimmed.replace(/\D/g, "");

  // 1) Pure digits: MMDDYY
  if (digitsOnly.length === 6) {
    const mm = digitsOnly.slice(0, 2);
    const dd = digitsOnly.slice(2, 4);
    const yy = digitsOnly.slice(4, 6);
    return `${mm}/${dd}/${yy}`;
  }

  // 2) Pure digits: MMDDYYYY
  if (digitsOnly.length === 8) {
    const mm = digitsOnly.slice(0, 2);
    const dd = digitsOnly.slice(2, 4);
    const yy = digitsOnly.slice(6, 8); // last two digits of year
    return `${mm}/${dd}/${yy}`;
  }

  // 3) Slashed patterns: M/D/YY, MM/DD/YYYY, etc.
  const match = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(trimmed);
  if (match) {
    let [, mm, dd, yy] = match;
    const mmNorm = mm.padStart(2, "0");
    const ddNorm = dd.padStart(2, "0");
    if (yy.length === 4) {
      yy = yy.slice(2);
    }
    const yyNorm = yy.padStart(2, "0");
    return `${mmNorm}/${ddNorm}/${yyNorm}`;
  }

  return trimmed;
}

/**
 * Parse whatever's in the field into a Date, using the same normalization rules.
 */
function parseShortDate(input: string): Date | null {
  if (!input) return null;

  const normalized = normalizeShortDateDisplay(input);
  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(normalized);
  if (!match) return null;

  const [, mmStr, ddStr, yyStr] = match;
  const month = Number(mmStr);
  const day = Number(ddStr);
  const yy = Number(yyStr);

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const fullYear = 2000 + yy; // 06 → 2006
  const date = new Date(fullYear, month - 1, day);

  // sanity check so 02/31/25 doesn't roll into March
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

// Get duration in whole days based on mode
function getDurationDays(row: TimeRangeRow, mode: CalcMode): number {
  if (!row.start || !row.end) return 0;

  const start = parseShortDate(row.start);
  const end = parseShortDate(row.end);

  if (!start || !end) return 0;

  const diffMs = Math.abs(end.getTime() - start.getTime());
  const dayMs = 1000 * 60 * 60 * 24;
  const baseDays = Math.floor(diffMs / dayMs);

  if (mode === "STATE_JAIL") {
    return baseDays > 0 ? baseDays : 0;
  }

  const withExtra = baseDays + 1;
  return withExtra > 0 ? withExtra : 0;
}

// With commas + singular/plural
function formatDays(days: number): string {
  if (days <= 0) return "0 days";

  const label = days === 1 ? "day" : "days";
  const withCommas = days.toLocaleString("en-US"); // 1000 → "1,000"

  return `${withCommas} ${label}`;
}

// The card with the calculator
function BacktimeCard() {
  const [rows, setRows] = useState<TimeRangeRow[]>([
    { id: Date.now(), start: "", end: "" },
  ]);
  const [mode, setMode] = useState<CalcMode>("STATE_JAIL");
  const [copied, setCopied] = useState(false);

  // Refs so we can focus specific fields on Enter/Tab
  const startRefs = useRef<Array<HTMLInputElement | null>>([]);
  const endRefs = useRef<Array<HTMLInputElement | null>>([]);

  // ---- Load from localStorage on mount ----
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        rows?: TimeRangeRow[];
        mode?: CalcMode;
      };

      if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        // Ensure each row has id/start/end
        const safeRows = parsed.rows.map((row) => ({
          id: row.id ?? Date.now() + Math.random(),
          start: row.start ?? "",
          end: row.end ?? "",
        }));
        setRows(safeRows);
      }

      if (parsed.mode === "STATE_JAIL" || parsed.mode === "TCJ_TDCJ") {
        setMode(parsed.mode);
      }
    } catch {
      // If anything goes wrong, just ignore and use defaults
    }
  }, []);

  // ---- Save to localStorage whenever rows or mode change ----
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const payload = JSON.stringify({ rows, mode });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // ignore storage errors
    }
  }, [rows, mode]);

  const totalDays = rows.reduce(
    (sum, row) => sum + getDurationDays(row, mode),
    0
  );

  // Build combined expression like:
  // (start - end) + (start2 - end2) = X days
  const rangeParts: string[] = [];
  rows.forEach((row) => {
    const startDate = parseShortDate(row.start);
    const endDate = parseShortDate(row.end);
    if (!startDate || !endDate) return;

    const startStr = normalizeShortDateDisplay(row.start);
    const endStr = normalizeShortDateDisplay(row.end);

    rangeParts.push(`(${startStr} - ${endStr})`);
  });

  const combinedExpression =
    rangeParts.length > 0
      ? `${rangeParts.join(" + ")} = ${formatDays(totalDays)}`
      : "";

  function updateRow(id: number, field: "start" | "end", rawValue: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: rawValue } : row
      )
    );
  }

  // On blur, normalize what's in the field to MM/DD/YY when possible
  function normalizeRowField(id: number, field: "start" | "end") {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const normalized = normalizeShortDateDisplay(row[field]);
        return { ...row, [field]: normalized };
      })
    );
  }

  function addRowAndFocusNext() {
    setRows((prev) => {
      const newRows = [
        ...prev,
        { id: Date.now() + Math.random(), start: "", end: "" },
      ];
      const newIndex = newRows.length - 1;

      setTimeout(() => {
        const el = startRefs.current[newIndex];
        if (el) el.focus();
      }, 0);

      return newRows;
    });
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
    const fresh = [{ id: Date.now() + Math.random(), start: "", end: "" }];
    setRows(fresh);
    setMode("STATE_JAIL");
    setCopied(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  // Enter behavior on START field: go to end field (same row)
  function handleStartKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      const end = endRefs.current[rowIndex];
      if (end) end.focus();
    }
  }

  // Enter/Tab behavior on END field
  function handleEndKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number
  ) {
    const isLastRow = rowIndex === rows.length - 1;

    if (e.key === "Enter") {
      e.preventDefault();

      if (isLastRow) {
        addRowAndFocusNext();
      } else {
        const nextStart = startRefs.current[rowIndex + 1];
        if (nextStart) nextStart.focus();
      }
    }

    if (e.key === "Tab" && isLastRow && !e.shiftKey) {
      e.preventDefault();
      addRowAndFocusNext();
    }
  }

  // Copy expression to clipboard
  async function handleCopyExpression() {
    if (!combinedExpression) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(combinedExpression);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = combinedExpression;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore for now
    }
  }

  return (
    <div
      className="
        relative w-full max-w-lg
        rounded-xl border border-gray-200 bg-white shadow-md
        p-4 sm:p-6 space-y-6
        text-xs
        transition-all duration-300
        flex flex-col items-center
      "
    >
      {/* Mode toggle + Clear on the same line (stack on mobile) */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Left: mode buttons */}
        <div className="flex flex-wrap justify-start gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMode("STATE_JAIL")}
            className={`px-4 sm:px-5 py-2 rounded-md border text-[12px] font-semibold whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
              mode === "STATE_JAIL"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm active:bg-gray-800"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
            }`}
          >
            State jail
          </button>
          <button
            type="button"
            onClick={() => setMode("TCJ_TDCJ")}
            className={`px-4 sm:px-5 py-2 rounded-md border text-[12px] font-semibold whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
              mode === "TCJ_TDCJ"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm active:bg-gray-800"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
            }`}
          >
            TCJ/TDCJ/ACOP
          </button>
        </div>

        {/* Right: Clear button – faded red base, redder on hover/active */}
        <div className="flex sm:justify-end">
          <button
            type="button"
            onClick={handleClearAll}
            className="
              px-4 sm:px-5 py-2 rounded-md border text-[12px] font-semibold whitespace-nowrap
              bg-red-100 text-red-700 border-red-200
              hover:bg-red-400 hover:text-white hover:border-red-400
              active:bg-red-500 active:border-red-500
              transition active:scale-95
              focus:outline-none focus:ring-1 focus:ring-red-200
            "
          >
            Clear
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="w-full mt-2 mb-4 space-y-5">
        {rows.map((row, index) => {
          const days = getDurationDays(row, mode);
          const display =
            row.start && row.end ? formatDays(days) : "—";

          const isLast = index === rows.length - 1;
          const isFirst = index === 0;
          const rowComplete = !!(row.start && row.end);

          const showRowControls =
            (rows.length === 1 && isFirst && rowComplete) ||
            (rows.length > 1 && isLast);

          const baseTabIndex = index * 2 + 1;

          return (
            <div key={row.id} className="space-y-3">
              {/* Date row – stack on mobile, inline on larger screens */}
              <div className="flex flex-col sm:flex-row sm:flex-nowrap items-center justify-center gap-2 sm:gap-3">
                {/* Date Range Field 1 */}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YY"
                  value={row.start}
                  onChange={(e) =>
                    updateRow(row.id, "start", e.target.value)
                  }
                  onBlur={() => normalizeRowField(row.id, "start")}
                  onKeyDown={(e) => handleStartKeyDown(e, index)}
                  tabIndex={baseTabIndex}
                  ref={(el) => {
                    startRefs.current[index] = el;
                  }}
                  className="border rounded px-3 py-1.5 text-[11px] w-full sm:w-[9.5rem] text-center font-mono placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
                />

                {/* Date Range Field 2 */}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YY"
                  value={row.end}
                  onChange={(e) =>
                    updateRow(row.id, "end", e.target.value)
                  }
                  onBlur={() => normalizeRowField(row.id, "end")}
                  onKeyDown={(e) => handleEndKeyDown(e, index)}
                  tabIndex={baseTabIndex + 1}
                  ref={(el) => {
                    endRefs.current[index] = el;
                  }}
                  className="border rounded px-3 py-1.5 text-[11px] w-full sm:w-[9.5rem] text-center font-mono placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
                />

                {/* = number of days */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-gray-700">
                    =
                  </span>
                  <span className="min-w-[70px] text-[11px] font-semibold text-gray-900 text-center">
                    {display}
                  </span>
                </div>
              </div>

              {/* Row controls */}
              {showRowControls && (
                <div className="w-full flex justify-center mt-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={addRow}
                      tabIndex={rows.length * 2 + 1}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-[11px] font-semibold text-gray-900 bg-white hover:bg-gray-100 whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      + Add row
                    </button>
                    <button
                      type="button"
                      onClick={removeLastRow}
                      tabIndex={rows.length * 2 + 2}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-[11px] font-semibold text-gray-900 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
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

      {/* Combined total + expression */}
      <div className="w-full pt-3 border-t border-gray-100 mt-4 flex flex-col items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-700 text-center px-2">
          Combined total (
          {mode === "STATE_JAIL" ? "State jail" : "TCJ/TDCJ/ACOP"})
        </span>
        <span className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-gray-900 text-white text-[13px] font-semibold whitespace-nowrap">
          {formatDays(totalDays)}
        </span>

        {/* Combined range expression + copy button */}
        {combinedExpression && (
          <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-2 text-center">
            <span className="text-[12px] text-gray-900 font-semibold">
              {combinedExpression}
            </span>
            <button
              type="button"
              onClick={handleCopyExpression}
              className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-[11px] font-semibold text-gray-900 hover:bg-gray-100 active:scale-95 transition focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// This wraps the card and centers it in the window
export default function BacktimeCalculator() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-3 sm:px-4">
      <BacktimeCard />
    </main>
  );
}

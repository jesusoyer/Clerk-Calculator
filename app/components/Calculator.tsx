// components/Calculator.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { KeyboardEvent } from "react";
import SavedCalculationsPanel, {
  SavedCalculationSummary,
} from "./SavedCalculations";

interface TimeRangeRow {
  id: number;
  start: string; // short date string: flexible input, normalized to MM/DD/YY
  end: string;
}

type CalcMode = "STATE_JAIL" | "TCJ_TDCJ";

interface SavedCalculation {
  label: string;
  rows: TimeRangeRow[];
  mode: CalcMode;
  createdAt: number;
}

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
    const yy = digitsOnly.slice(6, 8);
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

  const fullYear = 2000 + yy;
  const date = new Date(fullYear, month - 1, day);

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

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

function formatDays(days: number): string {
  if (days <= 0) return "0 days";
  const label = days === 1 ? "day" : "days";
  const withCommas = days.toLocaleString("en-US");
  return `${withCommas} ${label}`;
}

function BacktimeCard() {
  const [rows, setRows] = useState<TimeRangeRow[]>([
    { id: Date.now(), start: "", end: "" },
  ]);
  const [mode, setMode] = useState<CalcMode>("STATE_JAIL");
  const [copied, setCopied] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>(
    []
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saved list UI state
  const [savedOpen, setSavedOpen] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null); // null = current live calc

  // Snapshot of the "current" calc when you first open a saved one
  const liveStateRef = useRef<{
    rows: TimeRangeRow[];
    mode: CalcMode;
    identifier: string;
  } | null>(null);

  const startRefs = useRef<Array<HTMLInputElement | null>>([]);
  const endRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        rows?: TimeRangeRow[];
        mode?: CalcMode;
        identifier?: string;
        savedCalculations?: any[];
      };

      if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
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

      if (typeof parsed.identifier === "string") {
        setIdentifier(parsed.identifier);
      }

      if (Array.isArray(parsed.savedCalculations)) {
        const safeSaved: SavedCalculation[] = parsed.savedCalculations.map(
          (c: any) => ({
            label: String(c.label ?? "Unnamed"),
            rows: Array.isArray(c.rows) ? c.rows : [],
            mode: c.mode === "TCJ_TDCJ" ? "TCJ_TDCJ" : "STATE_JAIL",
            createdAt:
              typeof c.createdAt === "number" ? c.createdAt : Date.now(),
          })
        );
        setSavedCalculations(safeSaved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const payload = JSON.stringify({
        rows,
        mode,
        identifier,
        savedCalculations,
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // ignore
    }
  }, [rows, mode, identifier, savedCalculations]);

  // Cleanup banner timeout on unmount
  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  const totalDays = rows.reduce(
    (sum, row) => sum + getDurationDays(row, mode),
    0
  );

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

  function removeLastRow() {
    setRows((prev) => {
      if (prev.length <= 1) {
        return prev.map((row) => ({ ...row, start: "", end: "" }));
      }
      return prev.slice(0, -1);
    });
  }

  const handleClearAll = useCallback(() => {
    const fresh = [{ id: Date.now() + Math.random(), start: "", end: "" }];
    setRows(fresh);
    setMode("STATE_JAIL");
    setCopied(false);
    setIdentifier("");
    setSaveError(null);
    setSaveBanner(null);
    setActiveSavedId(null);
    liveStateRef.current = null;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  // Keyboard shortcut: Ctrl+0 / Cmd+0 to clear
  useEffect(() => {
    function onKeyDown(e: any) {
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleClearAll();
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [handleClearAll]);

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

  async function handleCopyExpression() {
    if (!combinedExpression) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(combinedExpression);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = combinedExpression;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function handleSaveCurrent() {
    setSaveError(null);

    if (!combinedExpression || totalDays <= 0) {
      setSaveError("You need at least one valid date range to save.");
      return;
    }

    const trimmed = identifier.trim();
    const existingLabels = savedCalculations.map((c) => c.label);

    let label = trimmed || "Calculation 1";
    if (!trimmed) {
      let n = 1;
      while (existingLabels.includes(`Calculation ${n}`)) {
        n += 1;
      }
      label = `Calculation ${n}`;
    }

    const duplicate = savedCalculations.some(
      (c) => c.label.toLowerCase() === label.toLowerCase()
    );
    if (duplicate) {
      setSaveError("That identifier is already used. Please choose another.");
      return;
    }

    const snapshotRows = rows.map((r) => ({ ...r }));
    const now = Date.now();
    const next: SavedCalculation[] = [
      ...savedCalculations,
      { label, rows: snapshotRows, mode, createdAt: now },
    ];
    setSavedCalculations(next);
    setSaveError(null);

    const message = `The calculation was saved as "${label}"`;
    setSaveBanner(message);

    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setSaveBanner(null);
    }, 3000);

    // Open the list once there's something to show
    setSavedOpen(true);
  }

  // Handle selecting an item from SavedCalculations
  function handleSelectSaved(id: string | null) {
    if (id === null) {
      // "Current calculation"
      setActiveSavedId(null);
      if (liveStateRef.current) {
        setRows(liveStateRef.current.rows);
        setMode(liveStateRef.current.mode);
        setIdentifier(liveStateRef.current.identifier);
      }
      return;
    }

    const found = savedCalculations.find((c) => c.label === id);
    if (!found) return;

    // On first switch away from live state, remember it
    if (activeSavedId === null) {
      liveStateRef.current = {
        rows,
        mode,
        identifier,
      };
    }

    setActiveSavedId(id);
    setRows(found.rows.map((r) => ({ ...r })));
    setMode(found.mode);
    setIdentifier(found.label);
  }

  function handleDeleteSaved(id: string) {
    setSavedCalculations((prev) => prev.filter((c) => c.label !== id));

    if (activeSavedId === id) {
      setActiveSavedId(null);
      if (liveStateRef.current) {
        setRows(liveStateRef.current.rows);
        setMode(liveStateRef.current.mode);
        setIdentifier(liveStateRef.current.identifier);
      } else {
        handleClearAll();
      }
    }
  }

  const savedSummaries: SavedCalculationSummary[] = savedCalculations.map(
    (c) => ({
      id: c.label,
      createdAt: c.createdAt,
    })
  );

  return (
    <div className="w-full max-w-5xl flex flex-col md:flex-row gap-4 items-start justify-center">
      {/* Left: Saved Calculations panel */}
      <SavedCalculationsPanel
        items={savedSummaries}
        isOpen={savedOpen}
        activeId={activeSavedId}
        onToggleOpen={() => setSavedOpen((prev) => !prev)}
        onSelect={handleSelectSaved}
        onDelete={handleDeleteSaved}
      />

      {/* Right: Calculator card */}
      <div
        className="
          relative w-full md:max-w-lg
          rounded-xl border border-gray-200 bg-white shadow-md
          p-4 sm:p-6 space-y-6
          text-xs
          transition-all duration-300
          flex flex-col items-center
        "
      >
        {/* Success banner directly above the card body */}
        {saveBanner && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] shadow-sm">
            {saveBanner}
          </div>
        )}

        {/* Identifier */}
        <div className="w-full mb-2 flex flex-col items-center">
          <label className="block text-[11px] font-semibold text-gray-700 mb-1 text-center">
            Identifier (optional)
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setSaveError(null);
            }}
            placeholder='e.g. "Smith cause #1234"'
            className="w-full sm:w-72 max-w-xs border rounded px-3 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
          />
          {saveError && (
            <p className="mt-1 text-[11px] text-red-600 text-center">
              {saveError}
            </p>
          )}
        </div>

        {/* Mode toggle – centered, removed from tab order */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 mb-4">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setMode("STATE_JAIL")}
              className={`px-4 sm:px-5 py-2 rounded-md border text-[12px] font-semibold whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
                mode === "STATE_JAIL"
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm active:bg-gray-800"
                  : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
              }`}
            >
              STATE JAIL
            </button>
            <button
              type="button"
              tabIndex={-1}
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

            return (
              <div key={row.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:flex-nowrap items-center justify-center gap-2 sm:gap-3">
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
                    ref={(el) => {
                      startRefs.current[index] = el;
                    }}
                    className="border rounded px-3 py-1.5 text-[11px] w-full sm:w-[9.5rem] text-center font-mono placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
                  />

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
                    ref={(el) => {
                      endRefs.current[index] = el;
                    }}
                    className="border rounded px-3 py-1.5 text-[11px] w-full sm:w-[9.5rem] text-center font-mono placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
                  />

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-gray-700">
                      =
                    </span>
                    <span className="min-w-[70px] text-[11px] font-semibold text-gray-900 text-center">
                      {display}
                    </span>
                  </div>
                </div>

                {showRowControls && (
                  <div className="w-full flex justify-center mt-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={addRow}
                        className="px-3 py-1.5 rounded-md border border-gray-300 text-[11px] font-semibold text-gray-900 bg-white hover:bg-gray-100 whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      >
                        + Add row
                      </button>
                      <button
                        type="button"
                        onClick={removeLastRow}
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

        {/* Save + Clear row */}
        <div className="w-full flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={handleSaveCurrent}
            className="
              px-4 sm:px-5 py-2 rounded-md border text-[12px] font-semibold whitespace-nowrap
              bg-amber-50 text-amber-800 border-amber-200
              hover:bg-amber-200 hover:border-amber-300
              active:bg-amber-300 active:border-amber-400
              transition active:scale-95
              focus:outline-none focus:ring-1 focus:ring-amber-200
            "
          >
            Save
          </button>
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

        {/* Combined total + expression */}
        <div className="w-full pt-3 border-t border-gray-100 mt-4 flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-700 text-center px-2">
            Combined total (
            {mode === "STATE_JAIL" ? "State jail" : "TCJ/TDCJ/ACOP"})
          </span>
          <span className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-gray-900 text-white text-[13px] font-semibold whitespace-nowrap">
            {formatDays(totalDays)}
          </span>

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
    </div>
  );
}

export default function Calculator() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-3 sm:px-4">
      <BacktimeCard />
    </main>
  );
}

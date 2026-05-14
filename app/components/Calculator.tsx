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
type ViewMode = "BACKTIME" | "DATE_ADJUST";

interface SavedCalculation {
  label: string;
  rows: TimeRangeRow[];
  mode: CalcMode;
  createdAt: number;
}

type DateAdjustDirection = "add" | "subtract";

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

/**
 * Parse MM/DD/YY into a Date using a sliding 100-year window ending at the current year.
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

  const currentYear = new Date().getFullYear();
  const pivot = currentYear % 100;

  // Sliding window: last 100 years, ending at currentYear
  const fullYear = yy <= pivot ? 2000 + yy : 1900 + yy;

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

/** Format a Date as MM/DD/YYYY */
function formatDateFullYear(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a Date as "Wednesday, January 1, 2025" */
function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Helper to decide if an input should be treated as an invalid date */
function isInvalidDateInput(value: string): boolean {
  if (!value) return false; // don't show error on empty

  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Only start validating once it "looks" like a full date
  const looksComplete =
    digitsOnly.length === 6 ||
    digitsOnly.length === 8 ||
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed);

  if (!looksComplete) return false;

  return parseShortDate(value) === null;
}

/** ✅ Duration between two dates, using UTC to avoid DST off-by-one */
function getDurationDays(row: TimeRangeRow, mode: CalcMode): number {
  if (!row.start || !row.end) return 0;

  const start = parseShortDate(row.start);
  const end = parseShortDate(row.end);
  if (!start || !end) return 0;

  const dayMs = 1000 * 60 * 60 * 24;

  const startUTC = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endUTC = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  const diffMs = Math.abs(endUTC - startUTC);
  const baseDays = Math.round(diffMs / dayMs);

  if (mode === "STATE_JAIL") {
    // exclusive
    return baseDays > 0 ? baseDays : 0;
  }

  // inclusive
  const withExtra = baseDays + 1;
  return withExtra > 0 ? withExtra : 0;
}

function formatDays(days: number): string {
  if (days <= 0) return "0 days";
  const label = days === 1 ? "day" : "days";
  const withCommas = days.toLocaleString("en-US");
  return `${withCommas} ${label}`;
}

/** 🗓️ Format today's date as MM/DD/YY */
function formatTodayShort(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}

/** 📅 Second calculator: date adjust (add/subtract days/weeks/months/years) */
function DateAdjustCalculator() {
  const [baseDate, setBaseDate] = useState("");
  const [direction, setDirection] = useState<DateAdjustDirection>("add");
  const [days, setDays] = useState("0");
  const [weeks, setWeeks] = useState("0");
  const [months, setMonths] = useState("0");
  const [years, setYears] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    from: string;
    operation: string;
    result: string;
  } | null>(null);

  const handleFillTodayBase = () => {
    const today = formatTodayShort();
    setBaseDate(today);
    setError(null);
  };

  const handleClear = () => {
    setBaseDate("");
    setDirection("add");
    setDays("0");
    setWeeks("0");
    setMonths("0");
    setYears("0");
    setError(null);
    setResult(null);
  };

  // Ctrl/Cmd + 0 clears the date-adjust calculator
  useEffect(() => {
    function onKeyDown(e: any) {
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleClear();
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  const handleCalculate = () => {
    setError(null);
    setResult(null);

    const date = parseShortDate(baseDate);
    if (!date) {
      setError("Please enter a valid base date in MM/DD/YY format.");
      return;
    }

    const d =
      Number.isFinite(Number(days)) && Number(days) >= 0
        ? Math.floor(Number(days))
        : 0;
    const w =
      Number.isFinite(Number(weeks)) && Number(weeks) >= 0
        ? Math.floor(Number(weeks))
        : 0;
    const m =
      Number.isFinite(Number(months)) && Number(months) >= 0
        ? Math.floor(Number(months))
        : 0;
    const y =
      Number.isFinite(Number(years)) && Number(years) >= 0
        ? Math.floor(Number(years))
        : 0;

    const sign = direction === "add" ? 1 : -1;

    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (d !== 0) {
      target.setDate(target.getDate() + sign * d);
    }
    if (w !== 0) {
      target.setDate(target.getDate() + sign * (w * 7));
    }
    if (m !== 0) {
      target.setMonth(target.getMonth() + sign * m);
    }
    if (y !== 0) {
      target.setFullYear(target.getFullYear() + sign * y);
    }

    const fromStr = `From ${formatLongDate(date)}`;

    const parts: string[] = [];
    if (d) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
    if (w) parts.push(`${w} ${w === 1 ? "week" : "weeks"}`);
    if (m) parts.push(`${m} ${m === 1 ? "month" : "months"}`);
    if (y) parts.push(`${y} ${y === 1 ? "year" : "years"}`);

    const verb = direction === "add" ? "Added" : "Subtracted";
    const opStr =
      parts.length > 0
        ? `${verb} ${parts.join(", ")}`
        : `${verb} 0 days`;

    const resultStr = `Result: ${formatLongDate(target)}`;

    setResult({
      from: fromStr,
      operation: opStr,
      result: resultStr,
    });
  };

  // Shared Enter handler for days/weeks/months/years inputs
  const handleAmountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCalculate();
    }
  };

  return (
    // Full-width inside the shared card
    <div className="w-full flex flex-col items-center px-6 py-6">
      <div className="w-full space-y-5">
        {/* Single row: base date, +/- and days/weeks/months/years */}
        <div className="w-full flex flex-wrap md:flex-nowrap items-end justify-center gap-5">
          {/* Base date (smaller) */}
          <div className="flex flex-col items-center">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Base date
            </label>
            <div className="relative w-32 sm:w-40">
              <button
                type="button"
                onClick={handleFillTodayBase}
                className="
                  absolute left-1.5 top-1/2 -translate-y-1/2
                  px-2 py-0.5 rounded border
                  text-xs text-gray-700
                  bg-gray-100 hover:bg-gray-200
                  focus:outline-none focus:ring-1 focus:ring-gray-300
                "
              >
                Today
              </button>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/DD/YY"
                value={baseDate}
                onChange={(e) => {
                  setBaseDate(e.target.value);
                  setError(null);
                }}
                onBlur={() =>
                  setBaseDate((prev) => normalizeShortDateDisplay(prev))
                }
                className="
                  border rounded pl-12 pr-3 py-2
                  text-sm w-full text-center font-mono text-gray-900
                  placeholder:text-gray-700
                  focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
                "
              />
            </div>
          </div>

          {/* plus/minus toggle */}
          <div className="flex flex-col items-center">
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Operators
            </span>
            <div className="inline-flex rounded-md border border-gray-200 bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`px-3.5 py-1.5 text-sm font-semibold rounded ${
                  direction === "add"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setDirection("subtract")}
                className={`px-3.5 py-1.5 text-sm font-semibold rounded ${
                  direction === "subtract"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                −
              </button>
            </div>
          </div>

          {/* Days */}
          <div className="flex flex-col items-center">
            <label className="block text-sm text-gray-700 mb-1.5">
              Days
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              className="
                w-20 border rounded px-3 py-2
                text-sm text-center
                focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
              "
            />
          </div>

          {/* Weeks */}
          <div className="flex flex-col items-center">
            <label className="block text-sm text-gray-700 mb-1.5">
              Weeks
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              className="
                w-20 border rounded px-3 py-2
                text-sm text-center
                focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
              "
            />
          </div>

          {/* Months */}
          <div className="flex flex-col items-center">
            <label className="block text-sm text-gray-700 mb-1.5">
              Months
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              className="
                w-20 border rounded px-3 py-2
                text-sm text-center
                focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
              "
            />
          </div>

          {/* Years */}
          <div className="flex flex-col items-center">
            <label className="block text-sm text-gray-700 mb-1.5">
              Years
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              className="
                w-20 border rounded px-3 py-2
                text-sm text-center
                focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
              "
            />
          </div>
        </div>

        {/* Buttons below */}
        <div className="w-full flex justify-center gap-4 mt-3">
          <button
            type="button"
            onClick={handleClear}
            className="
              px-4 py-2 rounded-md border text-sm font-semibold whitespace-nowrap
              bg-red-100 text-red-700 border-red-200
              hover:bg-red-400 hover:text-white hover:border-red-400
              active:bg-red-500 active:border-red-500
              transition active:scale-95
              focus:outline-none focus:ring-1 focus:ring-red-200
            "
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleCalculate}
            className="
              px-6 py-2 rounded-md border text-sm font-semibold whitespace-nowrap
              bg-gray-900 text-white border-gray-900
              hover:bg-gray-800
              active:bg-gray-950
              transition active:scale-95
              focus:outline-none focus:ring-1 focus:ring-gray-400
            "
          >
            Calculate
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 text-center mb-1.5">
            {error}
          </p>
        )}

        {/* Result */}
        {result && (
          <div className="mt-2 text-center text-sm text-gray-900">
            <p>{result.from}</p>
            <p className="mt-1">{result.operation}</p>
            <p className="mt-2 text-base font-semibold">{result.result}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- BacktimeCard and export ---------- */

function BacktimeCard() {
  const [rows, setRows] = useState<TimeRangeRow[]>([
    { id: Date.now(), start: "", end: "" },
  ]);
  const [mode, setMode] = useState<CalcMode>("STATE_JAIL");
  const [copied, setCopied] = useState(false);
  const [showRanges, setShowRanges] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("BACKTIME");

  const [identifier, setIdentifier] = useState("");
  const [savedCalculations, setSavedCalculations] =
    useState<SavedCalculation[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savedOpen, setSavedOpen] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  const liveStateRef = useRef<{
    rows: TimeRangeRow[];
    mode: CalcMode;
    identifier: string;
  } | null>(null);

  const startRefs = useRef<Array<HTMLInputElement | null>>([]);
  const endRefs = useRef<Array<HTMLInputElement | null>>([]);

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

    const startStr = formatDateFullYear(startDate);
    const endStr = formatDateFullYear(endDate);
    rangeParts.push(`(${startStr} - ${endStr})`);
  });

  const combinedExpression =
    rangeParts.length > 0
      ? `${rangeParts.join(" + ")} = ${formatDays(totalDays)}`
      : "";

  function updateRow(id: number, field: "start" | "end", rawValue: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: rawValue } : row))
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

  function handleEndKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number
  ) {
    const isLastRow = rowIndex === rows.length - 1;

    if (e.key === "Tab" && !e.shiftKey && isLastRow) {
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
      setTimeout(() => setCopied(false), 1000);
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

    setSavedOpen(true);
  }

  function handleUpdateCurrent() {
    if (activeSavedId === null) {
      handleSaveCurrent();
      return;
    }

    setSaveError(null);

    if (!combinedExpression || totalDays <= 0) {
      setSaveError("You need at least one valid date range to save.");
      return;
    }

    const trimmed = identifier.trim();
    const proposedLabel = trimmed || activeSavedId;

    const duplicate = savedCalculations.some(
      (c) =>
        c.label.toLowerCase() === proposedLabel.toLowerCase() &&
        c.label !== activeSavedId
    );
    if (duplicate) {
      setSaveError("That identifier is already used. Please choose another.");
      return;
    }

    const snapshotRows = rows.map((r) => ({ ...r }));

    const updated = savedCalculations.map((c) =>
      c.label === activeSavedId
        ? {
            ...c,
            label: proposedLabel,
            rows: snapshotRows,
            mode,
          }
        : c
    );

    setSavedCalculations(updated);
    setActiveSavedId(proposedLabel);

    const message = `The calculation "${proposedLabel}" was updated.`;
    setSaveBanner(message);

    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setSaveBanner(null);
    }, 3000);
  }

  function handleSelectSaved(id: string | null) {
    if (id === null) {
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

  // 🧹 NEW: Clear all saved calculations (does NOT clear current working calc)
  function handleClearSavedList() {
    setSavedCalculations([]);
    setSavedOpen(false);
    setActiveSavedId(null);
    liveStateRef.current = null;
  }

  const savedSummaries: SavedCalculationSummary[] = savedCalculations.map(
    (c) => ({
      id: c.label,
      createdAt: c.createdAt,
    })
  );

  const isEditingSaved = activeSavedId !== null;

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-start gap-4">
        {viewMode === "BACKTIME" && (
          <div className="w-full md:w-auto md:flex-shrink-0 flex flex-col gap-2">
            <SavedCalculationsPanel
              items={savedSummaries}
              isOpen={savedOpen}
              activeId={activeSavedId}
              onToggleOpen={() => setSavedOpen((prev) => !prev)}
              onSelect={handleSelectSaved}
              onDelete={handleDeleteSaved}
            />
            {savedCalculations.length > 0 && (
              <button
                type="button"
                onClick={handleClearSavedList}
                className="
                  self-start mt-1
                  px-3 py-1.5 rounded-md border border-gray-200
                  text-xs font-medium text-gray-600
                  bg-white hover:bg-gray-100
                  active:scale-95 transition
                  focus:outline-none focus:ring-1 focus:ring-gray-300
                "
              >
                Clear all saved
              </button>
            )}
          </div>
        )}

        <div className="w-full md:flex-1 flex justify-center md:justify-center">
          <div
            className="
              relative w-full md:max-w-2xl
              rounded-xl border border-gray-200 bg-white shadow-md
              p-6 sm:p-8 space-y-7
              text-sm
              transition-all duration-300
              flex flex-col items-center
            "
          >
            {saveBanner && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm shadow-sm">
                {saveBanner}
              </div>
            )}

            {/* Toggle: Clerk vs Date adjust */}
            <div className="w-full mb-4 flex justify-center">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("BACKTIME")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                    viewMode === "BACKTIME"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Clerk Calculator
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("DATE_ADJUST")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                    viewMode === "DATE_ADJUST"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Date adjust
                </button>
              </div>
            </div>

            {viewMode === "BACKTIME" ? (
              <>
                {/* Identifier */}
                <div className="w-full mb-3 flex flex-col items-center">
                  <label className="block text-sm font-semibold text-gray-700 mb-1 text-center">
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
                    className="w-full sm:w-80 max-w-xs border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500"
                  />
                  {saveError && (
                    <p className="mt-1 text-xs text-red-600 text-center">
                      {saveError}
                    </p>
                  )}
                </div>

                {/* Mode toggle */}
                <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 mb-5">
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setMode("STATE_JAIL")}
                      className={`px-5 sm:px-6 py-2.5 rounded-md border text-sm font-semibold whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
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
                      className={`px-5 sm:px-6 py-2.5 rounded-md border text-sm font-semibold whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-400 ${
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
                <div className="w-full mt-2 mb-5 space-y-6">
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

                    const startInvalid = isInvalidDateInput(row.start);
                    const endInvalid = isInvalidDateInput(row.end);

                    return (
                      <div key={row.id} className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:flex-nowrap items-center justify-center gap-3 sm:gap-4">
                          {/* Start date */}
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="MM/DD/YY"
                            value={row.start}
                            onChange={(e) =>
                              updateRow(row.id, "start", e.target.value)
                            }
                            onBlur={() =>
                              normalizeRowField(row.id, "start")
                            }
                            ref={(el) => {
                              startRefs.current[index] = el;
                            }}
                            className={`border rounded px-3 py-2 text-sm w-full sm:w-40 text-center font-mono text-gray-900 placeholder:text-gray-700 focus:outline-none focus:ring-1 ${
                              startInvalid
                                ? "border-red-400 focus:ring-red-400 focus:border-red-500"
                                : "border-gray-300 focus:ring-gray-400 focus:border-gray-500"
                            }`}
                          />

                          {/* End date with Today button */}
                          <div className="relative w-full sm:w-40">
                            <button
                              type="button"
                              onClick={() => {
                                const today = formatTodayShort();
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, end: today }
                                      : r
                                  )
                                );
                              }}
                              className="
                                absolute left-1.5 top-1/2 -translate-y-1/2
                                px-2 py-0.5 rounded border
                                text-xs text-gray-700
                                bg-gray-100 hover:bg-gray-200
                                focus:outline-none focus:ring-1 focus:ring-gray-300
                              "
                            >
                              Today
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="MM/DD/YY"
                              value={row.end}
                              onChange={(e) =>
                                updateRow(row.id, "end", e.target.value)
                              }
                              onBlur={() =>
                                normalizeRowField(row.id, "end")
                              }
                              onKeyDown={(e) =>
                                handleEndKeyDown(e, index)
                              }
                              ref={(el) => {
                                endRefs.current[index] = el;
                              }}
                              className={`border rounded pl-12 pr-3 py-2 text-sm w-full text-center font-mono text-gray-900 placeholder:text-gray-700 focus:outline-none focus:ring-1 ${
                                endInvalid
                                  ? "border-red-400 focus:ring-red-400 focus:border-red-500"
                                  : "border-gray-300 focus:ring-gray-400 focus:border-gray-500"
                              }`}
                            />
                          </div>

                          {/* Per-row total */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-700">
                              =
                            </span>
                            <span className="min-w-[80px] text-sm font-semibold text-gray-900 text-center">
                              {display}
                            </span>
                          </div>
                        </div>

                        {(startInvalid || endInvalid) && (
                          <p className="text-xs text-red-600 text-center">
                            Please enter a valid date in{" "}
                            <span className="font-semibold">MM/DD/YY</span>{" "}
                            format (e.g., 01/09/24). Single-digit months should
                            be written as 01–09.
                          </p>
                        )}

                        {showRowControls && (
                          <div className="w-full flex justify-center mt-2">
                            <div className="flex flex-wrap justify-center gap-3">
                              <button
                                type="button"
                                onClick={addRow}
                                className="px-3.5 py-2 rounded-md border border-gray-300 text-sm font-semibold text-gray-900 bg-white hover:bg-gray-100 whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
                              >
                                + Add row
                              </button>
                              <button
                                type="button"
                                onClick={removeLastRow}
                                className="px-3.5 py-2 rounded-md border border-gray-300 text-sm font-semibold text-gray-900 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-gray-300"
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

                {/* Save / Update + Clear row */}
                <div className="w-full flex justify-end gap-3 mt-1">
                  {isEditingSaved ? (
                    <button
                      type="button"
                      onClick={handleUpdateCurrent}
                      className="
                        px-4 sm:px-5 py-2.5 rounded-md border text.sm font-semibold whitespace-nowrap
                        bg-amber-50 text-amber-800 border-amber-200
                        hover:bg-amber-200 hover:border-amber-300
                        active:bg-amber-300 active:border-amber-400
                        transition active:scale-95
                        focus:outline-none focus:ring-1 focus:ring-amber-200
                      "
                    >
                      Update
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveCurrent}
                      className="
                        px-4 sm:px-5 py-2.5 rounded-md border text-sm font-semibold whitespace-nowrap
                        bg-amber-50 text-amber-800 border-amber-200
                        hover:bg-amber-200 hover:border-amber-300
                        active:bg-amber-300 active:border-amber-400
                        transition active:scale-95
                        focus:outline-none focus:ring-1 focus:ring-amber-200
                      "
                    >
                      Save
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="
                      px-4 sm:px-5 py-2.5 rounded-md border text-sm font-semibold whitespace-nowrap
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
                <div className="w-full pt-4 border-t border-gray-100 mt-5 flex flex-col items-center gap-2.5">
                  <span className="text-sm font-semibold text-gray-700 text-center px-2">
                    Combined total (
                    {mode === "STATE_JAIL"
                      ? "State jail"
                      : "TCJ/TDCJ/ACOP"}
                    )
                  </span>
                  <span className="inline-flex items-center justify-center px-7 py-2.5 rounded-full bg-gray-900 text-white text-base font-semibold whitespace-nowrap">
                    {formatDays(totalDays)}
                  </span>

                  {combinedExpression && (
                    <button
                      type="button"
                      onClick={() => setShowRanges((prev) => !prev)}
                      className="mt-1 text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted"
                    >
                      {showRanges ? "Hide ranges" : "Show ranges"}
                    </button>
                  )}

                  {combinedExpression && showRanges && (
                    <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-3 px-2 text-center">
                      <span className="text-sm text-gray-900 font-semibold">
                        {combinedExpression}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyExpression}
                        aria-label={
                          copied
                            ? "Ranges copied"
                            : "Copy ranges to clipboard"
                        }
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 active:scale-95 transition focus:outline-none focus:ring-1 focus:ring-gray-300 flex items-center justify-center"
                      >
                        {copied ? (
                          <span className="text-xs text-emerald-700 whitespace-nowrap">
                            Ranges copied
                          </span>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="11"
                              height="11"
                              rx="2"
                              ry="2"
                            />
                            <rect
                              x="4"
                              y="4"
                              width="11"
                              height="11"
                              rx="2"
                              ry="2"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <DateAdjustCalculator />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Calculator() {
  return <BacktimeCard />;
}

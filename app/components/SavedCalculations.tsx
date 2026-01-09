// components/SavedCalculations.tsx
"use client";

import React from "react";

export interface SavedCalculationSummary {
  id: string;        // label / identifier
  createdAt: number; // timestamp
}

interface SavedCalculationsProps {
  items: SavedCalculationSummary[];
  isOpen: boolean;
  activeId: string | null;          // null = "Current calculation"
  onToggleOpen: () => void;
  onSelect: (id: string | null) => void; // null selects current live calc
  onDelete: (id: string) => void;
}

export default function SavedCalculations({
  items,
  isOpen,
  activeId,
  onToggleOpen,
  onSelect,
  onDelete,
}: SavedCalculationsProps) {
  return (
    <aside className="w-full max-w-xs sm:max-w-[220px]">
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="
          w-full flex items-center justify-between
          rounded-md border border-gray-200 bg-white
          px-3 py-2 text-xs sm:text-sm font-semibold text-gray-800
          shadow-sm hover:bg-gray-50 active:scale-[0.98]
          transition
        "
      >
        <span>Saved calculations</span>
        <span className="ml-2 text-[10px] text-gray-500">
          {isOpen ? "Hide ▴" : "Show ▾"}
        </span>
      </button>

      {isOpen && (
        <div
          className="
            mt-2 rounded-md border border-gray-200 bg-white shadow-sm
            max-h-80 overflow-y-auto text-xs
          "
        >
          {/* "Current" row */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`
              w-full flex items-center justify-between px-3 py-2 border-b border-gray-100
              text-left hover:bg-gray-50 transition
              ${activeId === null ? "bg-gray-50 font-semibold" : ""}
            `}
          >
            <span>Current calculation</span>
            {activeId === null && (
              <span className="text-[10px] uppercase text-gray-500">
                ACTIVE
              </span>
            )}
          </button>

          {/* Saved items */}
          {items.length === 0 ? (
            <div className="px-3 py-3 text-gray-500 text-[11px]">
              No saved calculations yet. Use the{" "}
              <span className="font-semibold">Save</span> button in the
              calculator.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`
                  flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-gray-100
                  ${activeId === item.id ? "bg-amber-50" : "bg-white"}
                `}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="flex-1 text-left text-[11px] sm:text-xs hover:text-gray-900"
                >
                  <div className="font-semibold truncate">{item.id}</div>
                  <div className="text-[10px] text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="
                    ml-2 px-1.5 py-0.5 rounded
                    text-[10px] text-red-600
                    hover:bg-red-50 active:scale-95
                  "
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}

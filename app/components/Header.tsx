// components/Header.tsx
"use client";

import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: App title */}
        <span className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">
          Clerk Calculator
        </span>

        {/* Right: How to use dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="
              text-xs sm:text-sm font-medium
              px-3 py-1.5 rounded-md border border-gray-300
              bg-white text-gray-700
              hover:bg-gray-100 active:scale-95
              transition
              focus:outline-none focus:ring-1 focus:ring-gray-300
            "
          >
            How to use
          </button>

          {open && (
            <div
              className="
                absolute right-0 mt-2 w-64 sm:w-80
                rounded-lg border border-gray-200 bg-white shadow-lg
                p-3 sm:p-4 text-xs sm:text-sm text-gray-700 z-20
              "
            >
              <p className="mb-2">
                <span className="font-semibold">Basics:</span> Choose{" "}
                <span className="font-medium">State jail</span> or{" "}
                <span className="font-medium">TCJ/TDCJ/ACOP</span>, then enter
                your date ranges as <code>MM/DD/YY</code> or just 6–8 digits
                (e.g. <code>010125</code> → <code>01/01/25</code>).
              </p>
              <p className="mb-2">
                Use <span className="font-medium">Tab</span> or{" "}
                <span className="font-medium">Enter</span> to move between
                fields. When you’re on the last end date, pressing Enter will
                add a new row.
              </p>
              <p>
                The calculator shows the days for each range, a combined total
                at the bottom, and a text expression you can{" "}
                <span className="font-medium">Copy</span> into your paperwork.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

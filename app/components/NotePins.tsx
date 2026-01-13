// components/NotePins.tsx
"use client";

import { useState } from "react";
import type { NotePinItem } from "../page";

interface NotePinsProps {
  notes: NotePinItem[];
  onRemoveNote: (id: string) => void;
}

// Darker banner colors
const bannerClassMap: Record<NotePinItem["color"], string> = {
  yellow: "border-amber-400 bg-amber-100",
  green: "border-emerald-500 bg-emerald-100",
  red: "border-rose-500 bg-rose-100",
  blue: "border-sky-500 bg-sky-100",
  purple: "border-violet-500 bg-violet-100",
};

export default function NotePins({ notes, onRemoveNote }: NotePinsProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="w-full flex justify-center pt-1 pb-1">
      <div className="w-full max-w-5xl px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
            Pinned notes
          </span>

          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="text-[11px] text-gray-500 hover:text-gray-700 underline decoration-dotted"
            >
              {collapsed ? "Show notes" : "Hide notes"}
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="space-y-2 min-h-[96px]">
            {notes.length === 0 ? (
              <div
                className="
                  rounded-md border border-dashed border-amber-300 bg-amber-100/70
                  px-3 py-2 text-[11px] text-amber-900
                "
              >
                No pinned notes yet. Use the{" "}
                <span className="font-semibold">Add note</span> button in the
                header to pin up to 5 quick reminders.
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className={`
                    flex items-start justify-between gap-2
                    rounded-md px-3 py-2
                    text-xs text-gray-900
                    ${bannerClassMap[note.color]}
                  `}
                >
                  <div className="flex-1 pr-2">{note.text}</div>
                  <button
                    type="button"
                    onClick={() => onRemoveNote(note.id)}
                    className="
                      text-[11px] text-gray-700
                      hover:text-gray-900
                      hover:bg-white/40
                      rounded-full
                      px-2 py-0.5
                      shrink-0
                    "
                    aria-label="Remove note"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

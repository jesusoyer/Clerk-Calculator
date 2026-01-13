// components/NoteModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { NoteColor } from "../page";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, color: NoteColor) => void;
  noteLimitReached: boolean;
}

const COLOR_OPTIONS: { value: NoteColor; label: string; swatchClass: string }[] = [
  { value: "yellow", label: "Yellow", swatchClass: "bg-amber-300" },
  { value: "green", label: "Green", swatchClass: "bg-emerald-400" },
  { value: "red", label: "Red", swatchClass: "bg-rose-400" },
  { value: "blue", label: "Blue", swatchClass: "bg-sky-400" },
  { value: "purple", label: "Purple", swatchClass: "bg-violet-400" },
];

export default function NoteModal({
  isOpen,
  onClose,
  onSave,
  noteLimitReached,
}: NoteModalProps) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");

  useEffect(() => {
    if (isOpen) {
      setText("");
      setColor("yellow");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const disabled = noteLimitReached || !text.trim();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Add pinned note
        </h2>
        <p className="text-[11px] text-gray-600 mb-3">
          Add a short reminder to keep above the calculator. You can pin up to{" "}
          <span className="font-semibold">5 notes</span>.
        </p>

        {noteLimitReached && (
          <div className="mb-2 rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-[11px] text-red-700">
            You’ve reached the maximum of 5 pinned notes. Remove one before
            adding a new note.
          </div>
        )}

        {/* Color picker */}
        <div className="mb-3">
          <span className="block text-[11px] font-semibold text-gray-700 mb-1.5">
            Banner color
          </span>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => {
              const isActive = color === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px]
                    ${isActive ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"}
                  `}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${opt.swatchClass}`}
                  />
                  <span className="text-gray-800">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="
            w-full border rounded-md px-2 py-1.5
            text-xs sm:text-sm text-gray-900
            focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500
            resize-none
          "
          placeholder="e.g. Add any helpful note"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="
              px-3 py-1.5 rounded-md border border-gray-300
              text-xs sm:text-sm text-gray-700
              bg-white hover:bg-gray-100
              focus:outline-none focus:ring-1 focus:ring-gray-300
            "
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) onSave(text, color);
            }}
            className={`
              px-3 py-1.5 rounded-md border
              text-xs sm:text-sm font-semibold
              ${
                disabled
                  ? "bg-amber-100 text-amber-400 border-amber-100 cursor-not-allowed"
                  : "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
              }
              focus:outline-none focus:ring-1 focus:ring-amber-300
            `}
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}

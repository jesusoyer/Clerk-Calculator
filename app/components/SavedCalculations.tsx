// components/SavedCalculations.tsx
"use client";

export interface SavedCalculationSummary {
  id: string;
  createdAt: number;
}

interface SavedCalculationsPanelProps {
  items: SavedCalculationSummary[];
  isOpen: boolean;
  activeId: string | null;
  onToggleOpen: () => void;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export default function SavedCalculationsPanel({
  items,
  isOpen,
  activeId,
  onToggleOpen,
  onSelect,
  onDelete,
}: SavedCalculationsPanelProps) {
  return (
    <div className="relative text-xs">
      {/* Toggle button – neutral gray, similar to old styling */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="
          inline-flex items-center gap-1
          px-3 py-1.5 rounded-md border border-gray-300
          bg-white text-[11px] font-medium text-gray-800
          shadow-sm
          hover:bg-gray-100 active:scale-95
          transition
        "
      >
        <span>Saved calculations</span>
        {items.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-white">
            {items.length}
          </span>
        )}
        <span className="text-[10px] text-gray-400">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {/* Sliding / collapsing panel */}
      <div
        className={`
          mt-2 overflow-hidden origin-left
          transition-[max-width,opacity,transform] duration-300
          ${
            isOpen
              ? "max-w-xs opacity-100 translate-x-0"
              : "max-w-0 opacity-0 -translate-x-4 pointer-events-none"
          }
        `}
      >
        {/* Inner card – same kind of card styling as before */}
        <div className="w-64 rounded-lg border border-gray-200 bg-white shadow-sm p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-900">
              Saved calculations
            </span>
          </div>

          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {/* "Current calculation" pseudo-item */}
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`
                w-full text-left px-2 py-1.5 rounded-md text-[11px]
                border
                ${
                  activeId === null
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-gray-50 text-gray-800 border-transparent hover:bg-gray-100"
                }
              `}
            >
              Current calculation
            </button>

            {items.length === 0 && (
              <p className="text-[11px] text-gray-500 px-1 py-2">
                Nothing saved yet. Use{" "}
                <span className="font-medium">Save</span> after entering at
                least one valid date range.
              </p>
            )}

            {items.map((item) => {
              const isActive = activeId === item.id;
              const created = new Date(item.createdAt);
              const createdLabel = created.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  className={`
                    flex items-center gap-1 px-1 py-1 rounded-md group
                    ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "hover:bg-gray-100 text-gray-800"
                    }
                  `}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="flex-1 text-left text-[11px] truncate"
                  >
                    <div className="font-semibold truncate">{item.id}</div>
                    <div
                      className={`
                        text-[10px]
                        ${isActive ? "text-gray-200" : "text-gray-500"}
                      `}
                    >
                      {createdLabel}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded-md
                      ${
                        isActive
                          ? "text-gray-200 hover:bg-gray-800"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                      }
                    `}
                    aria-label={`Delete ${item.id}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

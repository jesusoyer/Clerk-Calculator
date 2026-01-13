// app/page.tsx
"use client";

import { useState } from "react";
import Calculator from "./components/Calculator";
import Header from "./components/Header";
import NotePins from "./components/NotePins";
import NoteModal from "./components/NoteModal";

export type NoteColor = "yellow" | "green" | "red" | "blue" | "purple";

export interface NotePinItem {
  id: string;
  text: string;
  color: NoteColor;
}

export default function Page() {
  const [notes, setNotes] = useState<NotePinItem[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const noteLimitReached = notes.length >= 5;

  function handleAddNote(text: string, color: NoteColor) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setNotes((prev) => {
      if (prev.length >= 5) return prev; // enforce max 5
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now() + Math.random());

      return [...prev, { id, text: trimmed, color }];
    });
  }

  function handleRemoveNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        onOpenNoteModal={() => setIsNoteModalOpen(true)}
        noteLimitReached={noteLimitReached}
      />

      <NotePins notes={notes} onRemoveNote={handleRemoveNote} />

      <main className="flex-1 px-3 sm:px-4 pt-1 pb-32 flex justify-center">
  <div className="w-full max-w-6xl flex items-center justify-center">
    <Calculator />
  </div>
</main>


      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={(text, color) => {
          handleAddNote(text, color);
          setIsNoteModalOpen(false);
        }}
        noteLimitReached={noteLimitReached}
      />
    </div>
  );
}

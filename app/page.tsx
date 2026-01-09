// app/page.tsx
"use client";

import Calculator from "./components/Calculator";
import Header from "./components/Header";

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 px-3 sm:px-4 py-4 flex justify-center">
        <div className="w-full max-w-6xl flex items-center justify-center">
          <Calculator />
        </div>
      </main>
    </div>
  );
}

// app/page.tsx (or wherever your BacktimeCalculator lives)
"use client";

import Calculator from "./components/Calculator";
import Header from "./components/Header"; // adjust path as needed

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <Calculator />
      </main>
    </div>
  );
}
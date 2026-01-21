# Clerk Calculator

**[🚀 Live Demo](https://clerk-calculator.vercel.app/)**

A small, focused web app to help Texas district clerk offices (and anyone doing similar work) calculate backtime and adjust dates quickly and consistently.

This project currently includes two tools in one interface:

- **Clerk Calculator** – a "backtime" calculator for custody days between date ranges
- **Date Adjust** – a smart date shifter that adds/subtracts days, months, and years from a base date

All calculation logic runs completely in the browser and is persisted in localStorage.

---

## Features

### 🧮 Clerk Calculator (Backtime)

Backtime calculator for custody days between multiple date ranges.

- **Enter multiple start / end date ranges** in `MM/DD/YY` format
- **Flexible input:**
  - Supports `MMDDYY`, `MMDDYYYY`, and `M/D/YY` / `MM/DD/YYYY` styles
  - Automatically normalizes to `MM/DD/YY`
- **"Today" button** on each end date to quickly set the end to the current date
- **Two calculation modes:**
  - **STATE JAIL** – exclusive of the end date (simple difference in days)
  - **TCJ/TDCJ/ACOP** – inclusive of the end date (difference in days + 1)
- **Per-row result** (e.g., `10 days`)
- **Combined total**, with a detailed expression like:
  ```
  (01/01/2024 - 01/10/2024) + (02/01/2024 - 02/05/2024) = 15 days
  ```
- **Copy breakdown button** to copy the combined expression to the clipboard
- **Add / remove rows** dynamically
- **Inline validation** for invalid dates (but doesn't block typing partial input)

### Saved Calculations

- **Identifier** (optional) text field, e.g. `Smith cause #1234`
- **Save** the current calculation (rows + mode + label)
- **Update** an existing saved calculation
- **Reload** a saved calc into the main calculator
- **Delete** an individual saved item
- **Clear all saved** calculations with one button
- All saved data and current calculator state are stored in `localStorage`

### 📅 Date Adjust

Date adjustment calculator for adding or subtracting time from a single base date.

- **Base date field** with "Today" button (`MM/DD/YY` format)
- **Direction toggle:**
  - `+` Add
  - `−` Subtract
- **Separate numeric fields:**
  - Days
  - Months
  - Years
- **Calculates using calendar-aware logic:**
  - Days: moves by actual dates (not raw milliseconds)
  - Months: respects month boundaries
  - Years: respects leap years where applicable
- **Result is displayed as:**

  ```
  From Wednesday, January 1, 2025
  Added 10 days, 1 month

  Result: Saturday, February 11, 2025
  ```

- **Clear button** resets base date + direction + all fields
- Lives in the same card container as the Clerk Calculator, and is toggled via the view switch at the top of the card
- Works independently from the backtime logic (does not affect saved calculations or totals)

---

## ⌨️ Keyboard Shortcuts

### Clerk Calculator (Backtime)

- `Ctrl + 0` / `Cmd + 0` → Clear all rows, mode, identifier, and localStorage state

### Date Adjust

- `Ctrl + 0` / `Cmd + 0` → Clear the base date, direction, and all (days / months / years) fields
- `Enter` while focused in any of the Days, Months, or Years fields → Perform the calculation

---

## Tech Stack

- **React + TypeScript**
- **Next.js** (`"use client"` and `*.tsx` components)
- Styling via **Tailwind CSS**-style utility classes
- Data persistence via `window.localStorage` (no backend required)

You can drop the `Calculator` component into a Next.js app (or any React app with minor tweaks).

---

## Project Structure (Relevant Parts)

```
components/
  Calculator.tsx        # Main card + view toggle + all core logic
  SavedCalculations.tsx # SavedCalculationsPanel + types (imported by Calculator)
```

- `Calculator` exports the default UI used by your page.
- `BacktimeCard` (inside `Calculator.tsx`) renders:
  - The view toggle (Clerk Calculator / Date adjust)
  - Either the backtime calculator or the date adjust calculator.
- `DateAdjustCalculator` is an internal component inside `Calculator.tsx`.

---

## Getting Started

### 1. Prerequisites

- **Node.js** ≥ 18 recommended
- **npm**, **yarn**, or **pnpm**

### 2. Install Dependencies

From the root of your project:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Run the Dev Server

If this is a Next.js app:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Then open:

```
http://localhost:3000
```

in your browser and navigate to the page that renders the `<Calculator />` component.

---

## Using the App

### Clerk Calculator (Backtime)

1. Make sure **"Clerk Calculator"** is selected in the toggle at the top of the card.
2. For each row:
   - Enter **start date** (`MM/DD/YY`)
   - Enter **end date** (`MM/DD/YY`) or click **Today**
   - Choose the correct mode:
     - **STATE JAIL** or **TCJ/TDCJ/ACOP**
3. View:
   - Per-row total (e.g., `10 days`)
   - Combined total at the bottom
   - Optional breakdown expression
4. Use:
   - **Save** to store a calculation with an identifier
   - **Update** to overwrite an existing saved calculation
   - **Clear** to reset all current inputs
   - **Clear All Saved** (in the saved panel) to wipe saved items
   - `Ctrl/Cmd + 0` to clear the current calculator + storage

### Date Adjust

1. Switch the toggle to **"Date adjust"**.
2. Set the **Base date** (`MM/DD/YY`) or click **Today**.
3. Choose **+** or **−** direction.
4. Enter values in **Days**, **Months**, and/or **Years**.
5. Click **Calculate** or press **Enter** in one of the numeric fields.
6. The result section will show:

   ```
   From {long base date}
   Added/Subtracted {X years, Y months, Z days}

   Result: {long target date}
   ```

7. Use **Clear** (or `Ctrl/Cmd + 0`) to reset.

---

## Date Handling Details

- All short dates are treated as `MM/DD/YY` with:
  - A sliding 100-year window ending at the current year
  - `00–pivot` ⇒ `2000–20xx` range
  - `pivot+1–99` ⇒ `19xx` range
- Backtime day counts use UTC midnight to avoid daylight saving time bugs.
- **STATE_JAIL:**
  - Pure difference in days between start and end
- **TCJ_TDCJ/ACOP:**
  - Difference in days + 1 day, to treat the period as inclusive.

---

## Customization Ideas

If you want to extend this app later, some ideas:

- Add **per-row labels** (e.g., "Cause #", "Facility", etc.)
- **Export saved results** as CSV or PDF
- Add a **settings panel** for:
  - Default mode
  - Default date format
  - Jurisdiction-specific rules
- Add a **print-friendly layout** for court files

---

## License

Choose any license that fits your goals (MIT, proprietary, etc.).

**Example (MIT):**

MIT License – see `LICENSE` file for details.

---

## Credits

Built as a focused tool for clerks and court staff who repeatedly calculate backtime and adjust dates by hand.

If you're using it in a real office and have ideas for improvements, please open an issue or PR!

"use client";

// Manual Event entry (#55): smart-defaulted single-event form. Category
// chips come from the MANUAL Calendar Source's own vocabulary; typing a new
// one grows that vocabulary (per-source categories, never a universal
// taxonomy). Dates are entered inclusively — the exclusive end the model
// stores is derived here.

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createManualEvent } from "@/app/actions/calendar";

function exclusiveEnd(lastDayIso: string): string {
  const date = new Date(`${lastDayIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function ManualEventForm({
  categories,
  onCreated,
}: {
  categories: string[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "event");
  const [newCategory, setNewCategory] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const effectiveCategory = newCategory.trim() || category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    if (lastDay && lastDay < date) {
      setError("Last day can't be before the first day.");
      return;
    }
    const costNumber = cost ? Number(cost) : undefined;
    if (costNumber !== undefined && (!isFinite(costNumber) || costNumber < 0)) {
      setError("Cost must be a positive amount.");
      return;
    }

    setIsSaving(true);
    const result = await createManualEvent({
      title: title.trim(),
      startDate: date,
      endDate: lastDay && lastDay > date ? exclusiveEnd(lastDay) : undefined,
      category: effectiveCategory,
      note: note.trim() || undefined,
      costCents:
        costNumber !== undefined ? Math.round(costNumber * 100) : undefined,
    });
    setIsSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSaved(`Added "${title.trim()}" to the timeline.`);
    setTitle("");
    setDate("");
    setLastDay("");
    setNote("");
    setCost("");
    setNewCategory("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <Input
        label="Title"
        placeholder="e.g. Dentist — both kids"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label="Last day (optional)"
          type="date"
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
          helperText="For multi-day events"
        />
      </div>

      <div>
        <p className="font-sans text-sm font-medium text-text-primary mb-2">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((option) => {
            const active = !newCategory.trim() && category === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCategory(option);
                  setNewCategory("");
                }}
                className={`rounded-full border px-3 py-1 text-sm font-sans transition-colors ${
                  active
                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                    : "border-bg-secondary bg-white text-text-secondary hover:border-accent-gold/50"
                }`}
              >
                {option}
              </button>
            );
          })}
          <input
            type="text"
            placeholder="new category…"
            aria-label="New category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className={`rounded-full border px-3 py-1 text-sm font-sans w-36 focus:outline-none focus:border-accent-gold ${
              newCategory.trim()
                ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                : "border-bg-secondary text-text-secondary"
            }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Note (optional)"
          placeholder="Extended Day Closed"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Input
          label="Cost (optional)"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          helperText="Never becomes an Earmark without your say-so"
        />
      </div>

      <Button type="submit" variant="primary" disabled={isSaving}>
        {isSaving ? "Adding…" : "Add event"}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-red-600 font-sans">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-text-primary font-sans">
          {saved}
        </p>
      )}
    </form>
  );
}

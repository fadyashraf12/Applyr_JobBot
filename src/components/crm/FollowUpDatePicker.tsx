import React from 'react';

interface FollowUpDatePickerProps {
  selectedDate: any; // Firestore Timestamp, string or Date
  onChange: (date: Date | null) => void;
}

export default function FollowUpDatePicker({ selectedDate, onChange }: FollowUpDatePickerProps) {
  // Convert selectedDate safely to string "YYYY-MM-DD"
  const getSelectedDateString = () => {
    if (!selectedDate) return '';
    const date = selectedDate.toDate ? selectedDate.toDate() : new Date(selectedDate);
    return date.toISOString().split('T')[0];
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(null);
    } else {
      onChange(new Date(val));
    }
  };

  // Quick offsets
  const setQuickOffset = (days: number) => {
    const target = new Date();
    target.setHours(9, 0, 0, 0); // set to 9am local timezone
    target.setDate(target.getDate() + days);
    onChange(target);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none">
          Follow-Up Reminder
        </label>
        <p className="text-xs text-slate-500">
          Highlight this application in your dashboard when a response action or message sequence is expected.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Date Input Box */}
        <div className="relative">
          <input
            type="date"
            value={getSelectedDateString()}
            onChange={handleCustomChange}
            className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white font-mono outline-none transition-all"
          />
        </div>

        {/* Quick select triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickOffset(1)}
            className="text-xs px-3 py-1.5 bg-slate-800/80 hover:bg-slate-750 text-slate-350 hover:text-white rounded border border-slate-750 font-semibold transition-all active:scale-95"
          >
            Tomorrow ☀️
          </button>
          <button
            onClick={() => setQuickOffset(3)}
            className="text-xs px-3 py-1.5 bg-slate-800/80 hover:bg-slate-750 text-slate-350 hover:text-white rounded border border-slate-750 font-semibold transition-all active:scale-95"
          >
            In 3 Days ⏳
          </button>
          <button
            onClick={() => setQuickOffset(7)}
            className="text-xs px-3 py-1.5 bg-slate-800/80 hover:bg-slate-750 text-slate-350 hover:text-white rounded border border-slate-750 font-semibold transition-all active:scale-95"
          >
            In 1 Week 🎯
          </button>
          {selectedDate && (
            <button
              onClick={() => onChange(null)}
              className="text-xs px-3 py-1.5 bg-red-950/20 hover:bg-red-900/10 text-red-450 rounded border border-red-900/30 font-semibold transition-all active:scale-95 ml-auto"
            >
              Clear Reminder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

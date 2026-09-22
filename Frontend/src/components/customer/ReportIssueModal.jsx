import { X } from "lucide-react";

export function ReportIssueModal({ issueText, saving, onClose, onChange, onSubmit }) {
  const presets = [
    "Milk packet damaged",
    "Quantity mismatch",
    "Delivery not received",
    "Late delivery",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-lg rounded-t-[28px] border border-gray-200 bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">
              Delivery Support
            </p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">
              Report a delivery issue
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Mention missing items, damaged packets, delay, wrong quantity, or any delivery problem.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Describe the issue
          </label>
          <textarea
            rows={5}
            value={issueText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Example: I received only 1 packet instead of 2, and one packet was leaking."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-base sm:text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:bg-white"
          />
          <p className="mt-2 text-xs text-gray-400">Minimum 5 characters.</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

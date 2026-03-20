export default function StatusBanner({ activeAgents, totalAgents }) {
  return (
    <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-center gap-4 animate-fade-up">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl">
        ✓
      </div>

      <div className="flex-1">
        <p className="text-sm text-gray-600">
          {activeAgents} of {totalAgents} agents active
        </p>
      </div>

      <span className="text-sm text-gray-400">
        {new Date().toLocaleTimeString()}
      </span>
    </div>
  );
}

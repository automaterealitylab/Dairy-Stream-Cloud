import React from "react";

const LoadingIndicator = ({
  _message = "Loading...",
  fullScreen = false,
  className = "",
  _size = 28, // backward compatibility
}) => {
  if (fullScreen) {
    return (
      <div className={`min-h-screen w-full flex flex-col justify-start bg-[#FFFDF7] p-5 sm:p-8 md:p-12 animate-pulse ${className}`.trim()}>
        {/* Shimmering Navbar Header Placeholder */}
        <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-5 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#E7DAC6]" />
            <div className="h-5 w-32 rounded-full bg-[#E7DAC6]" />
          </div>
          <div className="h-9 w-20 rounded-xl bg-[#E7DAC6]" />
        </div>

        {/* Shimmering Layout body */}
        <div className="space-y-6 max-w-4xl w-full mx-auto">
          {/* Headline */}
          <div className="space-y-2">
            <div className="h-7 w-2/3 rounded-xl bg-[#E7DAC6]" />
            <div className="h-4 w-1/3 rounded-lg bg-[#E7DAC6]/60" />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[#EDE8DF] bg-white p-5 space-y-4">
              <div className="h-5 w-1/4 rounded bg-[#E7DAC6]" />
              <div className="h-10 w-1/2 rounded-xl bg-[#E7DAC6]/80" />
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-[#E7DAC6]/40" />
                <div className="h-4 w-5/6 rounded bg-[#E7DAC6]/40" />
              </div>
            </div>
            <div className="rounded-2xl border border-[#EDE8DF] bg-white p-5 space-y-4">
              <div className="h-5 w-1/4 rounded bg-[#E7DAC6]" />
              <div className="h-10 w-1/2 rounded-xl bg-[#E7DAC6]/80" />
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-[#E7DAC6]/40" />
                <div className="h-4 w-5/6 rounded bg-[#E7DAC6]/40" />
              </div>
            </div>
          </div>

          {/* Large list block */}
          <div className="rounded-2xl border border-[#EDE8DF] bg-[#FFF8EC]/40 p-5 space-y-4">
            <div className="h-5 w-1/3 rounded bg-[#E7DAC6]" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-12 w-12 rounded-xl bg-[#E7DAC6]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-[#E7DAC6]/70" />
                    <div className="h-3 w-1/3 rounded bg-[#E7DAC6]/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline skeleton loader (for boxes, drawers, or table containers)
  return (
    <div className={`w-full p-6 bg-white rounded-2xl border border-[#EDE8DF] animate-pulse ${className}`.trim()}>
      <div className="flex flex-col gap-4 w-full">
        {/* Placeholder title and icon */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#E7DAC6]" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 rounded-full bg-[#E7DAC6]" />
            <div className="h-3.5 w-1/4 rounded-full bg-[#E7DAC6]/60" />
          </div>
        </div>
        
        {/* Placeholder lines */}
        <div className="space-y-2.5 mt-2">
          <div className="h-4 w-full rounded bg-[#E7DAC6]/40" />
          <div className="h-4 w-11/12 rounded bg-[#E7DAC6]/40" />
          <div className="h-4 w-3/4 rounded bg-[#E7DAC6]/40" />
        </div>
      </div>
    </div>
  );
};

export default LoadingIndicator;

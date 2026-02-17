import { Loader2 } from "lucide-react";

const LoadingIndicator = ({
  message = "Loading...",
  fullScreen = false,
  className = "",
  size = 28,
}) => {
  const containerClass = fullScreen
    ? "min-h-screen flex items-center justify-center"
    : "flex items-center justify-center";

  return (
    <div className={`${containerClass} ${className}`.trim()}>
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 size={size} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingIndicator;

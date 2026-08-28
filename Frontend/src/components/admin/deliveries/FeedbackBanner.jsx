export const FeedbackBanner = ({ feedback }) => {
  if (!feedback?.message) return null;
  const isSuccess = feedback.type === "success";
  return (
    <div className={`mt-4 rounded-lg border p-3 text-sm font-medium ${isSuccess ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
      {isSuccess ? "OK " : "X "} {feedback.message}
    </div>
  );
};

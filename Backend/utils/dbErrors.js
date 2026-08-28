// PostgreSQL/Supabase error classification helpers shared across services.

export const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

export const isMissingTableError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("table")) ||
    (message.includes("schema cache") && message.includes("table"))
  );
};

export const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

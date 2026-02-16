const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").trim();

export const fetchPublicDairies = async ({ search = "" } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);

  const res = await fetch(`${BASE_URL}/api/dairies?${params.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to fetch dairies");
  return JSON.parse(text);
};

export const fetchPublicDairyById = async (id) => {
  const res = await fetch(`${BASE_URL}/api/dairies/${id}`);
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to fetch dairy");
  return JSON.parse(text);
};

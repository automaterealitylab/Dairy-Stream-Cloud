import client from "./client";

export const fetchNearbyDairies = async ({
  lat,
  lng,
  radius = 10,
  page = 0,
} = {}) => {
  const params = {
    lat,
    lng,
    radius,
    page,
  };

  const res = await client.get("/public/dairies/nearby", { params });
  return res.data;
};

export const fetchSearchDairies = async ({ q } = {}) => {
  const params = {};
  if (q) params.q = q;

  const res = await client.get("/public/dairies/search", { params });
  return res.data;
};


export const fetchSearchSuggestions = async (q) => {
  const res = await client.get("/public/dairies/suggestions", {
    params: {
      q,
      t: Date.now()
    }
  });

  return res.data;
};
export const fetchCityDairies = async ({ city } = {}) => {
  const params = {};
  if (city) params.city = city;

  const res = await client.get("/public/dairies/city", { params });
  return res.data;
};

/* ---------- GET SINGLE DAIRY ---------- */

export const fetchPublicDairyById = async (id) => {
  const res = await client.get(`/public/dairies/${id}`);
  return res.data;
};

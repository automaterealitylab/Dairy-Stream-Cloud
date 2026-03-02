import axios from "axios";

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

  const res = await axios.get("/api/public/dairies/nearby", { params });
  return res.data;
};

export const fetchSearchDairies = async ({ q } = {}) => {
  const params = {};
  if (q) params.q = q;

  const res = await axios.get("/api/public/dairies/search", { params });
  return res.data;
};


export const fetchSearchSuggestions = async (q) => {
  const res = await axios.get("/api/public/dairies/suggestions", {
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

  const res = await axios.get("/api/public/dairies/city", { params });
  return res.data;
};

/* ---------- GET SINGLE DAIRY ---------- */

export const fetchPublicDairyById = async (id) => {
  const res = await axios.get(`/api/public/dairies/${id}`);
  return res.data;
};

import axios from "axios";

export const fetchPublicDairies = async ({
  search = "",
  city = "",
  pincode = "",
  lat = null,
  lng = null,
  radius = 10,
} = {}) => {

  const params = {};

  if (search) params.search = search;
  if (city) params.city = city;
  if (pincode) params.pincode = pincode;

  if (lat !== null && lat !== undefined) params.lat = lat;
  if (lng !== null && lng !== undefined) params.lng = lng;

  if (radius) params.radius = radius;

  const res = await axios.get("/api/public/dairies", { params });

  return res.data;
};

/* ---------- GET SINGLE DAIRY ---------- */

export const fetchPublicDairyById = async (id) => {
  const res = await axios.get(`/api/public/dairies/${id}`);

  return res.data;
};

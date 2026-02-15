import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  MapPin,
  ShieldCheck,
  Clock,
  Truck,
} from "lucide-react";
import { fetchPublicDairyById } from "../../api/public.api.js";

const DairyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchPublicDairyById(id);
        if (active) {
          setData(res?.dairy || null);
          setError("");
        }
      } catch (err) {
        if (active) setError("Failed to load dairy details");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id]);

  const dairy = useMemo(() => {
    if (!data) return null;
    return {
      id: data.id,
      name: data.dairy_name || data.name || "Dairy",
      rating: data.rating ?? null,
      reviews: data.reviews ?? null,
      distance: data.distance || null,
      isVerified: Boolean(data.is_verified),
      image: data.image_url || "",
      address: data.address || data.dairy_address || data.city || "Address not set",
      minPrice: data.min_price ?? null,
      description: data.description || data.dairy_description || "No description provided.",
      phone: data.dairy_phone || data.phone || "-",
      email: data.dairy_email || data.email || "-",
      createdAt: data.created_at || null,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (error || !dairy) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {error || "Dairy not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="w-full px-6 lg:px-10 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{dairy.name}</h1>
            {dairy.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                <ShieldCheck size={12} /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-10 py-6 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="w-full h-[420px] bg-gray-100 rounded-2xl overflow-hidden">
            {dairy.image ? (
              <img
                src={dairy.image}
                alt={dairy.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>

          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">About this Dairy</h2>
            <p className="text-gray-600">{dairy.description}</p>
          </section>

          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Contact</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p>{dairy.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p>{dairy.email}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Location</h2>
            <div className="text-sm text-gray-700 flex items-start gap-2">
              <MapPin size={16} />
              <span>{dairy.address}</span>
            </div>
          </section>
        </div>

        <div className="bg-white rounded-2xl p-6 h-fit lg:sticky lg:top-24">
          {dairy.rating != null && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded text-sm font-bold text-green-700">
                {dairy.rating}
                <Star size={14} fill="currentColor" />
              </div>
              {dairy.reviews != null && (
                <span className="text-sm text-gray-500">({dairy.reviews} reviews)</span>
              )}
            </div>
          )}

          <div className="text-sm text-gray-600 flex gap-2 mb-2">
            <MapPin size={16} />
            {dairy.address}
          </div>

          {dairy.distance && (
            <div className="text-sm text-gray-600 flex gap-2 mb-4">
              <Clock size={16} />
              {dairy.distance}
            </div>
          )}

          {dairy.minPrice != null && (
            <div className="border-t pt-4 mb-4">
              <p className="text-sm text-gray-500">Starting at</p>
              <p className="text-2xl font-bold">Rs {dairy.minPrice}
                <span className="text-sm text-gray-500"> /L</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Approx Rs {dairy.minPrice * 30}/month (1L daily)
              </p>
            </div>
          )}

          <button
            onClick={() => navigate(`/subscribe/${dairy.id}`)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Truck size={18} />
            Subscribe Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default DairyDetailsPage;

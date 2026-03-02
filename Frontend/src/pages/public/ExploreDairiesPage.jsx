import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  Search,
  MapPin,
  Clock,
  User,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

import { fetchPublicDairies } from "../../api/public.api.js";
import { fetchCustomerSubscription } from "../../api/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import LocationSelector from "../../components/dairy/LocationSelector.jsx";

const CITY_OPTIONS = [
  "Kolkata",
  "Bardhaman",
  "Durgapur",
  "Asansol",
  "Siliguri",
];

const ExploreDairiesPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Core Data States
  const [dairies, setDairies] = useState([]);
  const [activeSubData, setActiveSubData] = useState(null);

  // UI & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [detectedLocation, setDetectedLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showLocation, setShowLocation] = useState(false);

  // ---------- GPS HELPER ----------
  const getLiveLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject("Geolocation not supported");
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject("Location denied"),
        { timeout: 10000 },
      );
    });
  };

  // ---------- CENTRAL FETCH LOGIC ----------
  const loadDairiesList = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const res = await fetchPublicDairies({
        radius: 150, // Changed from 20 to 150 for testing/broad discovery
        ...params,
      });
      console.log("API RESPONSE:", res);
      setDairies(res?.dairies || []);
      setLoadError("");
    } catch (err) {
      console.error("Failed to fetch dairies:", err);
      setDairies([]);
      setLoadError("FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------- INITIAL LOAD (NEARBY) ----------
  useEffect(() => {
    const initNearby = async () => {
      try {
        const coords = await getLiveLocation();
        setDetectedLocation("Nearby");
        await loadDairiesList({ lat: coords.lat, lng: coords.lng });
      } catch (err) {
        setLoadError("LOCATION_OFF");
        setLoading(false);
      }
    };
    initNearby();
  }, [loadDairiesList]);

  // ---------- GLOBAL SEARCH (DEBOUNCED) ----------
  useEffect(() => {
    if (!searchTerm.trim()) return;

    const delay = setTimeout(() => {
      setSelectedCity(""); // Clear city shortcut if user starts typing
      loadDairiesList({ search: searchTerm });
    }, 500);

    return () => clearTimeout(delay);
  }, [searchTerm, loadDairiesList]);

  // ---------- CITY SHORTCUTS ----------
  const handleCityClick = (city) => {
    setSearchTerm("");
    setSelectedCity(city);
    setDetectedLocation(city);
    loadDairiesList({ city });
  };

  // ---------- SUBSCRIPTION CHECK ----------
  const isLoggedIn = Boolean(user?.token || localStorage.getItem("user"));
  const isCustomer =
    isLoggedIn &&
    (user?.role || localStorage.getItem("userRole")) === "CUSTOMER";

  useEffect(() => {
    if (isCustomer) {
      fetchCustomerSubscription()
        .then((data) => {
          if (data?.subscription?.status !== "CLOSED") {
            setActiveSubData(data.subscription);
          }
        })
        .catch(() => setActiveSubData(null));
    }
  }, [isCustomer]);

  // ---------- DATA MAPPING ----------
  const mappedDairies = useMemo(() => {
    return dairies
      .map((d) => ({
        id: d.id,
        name: d.dairy_name || "Dairy",
        distance:
          typeof d.distance === "number" ? `${d.distance.toFixed(1)} km` : "—",
        image: d.image_url || "",
        address: d.address || d.city || "",
        minPrice: d.min_price ?? 50,
        isSubscribed: activeSubData?.dairy_id === d.id,
      }))
      .sort((a, b) =>
        a.isSubscribed === b.isSubscribed ? 0 : a.isSubscribed ? -1 : 1,
      );
  }, [dairies, activeSubData]);

  const handleAuthAction = () => {
    if (isCustomer) return navigate("/customer/dashboard");
    isLoggedIn ? (logout(), navigate("/", { replace: true })) : navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div
                className="font-bold text-2xl text-blue-600 cursor-pointer"
                onClick={() => navigate("/")}
              >
                DairyStream
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowLocation(!showLocation)}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <MapPin size={18} className="text-red-500" />
                  <span className="text-sm">
                    Delivering to{" "}
                    <b>
                      {selectedCity ||
                        (detectedLocation === "Nearby"
                          ? "Your Current Location"
                          : detectedLocation) ||
                        "Your area"}
                    </b>
                  </span>
                </button>

                {showLocation && (
                  <div className="absolute top-12 left-0 z-50">
                    <LocationSelector
                      // Inside LocationSelector onApply or City Shortcut handler
                      onApply={(data) => {
                        setShowLocation(false);
                        setSearchTerm("");
                        setSelectedCity(data.city || "");
                        setDetectedLocation(""); // Clear 'Nearby' so the label shows the city name
                        loadDairiesList({
                          city: data.city,
                          pincode: data.pincode,
                          radius: data.radius,
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SEARCH INPUT */}
            <div className="flex-1 max-w-2xl relative">
              <Search
                className="absolute left-4 top-3.5 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search dairies by name or area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleAuthAction}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                  isCustomer
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {isCustomer ? (
                  <LayoutDashboard size={18} />
                ) : isLoggedIn ? (
                  <LogOut size={20} />
                ) : (
                  <User size={20} />
                )}
                {isCustomer ? "Dashboard" : isLoggedIn ? "Logout" : "Login"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* CITY QUICK LINKS */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {CITY_OPTIONS.map((city) => (
            <button
              key={city}
              onClick={() => handleCityClick(city)}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCity === city
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* LOADING & ERRORS */}
        {loading ? (
          <LoadingIndicator className="py-20" />
        ) : loadError === "LOCATION_OFF" && !searchTerm && !selectedCity ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-800">
              Location is turned off
            </h2>
            <p className="text-gray-500 mt-2">
              Search for a city above or enable GPS to find dairies near you.
            </p>
          </div>
        ) : mappedDairies.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-gray-800">
              No dairies found here 🚚
            </h3>
            <p className="text-gray-500 mt-2">
              Try adjusting your search or radius.
            </p>
          </div>
        ) : (
          /* DAIRY GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mappedDairies.map((dairy) => (
              <div
                key={dairy.id}
                onClick={() => navigate(`/join/${dairy.id}`)}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
              >
                <div className="relative h-48 bg-gray-200">
                  {dairy.image ? (
                    <img
                      src={dairy.image}
                      alt={dairy.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                      No Image
                    </div>
                  )}
                  {dairy.isSubscribed && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      My Subscription
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-700">
                    <Clock size={12} className="inline mr-1 text-blue-500" />
                    {dairy.distance}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">
                    {dairy.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 flex items-start gap-1">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{dairy.address}</span>
                  </p>

                  <div className="pt-4 border-t flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        Starts at
                      </span>
                      <p className="font-bold text-lg text-gray-900">
                        ₹{dairy.minPrice}
                        <span className="text-sm font-normal text-gray-500">
                          /L
                        </span>
                      </p>
                    </div>
                    <button className="bg-blue-50 text-blue-600 px-5 py-2 rounded-xl text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      View Menu
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ExploreDairiesPage;

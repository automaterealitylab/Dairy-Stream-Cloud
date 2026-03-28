import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  Search,
  MapPin,
  Clock,
  User,
  LayoutDashboard,
} from "lucide-react";

import {
  fetchNearbyDairies,
  fetchSearchDairies,
  fetchCityDairies,
  fetchSearchSuggestions,
} from "../../api/public.api.js";
import { fetchCustomerSubscription } from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
// import LocationSelector from "../../components/dairy/LocationSelector.jsx";

// const CITY_OPTIONS = [
//   "Kolkata",
//   "Bardhaman",
//   "Durgapur",
//   "Asansol",
//   "Siliguri",
// ];

const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";
const headingFont = { fontFamily: "'Lora', serif" };

const ExploreDairiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [currentLat, setCurrentLat] = useState(null);
  const [currentLng, setCurrentLng] = useState(null);

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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // ---------- CENTRAL FETCH LOGIC (MODE-BASED) ----------
  const loadNearby = useCallback(
    async ({ lat, lng, radius = 150, page = 0 }) => {
      try {
        if (page === 0) setLoading(true);
        else setLoadingMore(true);

        const cacheKey = `nearby-${lat}-${lng}-${page}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          const cachedData = JSON.parse(cached);

          if (page === 0) {
            setDairies(cachedData);
          } else {
            setDairies((prev) => [...prev, ...cachedData]);
          }

          return;
        }

        console.time("nearby");

        const res = await fetchNearbyDairies({ lat, lng, radius, page });

        console.timeEnd("nearby");
        const newDairies = res?.dairies || [];

        sessionStorage.setItem(cacheKey, JSON.stringify(newDairies));

        if (page === 0) {
          setDairies(newDairies);
        } else {
          setDairies((prev) => [...prev, ...newDairies]);
        }

        if (newDairies.length < 20) {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Failed to fetch nearby dairies:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 500
      ) {
        if (!loadingMore && hasMore && currentLat && currentLng) {
          const nextPage = page + 1;

          setPage(nextPage);

          loadNearby({
            lat: currentLat,
            lng: currentLng,
            page: nextPage,
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [page, loadingMore, hasMore, currentLat, currentLng, loadNearby]);

  const loadSearch = useCallback(async (q) => {
    try {
      setLoading(true);
      const res = await fetchSearchDairies({ q });
      setDairies(res?.dairies || []);
      setLoadError("");
    } catch (err) {
      console.error("Failed to search dairies:", err);
      setDairies([]);
      setLoadError("FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        const res = await fetchSearchSuggestions(searchTerm);
        setSuggestions(res?.suggestions || []);
      } catch (err) {
        console.error("Suggestion fetch failed:", err);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  const loadCity = useCallback(async (city) => {
    try {
      setLoading(true);
      const res = await fetchCityDairies({ city });
      setDairies(res?.dairies || []);
      setLoadError("");
    } catch (err) {
      console.error("Failed to fetch city dairies:", err);
      setDairies([]);
      setLoadError("FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load for faast load
  // useEffect(() => {
  //   loadSearch(""); // quick initial dairies
  // }, []);
// ---------- INITIAL LOAD (NEARBY) ----------
useEffect(() => {
  const initNearby = async () => {
    try {
      // 1. Get GPS Coords
      const coords = await getLiveLocation();
      setCurrentLat(coords.lat);
      setCurrentLng(coords.lng);

      // 2. FETCH ACTUAL CITY NAME (Reverse Geocoding)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`
        );
        const data = await response.json();
        // Fallback chain: City -> Town -> Village -> "Nearby"
        const cityName = data.address.city || data.address.town || data.address.village || "Nearby";
        setDetectedLocation(cityName);
      } catch (geoErr) {
        console.error("Geocoding failed, falling back to 'Nearby'");
        setDetectedLocation("Nearby");
      }

      // 3. Load the data
      await loadNearby({
        lat: coords.lat,
        lng: coords.lng,
        page: 0,
      });
    } catch (err) {
      setLoadError("LOCATION_OFF");
      setLoading(false);
    }
  };
  initNearby();
}, [loadNearby]);

  // ---------- GLOBAL SEARCH (DEBOUNCED) ----------
  useEffect(() => {
    if (!searchTerm.trim()) return;

    const delay = setTimeout(() => {
      setSelectedCity("");
      // setDetectedLocation(searchTerm);
      loadSearch(searchTerm);
    }, 500);

    return () => clearTimeout(delay);
  }, [searchTerm, loadSearch]);

  // ---------- CITY SHORTCUTS ----------
  // const handleCityClick = (city) => {
  //   setSearchTerm("");
  //   setSelectedCity(city);
  //   setDetectedLocation(city);
  //   loadCity(city);
  // };

  // ---------- SUBSCRIPTION CHECK ----------
  const isLoggedIn = Boolean(user?.token || localStorage.getItem("user"));
  const isCustomer =
    isLoggedIn &&
    (user?.role || localStorage.getItem("userRole")) === "CUSTOMER";
  const canOpenCustomerDashboard =
    isCustomer && sessionStorage.getItem(DASHBOARD_VISITED_FLAG) === "true";

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
    if (canOpenCustomerDashboard) return navigate("/customer/dashboard");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F2EA]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-[#EDE8DF] bg-[#FFFDF8]/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div
                className="cursor-pointer text-2xl font-bold text-[#2C1A0E]"
                style={headingFont}
                onClick={() => navigate("/")}
              >
                Dairy<span className="text-[#B8641A]">Stream</span>
              </div>

              <div className="relative">
                <button
                  // onClick={() => setShowLocation(!showLocation)}
                  className="flex items-center gap-2 rounded-full border border-[#EDE8DF] bg-[#FBF7F0] px-3 py-2 text-[#6B5B3E] transition-colors hover:bg-[#F5EDE2]"
                >
                  <MapPin size={18} className="text-[#B8641A]" />
                  <span className="text-sm font-medium">
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
                        if (data.city) {
                          loadCity(data.city);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative max-w-2xl flex-1">
              <Search
                className="absolute left-4 top-3.5 text-[#C4A882]"
                size={20}
              />

              <input
                type="text"
                placeholder="Search dairies, city, area, pincode..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FFFDF8] py-3 pl-12 pr-4 text-[#2C1A0E] outline-none transition focus:border-[#D7B38A] focus:ring-2 focus:ring-[#F3DEC4]"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-[18px] border border-[#EDE8DF] bg-white shadow-[0_20px_40px_rgba(84,52,16,0.12)]">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex cursor-pointer justify-between px-4 py-3 text-[#6B5B3E] transition hover:bg-[#FBF7F0]"
                      onClick={() => {
                        setSearchTerm(s.suggestion);
                        setSuggestions([]);
                        setShowSuggestions(false);
                        setSelectedCity("");
                        setDetectedLocation(s.suggestion);

                        loadSearch(s.suggestion);
                      }}
                    >
                      <span>{s.suggestion}</span>

                      <span className="text-xs uppercase tracking-[0.16em] text-[#C4A882]">
                        {s.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleAuthAction}
                className={`flex items-center gap-2 rounded-[14px] px-6 py-2.5 text-sm font-bold transition-all ${
                  canOpenCustomerDashboard
                    ? "bg-[#2C2416] text-white hover:bg-[#4A3820]"
                    : "border border-[#EDE8DF] bg-white text-[#6B5B3E] hover:bg-[#FBF7F0]"
                }`}
              >
                {canOpenCustomerDashboard ? (
                  <LayoutDashboard size={18} />
                ) : (
                  <User size={20} />
                )}
                {canOpenCustomerDashboard ? "Dashboard" : "Login"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <section className="mb-6 rounded-[26px] border border-[#EDE8DF] bg-[linear-gradient(180deg,#F8F2E9_0%,#FFFDF8_100%)] p-5 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
                Explore Dairies
              </p>
              <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[#2C1A0E] sm:text-[38px]" style={headingFont}>
                Find your next <span className="text-[#B8641A]">daily delivery</span>
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#8B7355]">
                Browse nearby dairies, compare starting prices, and pick a plan that matches your area and routine.
              </p>
            </div>
            <div className="rounded-[18px] border border-[#E7DDCF] bg-white/90 px-4 py-3.5 text-sm text-[#6B5B3E] backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">
                Current Area
              </p>
              <p className="mt-1 font-semibold text-[#2C1A0E]">
                {selectedCity ||
                  (detectedLocation === "Nearby" ? "Your Current Location" : detectedLocation) ||
                  "Your area"}
              </p>
            </div>
          </div>
        </section>

        {/* CITY QUICK LINKS */}
        {/* <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
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
        </div> */}

        {/* LOADING & ERRORS */}
        {loading ? (
          <LoadingIndicator className="py-20" />
        ) : loadError === "LOCATION_OFF" && !searchTerm && !selectedCity ? (
          <div className="rounded-[26px] border border-dashed border-[#D7C4AE] bg-[#FFFDF8] py-20 text-center shadow-sm">
            <MapPin size={48} className="mx-auto mb-4 text-[#D7C4AE]" />
            <h2 className="text-xl font-bold text-[#2C1A0E]" style={headingFont}>
              Location is turned off
            </h2>
            <p className="mt-2 text-[#8B7355]">
              Search for a city above or enable GPS to find dairies near you.
            </p>
          </div>
        ) : mappedDairies.length === 0 ? (
          <div className="rounded-[26px] border border-[#EDE8DF] bg-[#FFFDF8] py-20 text-center shadow-sm">
            <h3 className="text-xl font-bold text-[#2C1A0E]" style={headingFont}>
              No dairies found here 🚚
            </h3>
            <p className="mt-2 text-[#8B7355]">
              Try adjusting your search or radius.
            </p>
          </div>
        ) : (
          /* DAIRY GRID */
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mappedDairies.map((dairy) => (
                <div
                  key={dairy.id}
                  onClick={() => navigate(`/join/${dairy.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF8] shadow-[0_12px_32px_rgba(84,52,16,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(84,52,16,0.14)]"
                >
                  <div className="relative h-48 bg-[#F3E6D6]">
                    {dairy.image ? (
                      <img
                        src={dairy.image}
                        alt={dairy.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-[#B89E80]">
                        No Image
                      </div>
                    )}
                    {dairy.isSubscribed && (
                      <div className="absolute left-3 top-3 rounded-full bg-[#EEF5E7] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4A7C2F] shadow-sm">
                        My Subscription
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-[10px] bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#6B5B3E] backdrop-blur-sm">
                      <Clock size={12} className="mr-1 inline text-[#B8641A]" />
                      {dairy.distance}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="mb-1 truncate text-lg font-semibold text-[#2C1A0E]" style={headingFont}>
                      {dairy.name}
                    </h3>
                    <p className="mb-4 flex items-start gap-1 text-sm text-[#8B7355]">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{dairy.address}</span>
                    </p>

                    <div className="flex items-end justify-between border-t border-[#F2EDE4] pt-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                          Starts at
                        </span>
                        <p className="text-lg font-bold text-[#2C1A0E]">
                          ₹{dairy.minPrice}
                          <span className="text-sm font-normal text-[#8B7355]">
                            /L
                          </span>
                        </p>
                      </div>
                      <button className="rounded-[14px] bg-[#FFF1E4] px-5 py-2 text-xs font-bold text-[#B8641A] transition-colors group-hover:bg-[#B8641A] group-hover:text-white">
                        View Menu
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {loadingMore && (
              <div className="py-10 text-center text-[#A88763]">
                Loading more dairies...
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ExploreDairiesPage;

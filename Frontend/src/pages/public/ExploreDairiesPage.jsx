import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  Search,
  MapPin,
  Clock,
  User,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";

import {
  fetchNearbyDairies,
  fetchSearchDairies,
  fetchSearchSuggestions,
} from "../../api/public.api.js";
import { fetchCustomerSubscription } from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { useGeolocationAutoRetry } from "../../hooks/useGeolocationAutoRetry.js";
import {
  GEO_ERROR,
  requestDeviceLocation,
} from "../../utils/locationPermission.js";

const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";
const headingFont = { fontFamily: "'Lora', serif" };

const getPlatformUserAgent = () =>
  typeof navigator === "undefined" ? "" : navigator.userAgent || "";

const isAndroidRuntime = () =>
  /Android/i.test(getPlatformUserAgent()) || window.Capacitor?.getPlatform?.() === "android";

const openAndroidIntent = (intentUrl) => {
  if (!isAndroidRuntime()) return false;

  window.location.href = intentUrl;
  return true;
};

const ExploreDairiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchInputRef = useRef(null);
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
  const [locationDialog, setLocationDialog] = useState(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ---------- CENTRAL FETCH LOGIC ----------
  const loadNearby = useCallback(
    async ({ lat, lng, radius = 150, page = 0 }) => {
      try {
        if (page === 0) setLoading(true);
        else setLoadingMore(true);

        const cacheKey = `nearby-${lat}-${lng}-${page}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          const cachedData = JSON.parse(cached);
          if (page === 0) setDairies(cachedData);
          else setDairies((prev) => [...prev, ...cachedData]);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const res = await fetchNearbyDairies({ lat, lng, radius, page });
        const newDairies = res?.dairies || [];

        sessionStorage.setItem(cacheKey, JSON.stringify(newDairies));

        if (page === 0) setDairies(newDairies);
        else setDairies((prev) => [...prev, ...newDairies]);

        if (newDairies.length < 20) setHasMore(false);
      } catch (err) {
        console.error("Failed to fetch nearby dairies:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // ---------- INITIAL LOAD HANDLER ----------
  const handleInitLocation = useCallback(async ({ requestPermission = true } = {}) => {
    setLoading(true);
    setLoadError("");
    setLocationDialog(null);
    setRequestingLocation(requestPermission);
    try {
      const coords = await requestDeviceLocation({ userInitiated: requestPermission });
      setCurrentLat(coords.lat);
      setCurrentLng(coords.lng);
      setSelectedCity("");

      // Reverse Geocoding for UI display
      try {
        const response = await fetch(
          "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + coords.lat + "&lon=" + coords.lng
        );
        const data = await response.json();
        const cityName = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb || "Nearby";
        setDetectedLocation(cityName);
      } catch {
        setDetectedLocation("Nearby");
      }

      await loadNearby({ lat: coords.lat, lng: coords.lng, page: 0 });
    } catch (err) {
      const errorState = err?.state || GEO_ERROR.UNAVAILABLE;
      setLoadError(errorState);
      if (requestPermission || errorState === GEO_ERROR.PERMISSION_BLOCKED || errorState === GEO_ERROR.GPS_OFF) {
        setLocationDialog(errorState);
      }
      setLoading(false);
    } finally {
      setRequestingLocation(false);
    }
  }, [loadNearby]);

  useEffect(() => {
    handleInitLocation({ requestPermission: false });
  }, [handleInitLocation]);

  useGeolocationAutoRetry({
    enabled: loadError === GEO_ERROR.PERMISSION_REQUIRED || loadError === GEO_ERROR.PERMISSION_BLOCKED,
    onRetry: () => handleInitLocation({ requestPermission: false }),
  });

  const handleManualSearch = () => {
    setLocationDialog(null);
    setLoading(false);
    setLoadError("");
    searchInputRef.current?.focus();
  };

  const handleOpenSettings = () => {
    setLocationDialog(null);
    if (openAndroidIntent("intent://settings#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;scheme=package;S.android.provider.extra.APP_PACKAGE=com.dairystream.app;end")) {
      return;
    }
    window.open("chrome://settings/content/location", "_blank");
  };

  const handleOpenLocationServices = () => {
    setLocationDialog(null);
    if (openAndroidIntent("intent://settings#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end")) {
      return;
    }
    handleInitLocation({ requestPermission: true });
  };

  const getLocationDialogContent = () => {
    switch (locationDialog) {
      case GEO_ERROR.PERMISSION_BLOCKED:
        return {
          title: "Location permission has been blocked.",
          message: "Please enable it from: Settings > Apps > DairyVision > Permissions > Location",
          actions: [
            { label: "Open Settings", onClick: handleOpenSettings, primary: true },
            { label: "Search Manually", onClick: handleManualSearch },
          ],
        };
      case GEO_ERROR.GPS_OFF:
        return {
          title: "Your device location services are turned off.",
          message: "Please enable GPS to continue.",
          actions: [
            { label: "Enable GPS", onClick: handleOpenLocationServices, primary: true },
            { label: "Search Manually", onClick: handleManualSearch },
          ],
        };
      case GEO_ERROR.INSECURE_CONTEXT:
        return {
          title: "Secure connection required",
          message: "Location permission works only on HTTPS, except localhost during development.",
          actions: [{ label: "Search Manually", onClick: handleManualSearch, primary: true }],
        };
      case GEO_ERROR.TIMEOUT:
        return {
          title: "Location request timed out",
          message: "We could not get your GPS coordinates in time. Please try again or search manually.",
          actions: [
            { label: "Try Again", onClick: () => handleInitLocation({ requestPermission: true }), primary: true },
            { label: "Search Manually", onClick: handleManualSearch },
          ],
        };
      case GEO_ERROR.UNSUPPORTED:
        return {
          title: "Location is not supported",
          message: "This browser does not support device location. Please search for your area manually.",
          actions: [{ label: "Search Manually", onClick: handleManualSearch, primary: true }],
        };
      default:
        return {
          title: "Location Permission Required",
          message: "DairyVision needs your location to show nearby dairies and delivery availability.",
          actions: [
            { label: "Try Again", onClick: () => handleInitLocation({ requestPermission: true }), primary: true },
            { label: "Search Manually", onClick: handleManualSearch },
          ],
        };
    }
  };

  // ---------- INFINITE SCROLL ----------
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (!loadingMore && hasMore && currentLat && currentLng) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadNearby({ lat: currentLat, lng: currentLng, page: nextPage });
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [page, loadingMore, hasMore, currentLat, currentLng, loadNearby]);

  // ---------- SEARCH LOGIC ----------
  const loadSearch = useCallback(async (q) => {
    try {
      setLoading(true);
      const res = await fetchSearchDairies({ q });
      setDairies(res?.dairies || []);
      setLoadError("");
    } catch {
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
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  useEffect(() => {
    if (!searchTerm.trim()) return;
    const delay = setTimeout(() => {
      setSelectedCity("");
      loadSearch(searchTerm);
    }, 500);
    return () => clearTimeout(delay);
  }, [searchTerm, loadSearch]);

  // ---------- AUTH & SUBSCRIPTION ----------
  const isLoggedIn = Boolean(user?.token || localStorage.getItem("user"));
  const isCustomer = isLoggedIn && (user?.role || localStorage.getItem("userRole")) === "CUSTOMER";
  const canOpenCustomerDashboard = isCustomer && sessionStorage.getItem(DASHBOARD_VISITED_FLAG) === "true";

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
        distance: typeof d.distance === "number" ? `${d.distance.toFixed(1)} km` : "—",
        image: d.image_url || "",
        address: d.address || d.city || "",
        minPrice: d.min_price ?? 50,
        isSubscribed: activeSubData?.dairy_id === d.id,
      }))
      .sort((a, b) => (a.isSubscribed === b.isSubscribed ? 0 : a.isSubscribed ? -1 : 1));
  }, [dairies, activeSubData]);

  const handleAuthAction = () => {
    if (canOpenCustomerDashboard) return navigate("/customer/dashboard");
    navigate("/", { replace: true });
  };

  const isLocationError = Object.values(GEO_ERROR).includes(loadError);

  return (
    <div className="min-h-screen bg-[#F7F2EA]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header className="sticky top-0 z-10 border-b border-[#EDE8DF] bg-[#FFFDF8]/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2.5 md:py-4 md:px-6">
          <div className="flex flex-col gap-2.5 md:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2.5 sm:gap-4 sm:items-center justify-between md:flex-row md:justify-start md:gap-6">
              <div className="flex items-center justify-between w-full md:w-auto">
                <div className="cursor-pointer text-2xl font-bold text-[#2C1A0E]" style={headingFont} onClick={() => navigate("/")}>
                  Dairy<span className="text-[#B8641A]">Vision</span>
                </div>
                <div className="md:hidden">
                  <button onClick={handleAuthAction} className={`flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm font-bold transition-all ${canOpenCustomerDashboard ? "bg-[#2C2416] text-white hover:bg-[#4A3820]" : "border border-[#EDE8DF] bg-white text-[#6B5B3E] hover:bg-[#FBF7F0]"}`}>
                    {canOpenCustomerDashboard ? <LayoutDashboard size={16} /> : <User size={16} />}
                    {canOpenCustomerDashboard ? "Dashboard" : "Login"}
                  </button>
                </div>
              </div>

              <div className="relative w-full md:w-auto">
                <button className="flex w-full md:w-auto items-center justify-center md:justify-start gap-2 rounded-full border border-[#EDE8DF] bg-[#FBF7F0] px-3 py-1.5 md:py-2 text-[#6B5B3E] transition-colors hover:bg-[#F5EDE2]">
                  <MapPin size={16} className="text-[#B8641A] md:w-[18px] md:h-[18px]" />
                  <span className="text-xs md:text-sm font-medium">
                    Delivering to <b>{selectedCity || (detectedLocation === "Nearby" ? "Your Current Location" : detectedLocation) || "Your area"}</b>
                  </span>
                </button>
              </div>
            </div>

            <div className="relative max-w-2xl flex-1 w-full">
              <Search className="absolute left-4 top-2.5 md:top-3.5 text-[#C4A882] w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search dairies, area, pincode..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                className="w-full rounded-[14px] md:rounded-[16px] border border-[#EDE8DF] bg-[#FFFDF8] py-2 md:py-3 pl-10 md:pl-12 pr-4 text-[#2C1A0E] outline-none transition focus:border-[#D7B38A] focus:ring-2 focus:ring-[#F3DEC4] text-sm md:text-base"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-[18px] border border-[#EDE8DF] bg-white shadow-[0_20px_40px_rgba(84,52,16,0.12)]">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex cursor-pointer justify-between px-4 py-3 text-[#6B5B3E] transition hover:bg-[#FBF7F0]" onClick={() => {
                        setSearchTerm(s.suggestion);
                        setSuggestions([]);
                        setShowSuggestions(false);
                        setSelectedCity("");
                        loadSearch(s.suggestion);
                      }}>
                      <span>{s.suggestion}</span>
                      <span className="text-xs uppercase tracking-[0.16em] text-[#C4A882]">{s.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button onClick={handleAuthAction} className={`flex items-center gap-2 rounded-[14px] px-6 py-2.5 text-sm font-bold transition-all ${canOpenCustomerDashboard ? "bg-[#2C2416] text-white hover:bg-[#4A3820]" : "border border-[#EDE8DF] bg-white text-[#6B5B3E] hover:bg-[#FBF7F0]"}`}>
                {canOpenCustomerDashboard ? <LayoutDashboard size={18} /> : <User size={20} />}
                {canOpenCustomerDashboard ? "Dashboard" : "Login"}
              </button>
            </div>
          </div>
          <p className="mt-2 md:pl-20 pl-1 text-xs leading-5 text-[#8B7355] hidden md:block">
            Browse nearby dairies, compare starting prices, and pick a plan that matches your area and routine.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {loading ? (
          <LoadingIndicator className="py-20" />
        ) : isLocationError && !searchTerm && !selectedCity ? (
          <div className="rounded-[26px] border border-dashed border-[#D7C4AE] bg-[#FFFDF8] py-20 text-center shadow-sm px-6">
            <MapPin size={48} className="mx-auto mb-4 text-[#D7C4AE]" />
            <h2 className="text-xl font-bold text-[#2C1A0E]" style={headingFont}>
              {loadError === GEO_ERROR.PERMISSION_REQUIRED ? "Location Permission Required" : "Location is unavailable"}
            </h2>
            <p className="mt-2 text-[#8B7355] max-w-md mx-auto">
              We need your location to show dairies near you. Please enable location access or search manually above.
            </p>
            <button 
              onClick={() => handleInitLocation({ requestPermission: true })}
              disabled={requestingLocation}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#B8641A] text-white rounded-full font-bold shadow-lg hover:bg-[#965215] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw size={18} className={requestingLocation ? "animate-spin" : ""} />
              {requestingLocation ? "Requesting..." : "Enable Location"}
            </button>
          </div>
        ) : mappedDairies.length === 0 ? (
          <div className="rounded-[26px] border border-[#EDE8DF] bg-[#FFFDF8] py-20 text-center shadow-sm">
            <h3 className="text-xl font-bold text-[#2C1A0E]" style={headingFont}>No dairies found here 🚚</h3>
            <p className="mt-2 text-[#8B7355]">Try adjusting your search or enabling location.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {mappedDairies.map((dairy) => (
              <div key={dairy.id} onClick={() => navigate(`/join/${dairy.id}`)} className="group cursor-pointer overflow-hidden rounded-[16px] md:rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF8] shadow-[0_12px_32px_rgba(84,52,16,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(84,52,16,0.14)]">
                <div className="relative h-32 md:h-48 bg-[#F3E6D6]">
                  {dairy.image ? (
                    <img src={dairy.image} alt={dairy.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#B89E80]">No Image</div>
                  )}
                  {dairy.isSubscribed && (
                    <div className="absolute left-2 top-2 md:left-3 md:top-3 rounded-full bg-[#EEF5E7] px-2 py-0.5 md:px-3 md:py-1 text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-[#4A7C2F] shadow-sm">My Sub</div>
                  )}
                  <div className="absolute right-2 top-2 md:right-3 md:top-3 rounded-[8px] md:rounded-[10px] bg-white/90 px-2 py-1 md:px-2.5 md:py-1.5 text-[10px] md:text-xs font-bold text-[#6B5B3E] backdrop-blur-sm">
                    <Clock className="mr-0.5 md:mr-1 inline text-[#B8641A] w-[10px] h-[10px] md:w-[12px] md:h-[12px]" /> {dairy.distance}
                  </div>
                </div>
                <div className="p-3 md:p-5">
                  <h3 className="mb-0.5 truncate text-sm md:text-lg font-semibold text-[#2C1A0E]" style={headingFont}>{dairy.name}</h3>
                  <p className="mb-3 flex items-start gap-0.5 text-xs md:text-sm text-[#8B7355]">
                    <MapPin className="mt-0.5 shrink-0 w-[12px] h-[12px] md:w-[14px] md:h-[14px]" />
                    <span className="line-clamp-1">{dairy.address}</span>
                  </p>
                  <div className="flex items-center justify-between border-t border-[#F2EDE4] pt-3 md:pt-4">
                    <div>
                      <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.14em] md:tracking-[0.18em] text-[#C4A882]">Starts at</span>
                      <p className="text-sm md:text-lg font-bold text-[#2C1A0E]">₹{dairy.minPrice}<span className="text-xs md:text-sm font-normal text-[#8B7355]">/L</span></p>
                    </div>
                    <button className="rounded-[10px] md:rounded-[14px] bg-[#FFF1E4] px-3 py-1.5 md:px-5 md:py-2 text-[10px] md:text-xs font-bold text-[#B8641A] transition-colors group-hover:bg-[#B8641A] group-hover:text-white">View Menu</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {loadingMore && <div className="py-10 text-center text-[#A88763]">Loading more dairies...</div>}
      </main>
      {locationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1A0E]/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 text-center shadow-[0_24px_70px_rgba(44,26,14,0.22)]">
            <MapPin size={36} className="mx-auto mb-4 text-[#B8641A]" />
            <h3 className="text-lg font-bold text-[#2C1A0E]" style={headingFont}>
              {getLocationDialogContent().title}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#6B5B3E]">
              {getLocationDialogContent().message}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {getLocationDialogContent().actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={
                    action.primary
                      ? "rounded-full bg-[#B8641A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#965215]"
                      : "rounded-full border border-[#EDE8DF] bg-white px-5 py-3 text-sm font-bold text-[#6B5B3E] transition hover:bg-[#FBF7F0]"
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploreDairiesPage;


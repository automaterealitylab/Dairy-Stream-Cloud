import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import client from "../api/client";
import {
  User,
  Phone,
  Building2,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
  LocateFixed,
  X,
} from "lucide-react";
import dairyImage from "../assets/dairyproduct.jpg";
import { useGeolocationAutoRetry } from "../hooks/useGeolocationAutoRetry.js";

const headingFont = { fontFamily: "'Lora', serif" };
const DEFAULT_MAP_CENTER = [18.5204, 73.8567];
const customerPinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const labelClassName =
  "mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]";

const MapViewUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 1.2,
      });
    }
  }, [center, map]);

  return null;
};

const MapPinSelector = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

const CustomerRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    buildingName: "",
    wing: "",
    roomNo: "",
    latitude: null,
    longitude: null,
  });

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (location.state?.mobile) {
      setFormData((prev) => ({ ...prev, phoneNumber: location.state.mobile }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!formData.customerName.trim()) return "Please enter your Full Name";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.phoneNumber || formData.phoneNumber.length !== 10) {
      return "Valid 10-digit Mobile Number is required";
    }
    return null;
  };

  const validateStep2 = () => {
    if (!formData.addressLine1.trim()) return "Please enter Address Line 1";
    if (!formData.roomNo.trim()) return "Room No is required";
    return null;
  };

  const validateStep3 = () => {
    if (!Number.isFinite(Number(formData.latitude)) || !Number.isFinite(Number(formData.longitude))) {
      return "Please allow GPS or tap the map to pin your exact location";
    }
    return null;
  };

  const setPinnedLocation = (latitude, longitude) => {
    const lat = Number(Number(latitude).toFixed(6));
    const lng = Number(Number(longitude).toFixed(6));

    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    setMapCenter([lat, lng]);
    setError("");
  };

  const detectCurrentLocation = ({ showToast = true, pinIfMissing = true } = {}) => {
    if (!navigator.geolocation) {
      const message = "GPS location is not supported in this browser";
      setError(message);
      if (showToast) toast.error(message);
      return;
    }

    const hasPinnedLocation =
      Number.isFinite(Number(formData.latitude)) &&
      Number.isFinite(Number(formData.longitude));
    const toastId = showToast ? toast.loading("Getting your current location...") : null;

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setGpsLocation({ lat, lng });
        setMapCenter([lat, lng]);

        if (pinIfMissing || !hasPinnedLocation) {
          setPinnedLocation(lat, lng);
        } else {
          setError("");
        }

        setLocating(false);

        if (showToast) {
          toast.success("Current location captured", { id: toastId });
        }
      },
      (geoError) => {
        let message = "Unable to fetch your current location";
        if (geoError?.code === 1) {
          message = "Location permission denied. Please allow GPS access and try again.";
        } else if (geoError?.code === 2) {
          message = "Your current location could not be determined.";
        } else if (geoError?.code === 3) {
          message = "Location request timed out. Please try again.";
        }

        setLocating(false);
        setError(message);

        if (showToast) {
          toast.error(message, { id: toastId });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleNext = (e) => {
    e.preventDefault();
    const err =
      currentStep === 1
        ? validateStep1()
        : currentStep === 2
        ? validateStep2()
        : validateStep3();

    if (err) {
      setError(err);
      return;
    }
    setError("");
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  useEffect(() => {
    if (currentStep === 3 && !gpsLocation && !locating) {
      detectCurrentLocation({ showToast: false, pinIfMissing: true });
    }
  }, [currentStep]);

  useGeolocationAutoRetry({
    enabled: currentStep === 3 && !gpsLocation && !locating,
    onRetry: () => {
      detectCurrentLocation({ showToast: false, pinIfMissing: true });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const locationError = validateStep3();
    if (locationError) {
      setError(locationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await client.post("/customer/addCustomer", formData);

      toast.success("Account created successfully. Please login.");
      navigate("/", {
        state: {
          message: "Account created successfully. Please login.",
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Something went wrong. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderTermsModal = () => {
    if (!showTerms) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-4">
            <h3 className="text-xl font-semibold text-[#2C1A0E]" style={{ fontFamily: "'Lora', serif" }}>
              Terms & Conditions of Service
            </h3>
            <button
              type="button"
              onClick={() => setShowTerms(false)}
              className="rounded-full p-1.5 text-[#A88763] hover:bg-[#F5F0E8] hover:text-[#2C1A0E] transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto my-4 pr-2 space-y-4 text-[#5C3D1E] text-sm leading-relaxed flex-1 scrollbar-thin">
            <p className="font-semibold text-xs text-[#A88763] uppercase tracking-[0.1em]">Effective Date: June 28, 2026</p>
            <p className="text-xs">
              Welcome to the DairyVision platform. These Terms and Conditions govern your engagement with the Dairy Automation System, acting as a binding agreement for all Customers, Delivery Agents, Admins, and Milk Suppliers.
            </p>
            
            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">1. PLATFORM SCOPE & ROLES</h4>
              <p className="text-xs text-[#5C3D1E] mb-2">
                DairyVision serves as a centralized dairy distribution system. The platform maintains distinct operational portals for each of the following system roles:
              </p>
              <ul className="list-decimal pl-5 space-y-2 text-xs">
                <li><strong>Customers:</strong> Subscribe to daily fresh milk products, configure vacations, view delivery logs, and settle ledger invoices.</li>
                <li><strong>Delivery Agents:</strong> Route-assigned drivers who retrieve bulk crates from dairy hubs, verify batch counts, and execute morning dispatches.</li>
                <li><strong>Suppliers:</strong> Local dairy farms and raw milk suppliers who deliver bulk milk to the collection centers, subject to quality analysis.</li>
                <li><strong>Admins:</strong> System coordinators responsible for auditing ledgers, verifying payments, managing procurement records, and adjusting routes.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">2. CUSTOMER SUBSCRIPTIONS & DELIVERY CUTOFFS</h4>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Subscription Customization:</strong> Customers can set up recurring dispatches (daily, alternate days, weekly, or custom schedules) for products like cow milk, buffalo milk, paneer, and other dairy items.</li>
                <li><strong>Strict 10:00 PM Cutoff:</strong> Modifications to your delivery plan—such as quantity adjustments, item additions, pause requests, or vacation holds—must be saved in the application before <strong>10:00 PM</strong> on the evening preceding the delivery. Changes submitted after 10:00 PM are automatically processed for the next delivery cycle.</li>
                <li><strong>Delivery Coordinates Pinning:</strong> To ensure accurate early-morning dispatches, customers must drop a precise marker on the interactive GPS map. You must also supply clear details like building names, wing labels, room numbers, and preferred drop-box locations. Neither the platform nor the delivery agents are liable for deliveries missed due to locked gates or incorrect map pins.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">3. FINANCIAL TRANSACTIONS, PAYMENT SYSTEMS & LEDGER AUDITS</h4>
              <p className="text-xs text-[#5C3D1E] mb-2">
                DairyVision employs a strict billing ledger system designed to track customer orders, payments, and balances. You agree to the following financial terms:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Prepaid Wallet Balance:</strong> Customers may pre-fund their account wallet. The system automatically calculates delivery costs at fulfillment and deducts matching amounts. Overpayments or double deposits automatically convert into wallet credits applied to future deliveries.</li>
                <li><strong>Postpaid Invoicing Cycles:</strong> For postpaid customers, invoices are generated automatically at the end of each billing period (weekly or monthly). Balance statements must be cleared within <strong>5 calendar days</strong>. Unresolved balances after 5 days trigger automatic delivery suspensions.</li>
                <li><strong>Integrated Gateway Payments:</strong> Online payments are processed securely via integrated gateways (e.g. Razorpay). By using online checkout, you agree to the payment provider's terms and consent to pay any transaction surcharges or local service taxes.</li>
                <li><strong>Manual Invoice Uploads & Audits:</strong> In cases where bank transfers or offline deposits are performed, customers must upload digital transaction receipts (screenshot proofs) via their panel. These uploads enter a pending state and will update your active balance only after manual validation and clearance by a Platform Admin.</li>
                <li><strong>Agent Field Collections:</strong> Delivery agents are authorized to record offline collections (Cash, UPI, Bank Transfer) in the field using the Agent App. Payments logged by agents update the customer's ledger balance immediately. If a customer pays less than the due bill, the remaining balance stays due; if they pay extra, the remainder is credited to their wallet balance.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">4. LOGISTICAL AGENT DELIVERY OPERATIONS</h4>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Fulfillment Timelines:</strong> Agents must retrieve designated crate batches from distribution hubs and complete all deliveries along their assigned routes between <strong>5:00 AM and 8:00 AM</strong> daily.</li>
                <li><strong>Proof of Delivery (PoD):</strong> For each drop-off, agents must upload verified proof, including geo-tagged photos, customer signature logs, or customer QR code scans. Deliveries marked completed without PoD will trigger review audits.</li>
                <li><strong>Live Location Consent:</strong> Agents consent to the active tracking and broadcasting of their GPS coordinates to customers and admins during working hours to provide real-time ETAs and route progress.</li>
                <li><strong>Ratings & Route Assigns:</strong> Agent performance is calculated based on on-time delivery rates, customer ratings, and PoD compliance. Persistent low ratings (below 4.0 stars over a rolling 30-day window) will result in route suspension.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">5. SUPPLIER PROCUREMENT, QUALITY CRITERIA & SETTLEMENTS</h4>
              <p className="text-xs text-[#5C3D1E] mb-2">
                Suppliers delivering bulk raw milk to collection centers agree to the following quality-based payout terms:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>FAT & SNF Testing:</strong> Every raw milk batch is tested at intake using laboratory analyzers to measure <strong>FAT percentage</strong> and <strong>SNF (Solid Not Fat) percentage</strong>. These parameters determine milk quality and density.</li>
                <li><strong>Quality Multipliers:</strong> Payout rates are calculated based on a quality-multiplier matrix. Raw milk falling below standard thresholds (e.g. low FAT or SNF content) may be rejected or subject to price deductions.</li>
                <li><strong>Supplier Ledger Settle:</strong> Payout calculations are compiled weekly/monthly under the Supplier Ledger. Admins process disbursements directly to verified supplier bank accounts after auditing records.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">6. OPERATOR ADMIN PRIVILEGES</h4>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>System Override:</strong> Admins retain full rights to update product catalogs, modify pricing tiers, adjust delivery routes, assign or terminate agent tasks, and audit logs.</li>
                <li><strong>Route Clustering:</strong> Admins use coordinate grouping algorithms to reallocate customer clusters, optimizing agent travel distances and route efficiency.</li>
                <li><strong>Governance & Suspensions:</strong> Admins reserve the right to suspend or block any customer, agent, or supplier account found in breach of terms or defaulting on financial/delivery obligations.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">7. LIMITATION OF LIABILITY & FORCE MAJEURE</h4>
              <p className="text-xs">
                DairyVision acts as a service connector. We do not warrant that delivery services will be uninterrupted or error-free. Neither party shall be liable for delivery failures, stock shortages, or delay occurrences resulting from force majeure conditions, including extreme weather events, road blockages, labor strikes, vehicle failures, pandemic restrictions, or source farm shortages.
              </p>
            </div>
          </div>
          <div className="border-t border-[#F2EDE4] pt-4">
            <button
              type="button"
              onClick={() => setShowTerms(false)}
              className="w-full rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white transition hover:bg-[#9F5313]"
            >
              I Agree & Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPrivacyModal = () => {
    if (!showPrivacy) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-4">
            <h3 className="text-xl font-semibold text-[#2C1A0E]" style={{ fontFamily: "'Lora', serif" }}>
              Privacy & Data Policy
            </h3>
            <button
              type="button"
              onClick={() => setShowPrivacy(false)}
              className="rounded-full p-1.5 text-[#A88763] hover:bg-[#F5F0E8] hover:text-[#2C1A0E] transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto my-4 pr-2 space-y-4 text-[#5C3D1E] text-sm leading-relaxed flex-1 scrollbar-thin">
            <p className="font-semibold text-xs text-[#A88763] uppercase tracking-[0.1em]">Last Updated: June 28, 2026</p>
            <p className="text-xs">
              DairyVision is committed to securing your personal and operational information. This Privacy Policy details how we collect, store, and utilize data metrics generated by Customers, Delivery Agents, Suppliers, and Platform Admins.
            </p>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">1. METRIC COLLECTION SCHEMAS</h4>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Customer Data:</strong> Profile details (name, email, verified mobile number), billing address, custom delivery coordinates, payment transaction logs, manual invoice uploads, subscription preferences, and delivery history logs.</li>
                <li><strong>Agent Data:</strong> Physical identity verification metadata, driver licenses, vehicle parameters, background check indicators, shift availability schedules, real-time background GPS tracking entries, fulfillment ratings, and payout histories.</li>
                <li><strong>Supplier Data:</strong> Bank profiles, raw milk quality testing logs (FAT & SNF percentages), invoice histories, and payment settlement records.</li>
                <li><strong>Admin Data:</strong> System credentials, activity records, database modifications, and audit logs.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">2. DETAILED GEOLOCATION PROCESSING</h4>
              <p className="text-xs text-[#5C3D1E] mb-2">
                Location processing is critical to our early-morning logistical flow. Geolocation is tracked in the following ways:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Customer Pins:</strong> The latitude and longitude pinned by the customer is parsed by our route-grouping algorithm to automatically organize customers into spatial clusters. This minimizes delivery path lengths for our agents.</li>
                <li><strong>Agent Geolocation tracking:</strong> Delivery agents undergo foreground and background geolocation tracking when active on their delivery route. This coordinate stream is securely broadcast to assigned customers via active tracking pages, providing real-time ETAs and map tracking. Geolocation tracking ceases automatically once the agent updates their status to off-duty.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">3. FINANCIAL & TRANSACTION DATA PROTECTION</h4>
              <p className="text-xs">
                To process payments safely, the platform collects bank account numbers, payment transaction identifiers, and uploaded bank receipts. Online payments are secured using tokenized transactions processed directly by third-party processors, meaning no raw card details are cached or stored on our servers. Uploaded manual payment screenshots are restricted exclusively to Admin auditing teams and are deleted automatically once the balance is reconciled. Supplier bank profiles are encrypted at rest using database security features.
              </p>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">4. CORE DATA PROCESSING GOALS</h4>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Logistics Operations:</strong> Planning dispatch rosters, managing daily products distribution, and tracking route progress.</li>
                <li><strong>Billing & Account Security:</strong> Resolving monthly transaction logs, processing billing queries, and generating payment tokens.</li>
                <li><strong>Audit Trails:</strong> Monitoring procurement records, supplier quality (FAT & SNF) histories, admin adjustments, and platform transactions to ensure complete platform safety.</li>
              </ul>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">5. SHARING RESTRICTIONS & ZERO-COMMERCIAL USE</h4>
              <p className="text-xs">
                We implement a strict zero-sharing protocol with external marketers. Customer details are only shared internally with the assigned delivery agent (restricted to name, physical address, and contact number) to complete delivery routes. Financial queries are sent via tokenized requests to our secure payment gateway providers.
              </p>
            </div>

            <div className="border-t border-[#F2EDE4] pt-3">
              <h4 className="font-bold text-[#2C1A0E] mb-1.5">6. DATABASE ENCRYPTION & DATA RETENTION</h4>
              <p className="text-xs">
                Passwords are encrypted using bcrypt hashing protocols. Geolocation coordinate tables are periodically archived or cleared to minimize historical storage overhead. Active profiles are maintained in secure, encrypted Supabase PostgreSQL database tables. Users may request account closures and profile deactivation by sending a ticket to support.
              </p>
            </div>
          </div>
          <div className="border-t border-[#F2EDE4] pt-4">
            <button
              type="button"
              onClick={() => setShowPrivacy(false)}
              className="w-full rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white transition hover:bg-[#9F5313]"
            >
              I Understand & Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] lg:grid lg:grid-cols-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-12 text-white md:flex md:items-center md:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.18),transparent_40%)]" />
        <div className="relative z-10 max-w-lg">
          <h1 className="mb-6 text-5xl font-semibold tracking-tight" style={headingFont}>
            Join DairyVision
          </h1>
          <p className="mb-8 text-xl leading-relaxed text-[#F5E6D2]">
            Create your account to start managing your daily milk delivery, billing, and vacations effortlessly.
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <ShieldCheck size={20} />
              <span>Secure Data</span>
            </div>
            <div className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <CheckCircle size={20} />
              <span>Easy Billing</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#D28A40]/20 blur-3xl" />
      </div>

      <div className="relative flex w-full items-center justify-center px-4 py-8 sm:px-6 md:w-full">
        <div className="w-full max-w-md rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-6 shadow-[0_24px_60px_rgba(44,26,14,0.12)] sm:p-8">
          <div className="mb-6 text-center">
            <img
              src={dairyImage}
              alt="Logo"
              width="1600"
              height="1080"
              loading="lazy"
              decoding="async"
              className="mx-auto mb-2 h-16 w-auto object-contain"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Customer Register</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              Create Account
            </h2>
            <p className="text-sm text-[#8B7355]">
              Step {currentStep} of 3: {currentStep === 1 ? "Personal Details" : currentStep === 2 ? "Address Details" : "Exact Location"}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] p-3 text-sm text-[#C0392B]">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={currentStep < 3 ? handleNext : handleSubmit}>
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-5">
                <div>
                  <label className={labelClassName}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className={`pl-10 ${inputClassName}`}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="9876543210"
                      maxLength={10}
                      className={`pl-10 ${
                        location.state?.mobile
                          ? "w-full rounded-[16px] border border-[#EFD7B3] bg-[#FFF4E2] px-4 py-3 text-sm font-semibold text-[#6B5B3E] outline-none"
                          : inputClassName
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#A88763]">This will be your login ID.</p>
                </div>

                <div>
                  <label className={labelClassName}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="rahul@gmail.com"
                    className={inputClassName}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3.5 font-semibold text-white transition-all hover:bg-[#9F5313]"
                >
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                <div>
                  <label className={labelClassName}>Address Line 1</label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleChange}
                    placeholder="Flat / house / street"
                    className={inputClassName}
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelClassName}>Address Line 2 (Opt)</label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    placeholder="Area / landmark"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Building Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="text"
                      name="buildingName"
                      value={formData.buildingName}
                      onChange={handleChange}
                      placeholder="Galaxy Apartments"
                      className={`pl-10 ${inputClassName}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Wing (Opt)</label>
                    <input
                      type="text"
                      name="wing"
                      value={formData.wing}
                      onChange={handleChange}
                      placeholder="A"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Room No</label>
                    <input
                      type="text"
                      name="roomNo"
                      value={formData.roomNo}
                      onChange={handleChange}
                      placeholder="101"
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-[16px] border border-[#EDE8DF] bg-white py-3 font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-2/3 items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white transition-all hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                  >
                    Continue to Map <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                <div className="rounded-[18px] border border-[#E7DAC6] bg-[#FFF8F0] p-4 text-sm text-[#6E5232]">
                  Allow GPS to show your current location, then tap the map to place your exact delivery pin.
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-[#E7DAC6] bg-white px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => detectCurrentLocation({ showToast: true, pinIfMissing: true })}
                    disabled={locating}
                    className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-[#EFD7B3] bg-[#FFF4E2] px-3 py-2 text-xs font-semibold text-[#B8641A] transition hover:bg-[#FCE8CB] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {locating ? <Loader2 className="animate-spin" size={16} /> : <LocateFixed size={16} />}
                    {locating ? "Locating..." : "Use Current Location"}
                  </button>

                  <div className="min-w-0 flex-1 text-xs font-medium text-[#5C3D1E]">
                    {gpsLocation
                      ? `GPS: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}`
                      : "GPS location not captured yet. Tap the button or place the pin manually."}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[20px] border border-[#E7DAC6]">
                  <div className="relative w-full h-[320px]">
        <MapContainer
                    center={mapCenter}
                    zoom={17}
                    scrollWheelZoom
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapViewUpdater center={mapCenter} />
                    <MapPinSelector onSelect={setPinnedLocation} />

                    {gpsLocation && (
                      <CircleMarker
                        center={[gpsLocation.lat, gpsLocation.lng]}
                        radius={10}
                        pathOptions={{
                          color: "#2563EB",
                          fillColor: "#60A5FA",
                          fillOpacity: 0.6,
                          weight: 2,
                        }}
                      />
                    )}

                    {Number.isFinite(Number(formData.latitude)) &&
                      Number.isFinite(Number(formData.longitude)) && (
                        <Marker
                          position={[Number(formData.latitude), Number(formData.longitude)]}
                          icon={customerPinIcon}
                        />
                      )}
                  </MapContainer>
        <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
          DairyVision Maps
        </div>
      </div>
          
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-1/3 rounded-[16px] border border-[#EDE8DF] bg-white py-3 font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || locating}
                    className="flex w-2/3 items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white transition-all hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Finish Registration"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 border-t border-[#F2EDE4] pt-6 text-center text-xs text-[#A88763]">
            By joining, you agree to our{" "}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="underline hover:text-[#B8641A] transition-colors font-semibold"
            >
              Terms
            </button>{" "}
            &{" "}
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="underline hover:text-[#B8641A] transition-colors font-semibold"
            >
              Privacy Policy
            </button>
            .
            <div className="mt-2">
              Already have an account?{" "}
              <span onClick={() => navigate("/")} className="cursor-pointer font-bold text-[#B8641A] hover:underline">
                Log in
              </span>
            </div>
          </div>
        </div>
      </div>
      {renderTermsModal()}
      {renderPrivacyModal()}
    </div>
  );
};

export default CustomerRegister;

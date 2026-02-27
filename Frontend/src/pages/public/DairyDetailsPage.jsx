import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  MapPin,
  ShieldCheck,
  Truck,
  X,
  CheckCircle2,
  ChevronRight,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  fetchCustomerProfile,
  fetchCustomerSubscription,
  saveCustomerSubscription,
} from "../../api/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

const buildAddressFromParts = (source = {}) => {
  const directAddress = [
    source.address,
    source.fullAddress,
    source.areaSectorLocality,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  if (directAddress) return directAddress.trim();

  const parts = [
    source.building_name || source.buildingName || "",
    source.wing || "",
    source.room_no || source.roomNo || "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};

const DairyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data States
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingSubscription, setExistingSubscription] = useState(null);

  // UI States
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form States
  const [address, setAddress] = useState("");
  const [subscription, setSubscription] = useState({
    milkType: "Full Cream",
    quantity: 1,
    slot: "Morning",
    startDate: new Date().toISOString().slice(0, 10),
  });

  // 1. Load Data on Mount
  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        // Fetch Dairy Info
        const res = await fetchPublicDairyById(id);
        setData(res?.dairy || null);

        // Fetch User's current sub (to prevent double subscription)
        const token = localStorage.getItem("token");
        if (token) {
          try {
            const subRes = await fetchCustomerSubscription();
            setExistingSubscription(subRes?.subscription || null);
          } catch {
            setExistingSubscription(null);
          }
        } else {
          setExistingSubscription(null);
        }

        // Prefill address from customer profile first, then local storage fallback.
        let resolvedAddress = "";
        if (token) {
          try {
            const profile = await fetchCustomerProfile();
            resolvedAddress = buildAddressFromParts(profile);
          } catch {
            resolvedAddress = "";
          }
        }

        if (!resolvedAddress) {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              resolvedAddress =
                buildAddressFromParts(user) ||
                buildAddressFromParts(user?.user || {});
            } catch {
              resolvedAddress = "";
            }
          }
        }

        setAddress(resolvedAddress);
      } catch (err) {
        toast.error("Error loading dairy details");
      } finally {
        setLoading(false);
      }
    };
    loadPageData();
  }, [id]);

  // 2. Data Mappers
  const dairy = useMemo(() => {
    if (!data) return null;
    return {
      id: data.id,
      name: data.dairy_name || data.name || "Dairy Farm",
      image: data.image_url || "",
      description: data.description || "Fresh milk delivered to your doorstep.",
      address: data.address || data.city || "Address not available",
      rating: data.rating || 4.5,
      products: data.products || {
        "Full Cream": 64,
        Toned: 54,
        "Cow Milk": 60,
        "Buffalo Milk": 72,
      },
    };
  }, [data]);

  const currentPrice = useMemo(() => {
    return dairy?.products[subscription.milkType] || 0;
  }, [dairy, subscription.milkType]);

  const isSubscribedToThis = useMemo(() => {
    if (!existingSubscription) return false;
    return String(existingSubscription.dairy_id) === String(id);
  }, [existingSubscription, id]);

  const hasActiveSubscription = useMemo(() => {
    if (!existingSubscription) return false;
    return String(existingSubscription.status || "ACTIVE").toUpperCase() !== "CLOSED";
  }, [existingSubscription]);

  // 3. Handlers
  const handleConfirmSubscription = async () => {
    setSaving(true);
    try {
      await saveCustomerSubscription({
        dairyId: dairy.id,
        milkType: subscription.milkType,
        quantity: Number(subscription.quantity),
        slot: subscription.slot,
        startDate: subscription.startDate,
        address: address,
        pricePerLiter: currentPrice,
        status: "ACTIVE",
      });

      toast.success("Subscription successful!");
      setStep(4);
    } catch (err) {
      toast.error(err.message || "Failed to subscribe");
    } finally {
      setSaving(false);
    }
  };

  const handleContinueFromStep2 = () => {
    if (!address || address.trim().length === 0) {
      toast.error("Delivery address is required to continue");
      return;
    }

    if (address.trim().length < 10) {
      toast.error("Please provide a more detailed delivery address");
      return;
    }

    setStep(3);
  };

  const handleSubscribeClick = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Login to take subscription first");
      return;
    }

    if (hasActiveSubscription && !isSubscribedToThis) {
      toast.error("You have active subscription. Close your subscription first.");
      return;
    }
    setShowSubscribe(true);
  };

  if (loading) return <LoadingIndicator fullScreen message="Fetching farm details..." />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900">{dairy.name}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="aspect-video w-full rounded-[40px] overflow-hidden shadow-2xl bg-slate-200">
            {dairy.image ? (
              <img src={dairy.image} alt={dairy.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No Image Available</div>
            )}
          </div>

          <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h2 className="text-2xl font-bold mb-4">About this Farm</h2>
            <p className="text-slate-600 leading-relaxed">{dairy.description}</p>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-slate-200 border border-white sticky top-28">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Starting from</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">Rs {currentPrice}</span>
                  <span className="text-slate-400 font-medium">/L</span>
                </div>
              </div>
              <div className="bg-green-500 text-white px-3 py-1 rounded-xl flex items-center gap-1 font-bold">
                {dairy.rating} <Star size={14} fill="white" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl">
                <ShieldCheck className="text-blue-600" size={20} />
                <span className="text-sm font-semibold">100% Organic & Verified</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl">
                <Truck className="text-blue-600" size={20} />
                <span className="text-sm font-semibold">Free Delivery (6 AM - 9 AM)</span>
              </div>
            </div>

            {isSubscribedToThis ? (
              <button
                onClick={() => navigate("/customer/dashboard/subscriptions")}
                className="w-full bg-green-600 text-white py-5 rounded-[24px] font-bold shadow-xl shadow-green-100 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} /> Active Subscription
              </button>
            ) : (
              <button
                onClick={handleSubscribeClick}
                className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
              >
                Subscribe Now <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showSubscribe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold">Setup Subscription</h2>
                <div className="flex gap-1.5 mt-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${step >= s ? "w-8 bg-blue-600" : "w-2 bg-slate-200"}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => setShowSubscribe(false)} className="p-2 hover:bg-white rounded-full border shadow-sm">
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Layers size={16} /> Select Variant
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {Object.keys(dairy.products).map((variant) => (
                        <button
                          key={variant}
                          onClick={() => setSubscription({ ...subscription, milkType: variant })}
                          className={`flex justify-between items-center p-4 border-2 rounded-2xl transition-all ${subscription.milkType === variant ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}
                        >
                          <span className="font-bold">{variant}</span>
                          <span className="text-blue-600 font-black">Rs {dairy.products[variant]}/L</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Daily Qty (L)</label>
                      <input
                        type="number"
                        step="0.5"
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500"
                        value={subscription.quantity}
                        onChange={(e) => setSubscription({ ...subscription, quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Time Slot</label>
                      <select
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none"
                        value={subscription.slot}
                        onChange={(e) => setSubscription({ ...subscription, slot: e.target.value })}
                      >
                        <option>Morning</option>
                        <option>Evening</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => setStep(2)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all">
                    Continue to Address
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2">
                      <MapPin size={16} className="text-red-500" /> Delivery Address *
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={4}
                      className={`w-full p-4 bg-slate-50 rounded-2xl border-2 outline-none transition-all ${!address.trim() ? "border-red-100" : "border-transparent focus:border-blue-500"}`}
                      placeholder="Enter your full address (Flat No, Building, Street...)"
                    />
                    {!address.trim() && (
                      <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">
                        Address cannot be empty
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="flex-1 py-4 font-bold text-slate-500">
                      Back
                    </button>
                    <button
                      onClick={handleContinueFromStep2}
                      disabled={!address.trim()}
                      className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-bold disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      Next: Billing
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="p-6 space-y-4">
                  <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl p-4 text-sm font-semibold">
                    Bill will be generated at the end of every month.
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl text-sm border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Selected Plan</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Milk Type</span>
                        <span className="font-semibold text-slate-900">{subscription.milkType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Rate</span>
                        <span className="font-semibold text-slate-900">Rs {currentPrice}/L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quantity</span>
                        <span className="font-semibold text-slate-900">{subscription.quantity} L/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Delivery Slot</span>
                        <span className="font-semibold text-slate-900">{subscription.slot}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between">
                        <span className="text-slate-500">Estimated Daily Amount</span>
                        <span className="font-black text-blue-600">Rs {currentPrice * subscription.quantity}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      disabled={saving}
                      onClick={handleConfirmSubscription}
                      className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold"
                    >
                      {saving ? "Processing..." : "Confirm Subscription"}
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="py-10 text-center space-y-6">
                  <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Subscription Started!</h3>
                    <p className="text-slate-500 mt-2">Your first delivery from {dairy.name} arrives tomorrow morning.</p>
                  </div>
                  <button onClick={() => navigate("/customer/dashboard")} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">
                    Go to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DairyDetailsPage;

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
  CreditCard,
  Wallet,
  Banknote,
  Calendar,
  Layers
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  fetchCustomerProfile,
  fetchCustomerSubscription,
  saveCustomerSubscription,
} from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { buildCustomerAddress } from "../../utils/customerAddress.js";

const DAY_OPTIONS = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
];

const headingFont = { fontFamily: "'Lora', serif" };

const normalizeAllProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || "").trim(),
        type: String(item.type || "MILK").trim().toUpperCase(),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
        unit: item.unit || "LITER",
      }))
      .filter((item) => item.name && item.ratePerUnit > 0);
  }

  const legacy = dairy?.products || {
    "Full Cream": 64,
    Toned: 54,
    "Cow Milk": 60,
    "Buffalo Milk": 72,
  };

  return Object.keys(legacy).map((name) => ({
    id: name,
    name,
    type: "MILK",
    ratePerUnit: Number(legacy[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
    unit: "LITER",
  }));
};

const getMilkProducts = (products = []) =>
  products.filter((item) => String(item.type || "MILK").trim().toUpperCase() === "MILK");

const isProductOutOfStock = (stockQuantity) => {
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock <= 0;
};

const formatProductStockLabel = (stockQuantity) => {
  const stock = Number(stockQuantity);
  if (!Number.isFinite(stock)) return "Fresh stock available";
  if (stock <= 0) return "Out of stock";
  return `${stock} left`;
};

const DairyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingSubscription, setExistingSubscription] = useState(null);

  const [showSubscribe, setShowSubscribe] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  const [address, setAddress] = useState("");
  const [subscription, setSubscription] = useState({
    milkType: "",
    quantity: 1,
    slot: "Morning",
    startDate: new Date().toISOString().slice(0, 10),
    deliveryDays: DAY_OPTIONS.map((day) => day.key),
  });

  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        const res = await fetchPublicDairyById(id);
        setData(res?.dairy || null);

        const token = localStorage.getItem("token");
        if (token) {
          try {
            const subRes = await fetchCustomerSubscription();
            setExistingSubscription(subRes?.subscription || null);
          } catch {
            setExistingSubscription(null);
          }

          try {
            const profile = await fetchCustomerProfile();
            setAddress(buildCustomerAddress(profile));
          } catch {
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
              try {
                const user = JSON.parse(storedUser);
                setAddress(buildCustomerAddress(user?.user || user || {}));
              } catch {
                // ignore malformed localStorage
              }
            }
          }
        } else {
          setExistingSubscription(null);
        }
      } catch (err) {
        toast.error("Error loading dairy details");
      } finally {
        setLoading(false);
      }
    };
    loadPageData();
  }, [id]);

  const dairy = useMemo(() => {
    if (!data) return null;
    const allProductItems = normalizeAllProducts(data);
    const productItems = getMilkProducts(allProductItems);
    const products = productItems.reduce((acc, item) => {
      acc[item.name] = item.ratePerUnit;
      return acc;
    }, {});

    return {
      id: data.id,
      name: data.dairy_name || data.name || "Dairy Farm",
      image: data.image_url || "",
      description: data.description || "Fresh milk delivered to your doorstep.",
      address: data.address || data.city || "Address not available",
      rating: data.rating || 4.5,
      products,
      allProductItems,
      productItems,
    };
  }, [data]);

  useEffect(() => {
    if (!dairy?.productItems?.length) return;
    const hasSelected = dairy.productItems.some((item) => item.name === subscription.milkType);
    if (hasSelected) return;
    setSubscription((prev) => ({
      ...prev,
      milkType: dairy.productItems[0].name,
    }));
  }, [dairy, subscription.milkType]);

  const selectedProduct = useMemo(
    () => dairy?.productItems?.find((item) => item.name === subscription.milkType) || null,
    [dairy, subscription.milkType]
  );
  const currentPrice = useMemo(() => Number(selectedProduct?.ratePerUnit || 0), [selectedProduct]);

  const isSubscribedToThis = useMemo(() => {
    if (!existingSubscription) return false;
    return String(existingSubscription.dairy_id) === String(id);
  }, [existingSubscription, id]);

  const hasActiveSubscription = useMemo(() => {
    if (!existingSubscription) return false;
    return String(existingSubscription.status || "ACTIVE").toUpperCase() !== "CLOSED";
  }, [existingSubscription]);

  const isSubscriptionBlocked = hasActiveSubscription && !isSubscribedToThis;

  const redirectToLogin = (postLoginRedirect, postLoginState = null) => {
    navigate("/", { state: { postLoginRedirect, postLoginState } });
  };

  const handleConfirmSubscription = async () => {
    setSaving(true);
    try {
      await saveCustomerSubscription({
        dairyId: dairy.id,
        milkType: subscription.milkType,
        quantity: Number(subscription.quantity),
        slot: subscription.slot,
        startDate: subscription.startDate,
        deliveryDays: subscription.deliveryDays,
        address: address,
        paymentMethod: paymentMethod,
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
  // ✅ Check if the address is empty or just whitespace
  if (!address || address.trim().length === 0) {
    toast.error("Delivery address is required to continue");
    return;
  }

  // ✅ Optional: Check for a minimum length (e.g., 10 characters) to ensure it's a real address
  if (address.trim().length < 10) {
    toast.error("Please provide a more detailed delivery address");
    return;
  }

  // If valid, move to the next step
  setStep(3);
};

  const handleSubscribeClick = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Login to start subscription first");
      redirectToLogin(`/join/${id}`, { openSubscriptionModal: true });
      return;
    }
    if (isSubscriptionBlocked) {
      toast.error("You already have an active subscription. Close it first.");
      return;
    }
    if (!dairy?.productItems?.length) {
      toast.error("No milk variants available for subscription right now.");
      return;
    }
    setStep(1);
    setShowSubscribe(true);
  };

  const handleBuyOnceClick = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Login to place a one-time order first");
      redirectToLogin(`/buy-once/${id}`);
      return;
    }
    if (isSubscribedToThis && hasActiveSubscription) {
      toast.error("You already have an active subscription with this dairy.");
      return;
    }
    navigate(`/buy-once/${id}`);
  };

  if (loading) return <LoadingIndicator fullScreen message="Fetching farm details..." />;

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] pb-24"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="sticky top-0 z-30 border-b border-[#EDE8DF] bg-[#FFFDF8]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#8B7355] transition-colors hover:border-[#D4B896] hover:text-[#5C3D1E]"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold text-[#2C1A0E]" style={headingFont}>{dairy.name}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="aspect-video w-full rounded-[40px] overflow-hidden border border-[#E7DAC6] shadow-[0_20px_60px_rgba(84,52,16,0.08)] bg-[#F3E6D6]">
            {dairy.image ? (
              <img src={dairy.image} alt={dairy.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#B89E80]">No Image Available</div>
            )}
          </div>

          <section className="rounded-[32px] border border-[#E7DAC6] bg-[#FFFDF8] p-6 shadow-[0_12px_32px_rgba(84,52,16,0.06)]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Dairy Menu</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>Available Products</h2>
                <p className="mt-1 text-sm text-[#8B7355]">
                  See everything this dairy currently offers before you subscribe or place a one-time order.
                </p>
              </div>
            </div>

            {dairy.allProductItems.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dairy.allProductItems.map((item) => {
                  const outOfStock = isProductOutOfStock(item.stockQuantity);

                  return (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold leading-5 text-[#2C1A0E]">{item.name}</p>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C4A882]">
                            {item.type}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                            outOfStock
                              ? "bg-[#FDECEA] text-[#C0392B]"
                              : "bg-[#EEF5E7] text-[#4A7C2F]"
                          }`}
                        >
                          {formatProductStockLabel(item.stockQuantity)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-lg font-black text-[#2C1A0E]">
                          Rs {item.ratePerUnit}
                          <span className="ml-1 text-xs font-medium text-[#8B7355]">/{item.unit}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0] px-6 py-8 text-sm text-[#8B7355]">
                No products are listed for this dairy right now.
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-28 rounded-[40px] border border-[#E7DAC6] bg-[#FFFDF8] p-8 shadow-[0_20px_60px_rgba(84,52,16,0.08)]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Starting from</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#2C1A0E]">Rs {currentPrice}</span>
                  <span className="font-medium text-[#8B7355]">/L</span>
                </div>
              </div>
              <div className="rounded-xl bg-[#EEF5E7] px-3 py-1 text-[#4A7C2F] flex items-center gap-1 font-bold">
                {dairy.rating} <Star size={14} fill="currentColor" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 rounded-2xl bg-[#FBF7F0] p-4 text-[#6B5B3E]">
                <ShieldCheck className="text-[#B8641A]" size={20} />
                <span className="text-sm font-semibold">100% Organic & Verified</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#FBF7F0] p-4 text-[#6B5B3E]">
                <Truck className="text-[#B8641A]" size={20} />
                <span className="text-sm font-semibold">Free Delivery (6 AM - 9 AM)</span>
              </div>
            </div>

            {isSubscribedToThis ? (
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/customer/dashboard/subscriptions")}
                  className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#4A7C2F] py-5 font-bold text-white shadow-[0_16px_30px_rgba(74,124,47,0.18)] transition hover:bg-[#3E6928]"
                >
                  <CheckCircle2 size={20} /> Active Subscription
                </button>
                <button
                  onClick={handleBuyOnceClick}
                  disabled={isSubscribedToThis && hasActiveSubscription}
                  className={`w-full py-4 rounded-[20px] font-bold border transition-all flex items-center justify-center gap-2 ${
                    isSubscribedToThis && hasActiveSubscription
                      ? "bg-[#F5F0E8] text-[#BBA88E] border-[#EDE8DF] cursor-not-allowed"
                      : "bg-white text-[#5C3D1E] border-[#EDE8DF] hover:border-[#D4B896] hover:bg-[#FDF6EC]"
                  }`}
                >
                  <Calendar size={18} />
                  {isSubscribedToThis && hasActiveSubscription
                    ? "Buy Once Unavailable"
                    : "Buy Once"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleSubscribeClick}
                  className="group flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#B8641A] py-5 font-bold text-white shadow-[0_16px_30px_rgba(184,100,26,0.18)] transition-all hover:bg-[#9F5313]"
                >
                  Subscribe Now <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={handleBuyOnceClick}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-[#EDE8DF] bg-white py-4 font-bold text-[#5C3D1E] transition-all hover:border-[#D4B896] hover:bg-[#FDF6EC]"
                >
                  <Calendar size={18} /> Buy Once
                </button>
              </div>
            )}

            <p className="mt-4 text-xs text-[#8B7355]">
              Buy once from the dedicated order page, or choose subscription for recurring delivery plans.
            </p>
          </div>
        </div>
      </div>

      {showSubscribe && (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-900/60 p-3 backdrop-blur-md animate-in fade-in duration-300 sm:p-4">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center sm:py-6">
            <div className="relative flex max-h-[calc(100vh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl animate-in zoom-in-95 duration-300 sm:max-h-[calc(100vh-2rem)] sm:rounded-[40px]">
              <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50/50 sm:px-8 sm:py-4">
                <div>
                  <h2 className="text-xl font-bold">Setup Subscription</h2>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${step >= s ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`} />
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowSubscribe(false)} className="p-2 hover:bg-white rounded-full border shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <div className={`${step === 1 ? "overflow-visible" : "overflow-y-auto"} px-5 py-4 sm:px-8 sm:py-5`}>
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Layers size={16} /> Select Milk Type
                    </label>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 gap-3">
                      {dairy.productItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSubscription({...subscription, milkType: item.name})}
                          className={`flex justify-between items-center p-4 border-2 rounded-2xl transition-all ${subscription.milkType === item.name ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <span className="font-bold">{item.name}</span>
                          <span className="text-blue-600 font-black">Rs {item.ratePerUnit}/{item.unit}</span>
                        </button>
                      ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Daily Qty (L)</label>
                      <input
                        type="number"
                        step="0.5"
                        className="w-full rounded-lg bg-slate-50 px-3 py-2.5 text-sm border-none outline-none focus:ring-2 focus:ring-blue-500"
                        value={subscription.quantity}
                        onChange={(e) => setSubscription({ ...subscription, quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Time Slot</label>
                      <select
                        className="w-full rounded-lg bg-slate-50 px-3 py-2.5 text-sm border-none outline-none"
                        value={subscription.slot}
                        onChange={(e) => setSubscription({ ...subscription, slot: e.target.value })}
                      >
                        <option>Morning</option>
                        <option>Evening</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold">Delivery Days</label>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                      {DAY_OPTIONS.map((day) => {
                        const selected = subscription.deliveryDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? subscription.deliveryDays.filter((item) => item !== day.key)
                                : [...subscription.deliveryDays, day.key];
                              setSubscription({ ...subscription, deliveryDays: next });
                            }}
                            className={`rounded-lg py-1.5 text-xs font-bold border ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => setStep(2)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all">Continue to Address</button>
                </div>
              )}

              {/* Step 2: Address */}
         {step === 2 && (
  <div className="space-y-6">
    <div className="space-y-2">
      <label className="text-sm font-bold flex items-center gap-2">
        <MapPin size={16} className="text-red-500" /> Delivery Address *
      </label>
      <textarea 
        value={address} 
        onChange={e => setAddress(e.target.value)} 
        rows={4} 
        className={`w-full p-4 bg-slate-50 rounded-2xl border-2 outline-none transition-all ${
          !address.trim() ? 'border-red-100' : 'border-transparent focus:border-blue-500'
        }`}
        placeholder="Enter your full address (Flat No, Building, Street...)" 
      />
      {!address.trim() && (
        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">
          Address cannot be empty
        </p>
      )}
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <button onClick={() => setStep(1)} className="flex-1 py-4 font-bold text-slate-500">
        Back
      </button>
      <button 
        onClick={handleContinueFromStep2} 
        disabled={!address.trim()} // ⬅️ Disables the button if address is empty
        className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-bold disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        Next: Payment
      </button>
    </div>
  </div>
)}

              {step === 3 && (
  <div className="p-6 space-y-4"> {/* ⬇️ Reduced from p-8 and space-y-6 */}
    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
      Payment Method
    </label>
    
    <div className="space-y-2"> {/* ⬇️ Reduced from space-y-3 */}
      {[
        { id: 'UPI', icon: <Wallet size={18}/>, label: 'UPI' },
        { id: 'Card', icon: <CreditCard size={18}/>, label: 'Card' },
        { id: 'COD', icon: <Banknote size={18}/>, label: 'Cash' }
      ].map(m => (
        <button 
          key={m.id}
          onClick={() => setPaymentMethod(m.id)}
          className={`w-full flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${
            paymentMethod === m.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100'
          }`}
        >
          {/* ⬆️ Reduced padding (p-3) and rounded corners (rounded-xl) */}
          <div className={paymentMethod === m.id ? 'text-blue-600' : 'text-slate-400'}>
            {m.icon}
          </div>
          <span className="font-bold text-sm">{m.label}</span>
        </button>
      ))}
    </div>
    
    {/* Compact Summary Box */}
    <div className="bg-slate-50 p-4 rounded-2xl text-sm border border-slate-100">
      <div className="flex justify-between">
        <span className="text-slate-500">Total Payable(Daily)</span>
        <span className="font-black text-blue-600">₹{currentPrice * subscription.quantity}</span>
      </div>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => setStep(2)}
        disabled={saving}
        className="flex-1 py-3.5 font-bold text-slate-500 disabled:text-slate-300"
      >
        Back
      </button>
      <button 
        disabled={saving}
        onClick={handleConfirmSubscription} 
        className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold disabled:bg-slate-300"
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
        </div>
      )}
    </div>
  );
};

export default DairyDetailsPage;



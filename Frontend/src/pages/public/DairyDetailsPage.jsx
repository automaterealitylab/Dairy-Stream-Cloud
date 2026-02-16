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
import toast from "react-hot-toast";
import { fetchPublicDairyById } from "../../api/public.api.js";
import { fetchCustomerSubscription, saveCustomerSubscription } from "../../api/customer.api.js";

const DairyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [existingSubscription, setExistingSubscription] = useState(null);

  const [showSubscribe, setShowSubscribe] = useState(false);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [address, setAddress] = useState("");
  const [editAddress, setEditAddress] = useState(false);

  const [subscription, setSubscription] = useState({
    milkType: "Full Cream",
    quantity: "1",
    slot: "Morning",
    startDate: new Date().toISOString().slice(0, 10),
  });

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

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const token = storedUser ? JSON.parse(storedUser)?.token : null;
        if (!token) return;
        const res = await fetchCustomerSubscription(token);
        setExistingSubscription(res?.subscription || null);
      } catch {
        setExistingSubscription(null);
      }
    };
    loadSubscription();
  }, [id]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userAddress = user?.user?.address || user?.address || "";
        setAddress(userAddress || "");
      } catch {
        setAddress("");
      }
    }
  }, []);

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

  const isSubscribed = useMemo(() => {
    if (!existingSubscription) return false;
    return String(existingSubscription.dairy_id || existingSubscription.dairyId) === String(id);
  }, [existingSubscription, id]);

  const handleOpenSubscribe = () => {
    setStep(1);
    setPaymentMethod("UPI");
    setEditAddress(false);
    setShowSubscribe(true);
  };

  const handleCloseSubscribe = () => {
    setShowSubscribe(false);
  };

  const handleSubscriptionChange = (e) => {
    const { name, value } = e.target;
    setSubscription((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinueFromStep1 = () => {
    if (!subscription.startDate) {
      toast.error("Please select a start date");
      return;
    }
    setStep(2);
  };

  const handleContinueFromStep2 = () => {
    if (!address || address.trim().length < 5) {
      toast.error("Please provide a valid address");
      return;
    }
    setStep(3);
  };

  const handleConfirmSubscription = async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = storedUser ? JSON.parse(storedUser)?.token : null;
      if (!token) {
        toast.error("Please login to subscribe");
        return;
      }

      await saveCustomerSubscription(token, {
        dairyId: dairy.id,
        milkType: subscription.milkType,
        quantity: subscription.quantity,
        slot: subscription.slot,
        startDate: subscription.startDate,
        address,
        paymentMethod,
        status: "ACTIVE",
      });

      toast.success("Subscription successful!");
      setStep(4);
      setExistingSubscription({
        dairy_id: dairy.id,
        dairyId: dairy.id,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to save subscription");
    }
  };

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

          {isSubscribed ? (
            <button
              onClick={() => navigate("/customer/subscriptions")}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
            >
              Subscribed - Manage
            </button>
          ) : (
            <button
              onClick={handleOpenSubscribe}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Truck size={18} />
              Subscribe Now
            </button>
          )}
        </div>
      </div>

      {showSubscribe && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseSubscribe}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Subscribe to {dairy.name}</h2>
                  <p className="text-sm text-gray-500">Step {step} of 4</p>
                </div>
                <button onClick={handleCloseSubscribe} className="text-gray-400">X</button>
              </div>

              {step === 1 && (
                <div className="p-6 space-y-5">
                  <div>
                    <label className="text-sm text-gray-600">Milk Type</label>
                    <select
                      name="milkType"
                      value={subscription.milkType}
                      onChange={handleSubscriptionChange}
                      className="w-full mt-1 border rounded-lg p-2"
                    >
                      <option>Full Cream</option>
                      <option>Toned</option>
                      <option>Double Toned</option>
                      <option>Buffalo</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Quantity (L)</label>
                      <select
                        name="quantity"
                        value={subscription.quantity}
                        onChange={handleSubscriptionChange}
                        className="w-full mt-1 border rounded-lg p-2"
                      >
                        <option value="0.5">0.5</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Delivery Time</label>
                      <select
                        name="slot"
                        value={subscription.slot}
                        onChange={handleSubscriptionChange}
                        className="w-full mt-1 border rounded-lg p-2"
                      >
                        <option>Morning</option>
                        <option>Evening</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={subscription.startDate}
                      onChange={handleSubscriptionChange}
                      className="w-full mt-1 border rounded-lg p-2"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCloseSubscribe}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContinueFromStep1}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-sm text-gray-600">Deliver to</p>
                    {address && !editAddress ? (
                      <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                        <div className="text-sm text-gray-800">{address}</div>
                        <button
                          onClick={() => setEditAddress(true)}
                          className="mt-2 text-blue-600 text-sm"
                        >
                          Change Address
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={3}
                          className="w-full border rounded-lg p-2"
                          placeholder="Enter delivery address"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinueFromStep2}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Proceed to Payment
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="p-6 space-y-6">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-sm font-semibold">Subscription Summary</p>
                    <div className="mt-2 text-sm text-gray-700 space-y-1">
                      <div>Milk Type: {subscription.milkType}</div>
                      <div>Quantity: {subscription.quantity} L</div>
                      <div>Delivery Slot: {subscription.slot}</div>
                      <div>Start Date: {subscription.startDate}</div>
                      <div>Dairy: {dairy.name}</div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Payment Method</p>
                    <div className="mt-2 space-y-2">
                      {[
                        "UPI",
                        "Card",
                        "Cash on Delivery",
                      ].map((method) => (
                        <label key={method} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method}
                            checked={paymentMethod === method}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmSubscription}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Confirm Subscription
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="p-6 space-y-5 text-center">
                  <div className="text-green-600 font-semibold text-lg">Subscription Confirmed</div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div>Dairy: {dairy.name}</div>
                    <div>Start Date: {subscription.startDate}</div>
                    <div>Quantity: {subscription.quantity} L</div>
                    <div>Delivery Slot: {subscription.slot}</div>
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => navigate("/customer/subscriptions")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Go to My Subscriptions
                    </button>
                    <button
                      onClick={() => navigate("/explore")}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Explore More Dairies
                    </button>
                  </div>
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

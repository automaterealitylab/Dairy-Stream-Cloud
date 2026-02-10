import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  MapPin,
  ShieldCheck,
  Clock,
  Truck,
  CheckCircle,
  Droplets,
  BadgeCheck,
} from "lucide-react";

/* MOCK DATA */
const MOCK_DAIRIES = [
  {
    id: "D001",
    name: "Nandanvan Farms",
    rating: 4.8,
    reviews: 124,
    distance: "1.2 km",
    isVerified: true,
    isTrusted: true,
    slots: ["Morning", "Evening"],
    image:
      "https://images.unsplash.com/photo-1528498033373-3c6c08e93d79?auto=format&fit=crop&q=80&w=1600",
    address: "Kothrud, Pune",
    minPrice: 60,
    description:
      "Fresh farm milk delivered daily with strict hygiene, quality checks, and reliable delivery.",

    milkInfo: {
      type: "Cow Milk",
      fat: "3.8%",
      processing: "Unprocessed",
      testing: "Adulteration Tested",
    },

    deliveryInfo: {
      timing: "5:00 AM – 8:00 AM",
      holidays: "Delivered on holidays",
      cutoff: "Modify before 9:00 PM",
    },

    subscriptionRules: [
      "Pause or resume anytime",
      "Change quantity daily",
      "No minimum commitment",
      "Monthly billing",
    ],

    hygiene: [
      "Cleaned containers daily",
      "Insulated delivery cans",
      "Regular lab testing",
      "Farm-to-home supply",
    ],

    reviewsData: [
      {
        name: "Rohit, Kothrud",
        text: "Milk is always fresh and delivery is very punctual.",
      },
      {
        name: "Anita, Karve Nagar",
        text: "Quality is consistent and customer support is helpful.",
      },
    ],
  },
];

const DairyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const dairy = MOCK_DAIRIES.find((d) => d.id === id);

  if (!dairy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Dairy not found
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">

      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="w-full px-6 lg:px-10 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-xl font-bold">{dairy.name}</h1>
        </div>
      </div>

      {/* CONTENT */}
      <div className="w-full px-6 lg:px-10 py-6 grid lg:grid-cols-3 gap-8">

        {/* LEFT SECTION */}
        <div className="lg:col-span-2 space-y-6">

          {/* IMAGE */}
          <img
            src={dairy.image}
            alt={dairy.name}
            className="w-full h-[420px] object-cover rounded-2xl"
          />

          {/* ABOUT */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">About this Dairy</h2>
            <p className="text-gray-600">{dairy.description}</p>
          </section>

          {/* MILK DETAILS */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Milk Details</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="flex gap-2">
                <Droplets size={16} /> Type: {dairy.milkInfo.type}
              </div>
              <div>Fat Content: {dairy.milkInfo.fat}</div>
              <div>Processing: {dairy.milkInfo.processing}</div>
              <div>{dairy.milkInfo.testing}</div>
            </div>
          </section>

          {/* DELIVERY INFO */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Delivery Information</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>⏰ Timing: {dairy.deliveryInfo.timing}</li>
              <li>📅 Holidays: {dairy.deliveryInfo.holidays}</li>
              <li>🕘 Cut-off Time: {dairy.deliveryInfo.cutoff}</li>
            </ul>
          </section>

          {/* SUBSCRIPTION FLEXIBILITY */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              Subscription Flexibility
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm">
              {dairy.subscriptionRules.map((rule, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          {/* HYGIENE */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              Hygiene & Safety Standards
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm">
              {dairy.hygiene.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* REVIEWS */}
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Customer Reviews</h2>
            <div className="space-y-3">
              {dairy.reviewsData.map((r, i) => (
                <div key={i} className="text-sm text-gray-700">
                  ⭐⭐⭐⭐⭐
                  <p className="italic">"{r.text}"</p>
                  <p className="text-xs text-gray-500 mt-1">
                    — {r.name}
                  </p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT CARD */}
        <div className="bg-white rounded-2xl p-6 h-fit lg:sticky lg:top-24">

          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded text-sm font-bold text-green-700">
              {dairy.rating}
              <Star size={14} fill="currentColor" />
            </div>
            <span className="text-sm text-gray-500">
              ({dairy.reviews} reviews)
            </span>
          </div>

          <div className="text-sm text-gray-600 flex gap-2 mb-2">
            <MapPin size={16} />
            {dairy.address}
          </div>

          <div className="text-sm text-gray-600 flex gap-2 mb-4">
            <Clock size={16} />
            {dairy.distance}
          </div>

          <div className="border-t pt-4 mb-4">
            <p className="text-sm text-gray-500">Starting at</p>
            <p className="text-2xl font-bold">
              ₹{dairy.minPrice}
              <span className="text-sm text-gray-500"> /L</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ≈ ₹{dairy.minPrice * 30}/month (1L daily)
            </p>
          </div>

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

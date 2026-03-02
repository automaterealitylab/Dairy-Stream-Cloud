import React from "react";
import { Target } from "lucide-react";

const LocationStep = ({ formData, handleChange, detectLocation }) => {
  return (
    <div className="p-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black">Location Settings</h2>

        <button
          type="button"
          onClick={detectLocation}
          className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-100 transition-all active:scale-95"
        >
          <Target size={16} /> Detect GPS
        </button>
      </div>

      <div className="space-y-6">
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            formData.latitude
              ? "bg-green-50 text-green-700 border-green-100"
              : "bg-amber-50 text-amber-700 border-amber-100"
          }`}
        >
          {formData.latitude
            ? `✅ GPS Locked: ${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}`
            : "⚠️ Capture GPS to enable radius delivery"}
        </div>

        {/* Delivery Type */}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() =>
              handleChange({
                target: { name: "service_type", value: "RADIUS" },
              })
            }
            className={`px-4 py-2 rounded-xl text-xs font-black ${
              formData.service_type === "RADIUS"
                ? "bg-blue-600 text-white"
                : "bg-gray-100"
            }`}
          >
            Radius
          </button>

          <button
            type="button"
            onClick={() =>
              handleChange({
                target: { name: "service_type", value: "PINCODE" },
              })
            }
            className={`px-4 py-2 rounded-xl text-xs font-black ${
              formData.service_type === "PINCODE"
                ? "bg-blue-600 text-white"
                : "bg-gray-100"
            }`}
          >
            Pincode
          </button>
        </div>

        {/* Radius */}

        {formData.service_type === "RADIUS" && (
          <input
            type="number"
            name="service_radius"
            value={formData.service_radius}
            onChange={handleChange}
            placeholder="Delivery Radius KM"
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
          />
        )}

        {/* Pincode */}

        {formData.service_type === "PINCODE" && (
          <input
            type="text"
            name="service_pincodes"
            value={formData.service_pincodes || ""}
            onChange={handleChange}
            placeholder="Serviceable Pincodes (comma separated)"
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
          />
        )}

        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Full Street Address *"
          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
        />

        <div className="grid grid-cols-3 gap-4">
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="City *"
            className="px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
          />

          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="State *"
            className="px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
          />

          <input
            type="text"
            name="pincode"
            value={formData.pincode}
            onChange={handleChange}
            placeholder="Pincode *"
            className="px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
          />
        </div>
      </div>
    </div>
  );
};

export default LocationStep;

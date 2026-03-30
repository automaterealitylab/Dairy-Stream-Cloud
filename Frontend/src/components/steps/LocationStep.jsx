import React from "react";
import { Target } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const LocationStep = ({ formData, handleChange, detectLocation }) => {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-5 sm:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Service Area</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
            Location Settings
          </h2>
          <p className="mt-2 text-sm text-[#8B7355]">
            Define where the dairy operates and how delivery coverage should work.
          </p>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          className="inline-flex items-center gap-2 rounded-[14px] border border-[#EFD7B3] bg-[#FFF4E2] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#B8641A] transition hover:bg-[#FCE8CB] active:scale-95"
        >
          <Target size={16} /> Detect GPS
        </button>
      </div>

      <div className="space-y-6">
        <div
          className={`rounded-[18px] border px-4 py-4 text-sm font-semibold ${
            formData.latitude
              ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
              : "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]"
          }`}
        >
          {formData.latitude
            ? `GPS Locked: ${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}`
            : "Capture GPS to enable radius delivery"}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() =>
              handleChange({
                target: { name: "service_type", value: "RADIUS" },
              })
            }
            className={`rounded-[14px] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition ${
              formData.service_type === "RADIUS"
                ? "border border-[#B8641A] bg-[#B8641A] text-white"
                : "border border-[#EDE8DF] bg-white text-[#8B7355] hover:border-[#D4B896] hover:text-[#5C3D1E]"
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
            className={`rounded-[14px] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition ${
              formData.service_type === "PINCODE"
                ? "border border-[#B8641A] bg-[#B8641A] text-white"
                : "border border-[#EDE8DF] bg-white text-[#8B7355] hover:border-[#D4B896] hover:text-[#5C3D1E]"
            }`}
          >
            Pincode
          </button>
        </div>

        {formData.service_type === "RADIUS" && (
          <input
            type="number"
            name="service_radius"
            value={formData.service_radius}
            onChange={handleChange}
            placeholder="Delivery Radius KM"
            className={inputClassName}
          />
        )}

        {formData.service_type === "PINCODE" && (
          <input
            type="text"
            name="service_pincodes"
            value={formData.service_pincodes || ""}
            onChange={handleChange}
            placeholder="Serviceable Pincodes (comma separated)"
            className={inputClassName}
          />
        )}

        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Full Street Address *"
          className={inputClassName}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="City *"
            className={inputClassName}
          />

          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="State *"
            className={inputClassName}
          />

          <input
            type="text"
            name="pincode"
            value={formData.pincode}
            onChange={handleChange}
            placeholder="Pincode *"
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
};

export default LocationStep;

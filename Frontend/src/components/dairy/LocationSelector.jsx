import React, { useState } from "react";
import { MapPin } from "lucide-react";

const LocationSelector = ({ onApply }) => {
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [radius, setRadius] = useState(10);

  const handleSubmit = () => {
    onApply({
      city,
      pincode,
      radius,
    });
  };

  return (
    <div className="absolute top-16 left-0 bg-white shadow-xl border rounded-2xl p-6 w-80 z-50">
      <h3 className="font-bold mb-4">Choose Delivery Location</h3>

      <input
        type="text"
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full mb-3 p-3 border rounded-xl"
      />

      <input
        type="text"
        placeholder="Pincode"
        value={pincode}
        onChange={(e) => setPincode(e.target.value)}
        className="w-full mb-3 p-3 border rounded-xl"
      />

      <select
        value={radius}
        onChange={(e) => setRadius(e.target.value)}
        className="w-full mb-4 p-3 border rounded-xl"
      >
        <option value="5">5 km</option>
        <option value="10">10 km</option>
        <option value="20">20 km</option>
        <option value="50">50 km</option>
      </select>

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold"
      >
        Show Dairies
      </button>
    </div>
  );
};

export default LocationSelector;

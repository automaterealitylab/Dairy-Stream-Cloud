import { useEffect, useState } from "react";
import { CheckCircle, XCircle, MapPin } from "lucide-react";

/* ======================================================
   MOCK DATA (Backend-ready structure)
====================================================== */
const MOCK_AGENT_DATA = {
  route: {
    name: "Narhe – Ambegaon – Dhayari",
    mapEmbed:
      "https://www.google.com/maps?q=Narhe,Pune&output=embed",
  },
  buildings: [
    {
      id: "B1",
      name: "Green Valley Society",
      homes: [
        {
          id: "H1",
          customer: "Amit Patil",
          flat: "Flat 102",
          qty: "1.0 L",
          status: "PENDING",
        },
        {
          id: "H2",
          customer: "Neha Kulkarni",
          flat: "Flat 104",
          qty: "0.5 L",
          status: "DELIVERED",
        },
      ],
    },
    {
      id: "B2",
      name: "Sunshine Building",
      homes: [
        {
          id: "H3",
          customer: "Pooja Household",
          flat: "Flat B-304",
          qty: "0.5 L",
          status: "PENDING",
        },
      ],
    },
  ],
};

const AgentDashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(MOCK_AGENT_DATA);
  }, []);

  if (!data) {
    return <div className="p-6 text-center">Loading route…</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">

      {/* ================= ROUTE HEADER ================= */}
      <header>
        <h2 className="text-xl font-bold">Today’s Route</h2>
        <p className="text-sm text-text-secondary">
          {data.route.name}
        </p>
      </header>

      {/* ================= MAP ================= */}
      <div className="rounded-xl overflow-hidden border border-border">
        <iframe
          src={data.route.mapEmbed}
          className="w-full h-48"
          loading="lazy"
        />
      </div>

      {/* ================= BUILDINGS ================= */}
      <div className="space-y-6">
        {data.buildings.map((building) => (
          <BuildingCard key={building.id} building={building} />
        ))}
      </div>
    </div>
  );
};

/* ======================================================
   BUILDING CARD
====================================================== */
const BuildingCard = ({ building }) => {
  const allDelivered = building.homes.every(
    (h) => h.status === "DELIVERED"
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={16} /> {building.name}
        </h3>

        {allDelivered && (
          <span className="text-xs text-success bg-success-soft px-2 py-1 rounded">
            All Delivered
          </span>
        )}
      </div>

      {/* HOMES */}
      <div className="space-y-3">
        {building.homes.map((home) => (
          <HomeDeliveryCard key={home.id} home={home} />
        ))}
      </div>

      {/* CONFIRM BUILDING */}
      {!allDelivered && (
        <button
          disabled
          className="w-full bg-gray-300 text-gray-600 py-2 rounded-xl text-sm font-semibold"
        >
          Complete all homes to confirm building
        </button>
      )}

      {allDelivered && (
        <button className="w-full bg-success text-white py-2 rounded-xl text-sm font-semibold">
          Confirm Building Delivery
        </button>
      )}
    </div>
  );
};

/* ======================================================
   HOME CARD
====================================================== */
const HomeDeliveryCard = ({ home }) => {
  const isDelivered = home.status === "DELIVERED";

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex justify-between">
        <div>
          <p className="font-medium">{home.customer}</p>
          <p className="text-xs text-text-secondary">
            {home.flat} • {home.qty}
          </p>
        </div>

        {isDelivered && (
          <CheckCircle className="text-success" size={18} />
        )}
      </div>

      {!isDelivered && (
        <div className="flex gap-2">
          <button className="flex-1 bg-success text-white py-1.5 rounded text-sm">
            Delivered
          </button>
          <button className="flex-1 bg-red-500 text-white py-1.5 rounded text-sm">
            Missed
          </button>
        </div>
      )}

      {isDelivered && (
        <p className="text-xs text-success flex items-center gap-1">
          <CheckCircle size={14} /> Delivered
        </p>
      )}
    </div>
  );
};

export default AgentDashboard;

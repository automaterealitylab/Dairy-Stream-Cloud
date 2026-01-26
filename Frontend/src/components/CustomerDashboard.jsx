import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const CustomerDashboard = () => {
  const [customer, setCustomer] = useState(null);
  const [plan, setPlan] = useState("Monthly"); // default plan
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if the token exists
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    // Fetch customer details (optional API call)
    const storedUser = JSON.parse(localStorage.getItem("customerData"));
    if (storedUser) setCustomer(storedUser);
  }, []);

  const handleSubscription = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/customer/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage("✅ Subscription activated successfully!");
      } else {
        setMessage("❌ " + (data.message || "Failed to activate subscription."));
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("❌ Server error.");
    }
  };

  return (
    <div
      className="bg-light min-vh-100 d-flex flex-column align-items-center py-5"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      <div className="bg-white shadow rounded-4 p-4 w-100" style={{ maxWidth: "700px" }}>
        <h2 className="text-center mb-3 fw-bold text-dark">Customer Dashboard</h2>

        {customer ? (
          <>
            <div className="card border-0 shadow-sm p-3 mb-4">
              <h5 className="text-primary fw-semibold mb-3">👤 Customer Details</h5>
              <p><strong>Name:</strong> {customer.name}</p>
              <p><strong>Email:</strong> {customer.email}</p>
              <p><strong>Phone:</strong> {customer.phone}</p>
              <p><strong>Building:</strong> {customer.buildingName}</p>
            </div>

            <div className="card border-0 shadow-sm p-3">
              <h5 className="text-success fw-semibold mb-3">🥛 Subscription Section</h5>
              <p>Select your preferred milk delivery plan:</p>
              <select
                className="form-select mb-3"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>

              <button
                className="btn w-100 fw-semibold text-white"
                style={{
                  background: "linear-gradient(to right, #16a34a, #22c55e)",
                  border: "none",
                }}
                onClick={handleSubscription}
              >
                Subscribe
              </button>

              {message && (
                <div className="alert alert-info text-center mt-3 p-2">{message}</div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center mt-4">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2">Loading your details...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;

import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const DailyDeliveries = () => {
  const today = new Date().getDate(); 

  
  const [customers, setCustomers] = useState([]);

 
  useEffect(() => {
    
    const fetchedCustomers = [
      { id: 1, name: "R.K. Sharma", deliveries: { 1: 1.2, 2: 1.5, 3: 2 ,4: 2, 6:1.5,9:2} },
      { id: 2, name: "A. Deshmukh", deliveries: { 1: 1, 2: 1.2 } },
      { id: 3, name: "S. Patil", deliveries: { 1: 0.8, 3: 1.5 } },
    ];

   
    const processedCustomers = fetchedCustomers.map((cust) => {
      const deliveries = { ...cust.deliveries };
      for (let i = 1; i <= today; i++) {
        if (!(i in deliveries)) deliveries[i] = "-";
      }
      return { ...cust, deliveries };
    });

    setCustomers(processedCustomers);
  }, [today]);

  return (
    <div className="container mt-4">
      <h3 className="text-center mb-4 fw-bold">
        🧺 Daily Milk Delivery Tracker
      </h3>

      <div className="table-responsive">
        <table className="table table-bordered table-striped text-center align-middle shadow-sm">
          <thead className="table-dark">
            <tr>
              <th>Customer Name</th>
              {[...Array(today)].map((_, i) => (
                <th key={i}>Day {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((cust) => (
              <tr key={cust.id}>
                <td className="fw-semibold">{cust.name}</td>
                {[...Array(today)].map((_, i) => (
                  <td key={i}>{cust.deliveries[i + 1]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-4">
        <button className="btn btn-success px-4">
          💾 Save (Backend Coming Soon)
        </button>
      </div>
    </div>
  );
};

export default DailyDeliveries;

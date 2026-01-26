import React, { useState, useEffect } from 'react';
// Assuming you will remove the mock data file once the API is ready, 
// but we keep it for now for a fallback.
// import { UNITS } from '../api/mockData'; 

const API_BASE_URL = 'http://localhost:5000/api'; // Replace with your actual backend URL

const DailyEntry = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [units, setUnits] = useState([]); // State to hold units fetched from API
  const [loading, setLoading] = useState(true);
  
  // State for delivery status, initialized after fetching units
  const [dailyStatus, setDailyStatus] = useState({});

  // --- Step 1: Fetch Units from the API ---
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/units`);
        if (!response.ok) throw new Error('Failed to fetch units.');
        
        const fetchedUnits = await response.json();
        setUnits(fetchedUnits);
        
        // Initialize dailyStatus based on the fetched units
        const initialStatus = {};
        fetchedUnits.forEach(unit => {
          initialStatus[unit.id] = 1; // 1 = Delivered (default)
        });
        setDailyStatus(initialStatus);
        
      } catch (error) {
        console.error("Error fetching units:", error);
        // Handle error, maybe use a toast notification
      } finally {
        setLoading(false);
      }
    };
    
    fetchUnits();
  }, []); // Run only once on mount

  // --- Utility functions remain the same ---
  const handleStatusChange = (unitId, status) => {
    setDailyStatus(prevStatus => ({
      ...prevStatus,
      [unitId]: status,
    }));
  };

  // --- Step 2: Submit Data to the API ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      date: selectedDate,
      data: dailyStatus // { 'A507': 1, 'A606': 0, ... }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/daily-tally`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit tally.');
      }

      alert(`✅ Tally successfully saved for ${selectedDate}!`);
      // Optionally reset the form or redirect
    } catch (error) {
      console.error("Submission error:", error);
      alert(`❌ Error submitting data: ${error.message}`);
    }
  };

  // --- Render logic ---
  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading unit data...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4 text-primary">📅 Daily Delivery Log</h2>
      
      <div className="mb-4">
        <label htmlFor="date-input" className="form-label">Select Date:</label>
        <input 
          id="date-input"
          type="date"
          className="form-control w-25"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead className="table-dark">
              <tr>
                <th>Room No.</th>
                <th>Building</th>
                <th className="text-center">Current Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {units.map(unit => { // Use 'units' state here
                const isDelivered = dailyStatus[unit.id] === 1;
                return (
                  <tr key={unit.id} className={!isDelivered ? 'table-danger' : ''}>
                    <td className="fw-bold">{unit.room}</td>
                    <td>{unit.building}</td>
                    <td className="text-center">
                      <span className={`badge ${isDelivered ? 'bg-success' : 'bg-danger'}`}>
                        {isDelivered ? 'DELIVERED' : 'ABSENT'}
                      </span>
                    </td>
                    <td className="text-center">
                      <button 
                        type="button"
                        className={`btn btn-sm ${isDelivered ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => handleStatusChange(unit.id, isDelivered ? 0 : 1)}
                      >
                        Mark as {isDelivered ? 'ABSENT' : 'DELIVERED'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="submit" className="btn btn-primary mt-3 w-100">
          Save Daily Tally
        </button>
      </form>
    </div>
  );
};

export default DailyEntry;
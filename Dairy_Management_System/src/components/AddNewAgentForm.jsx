import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function AddNewAgentForm() {
  const [agent, setAgent] = useState({
    agentID: '',
    agentName: '',
    phoneNumber: '',
    email: '',
    password: '',
    assignedRoute: '', // This will hold the selected Building Name
    isActive: true,
  });

  // State to hold the list of available building names fetched from the backend
  const [buildingNames, setBuildingNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const apiurlAddAgent = "http://localhost:4000/api/addAgent";
  const apiurlFetchBuildings = "http://localhost:4000/api/buildings"; 
  
  const navigate = useNavigate();

  // --- Effect to Fetch Building Names (Routes) ---
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        setIsLoading(true);
        // Call the new backend endpoint to get unique building names
        const response = await axios.get(apiurlFetchBuildings);
        setBuildingNames(response.data);
        setFetchError(null);
      } catch (error) {
        console.error("Error fetching building names:", error);
        setFetchError("Failed to load available routes. Check server/network status.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBuildings();
  }, []); 

  // Handle input changes
  const inputHandler = (e) => {
    const { name, value, type, checked } = e.target;
    // Special handling for checkbox
    const newValue = type === 'checkbox' ? checked : value;
    setAgent({ ...agent, [name]: newValue });
  };

  // Handles form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Frontend Validation
    if (!agent.agentID || !agent.agentName || !agent.phoneNumber || !agent.email || !agent.password || !agent.assignedRoute) {
      alert("All required fields must be filled. (Agent ID, Name, Phone, Email, Password, and Assigned Route)");
      return;
    }

    try {
      await axios.post(apiurlAddAgent, agent);
      alert("Delivery Agent added successfully! 🚚");
      navigate("/agents"); 
    } catch (error) {
      console.error("Error adding delivery agent:", error);
      
      const serverErrorMessage = error.response?.data?.error;

      if (serverErrorMessage) {
          alert(`Failed to add agent: ${serverErrorMessage}`);
      } else {
          alert("Failed to add agent. Check the console for network error details.");
      }
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-xl-6">
          <h2 className="mb-4 text-primary text-center">🚚 Add New Delivery Agent</h2>

          <form onSubmit={handleSubmit} className="p-4 border border-primary rounded shadow-sm bg-white">
            
            {/* Agent ID & Name */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label htmlFor="agentID" className="form-label">
                  Agent ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="agentID"
                  name="agentID"
                  placeholder="e.g., A-01"
                  value={agent.agentID}
                  onChange={inputHandler}
                  className="form-control text-uppercase"
                  required
                />
              </div>
              <div className="col-md-8">
                <label htmlFor="agentName" className="form-label">
                  Agent Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="agentName"
                  name="agentName"
                  placeholder="e.g., Suresh Kumar"
                  value={agent.agentName}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
            </div>

            <hr className='mt-0'/>

            {/* Credentials Section */}
            <h4 className="mt-4 mb-3 text-secondary">Login Credentials</h4>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="email" className="form-label">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="agent@example.com"
                  value={agent.email}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="password" className="form-label">
                  Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Set a password"
                  value={agent.password}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
            </div>
            
            <hr/>

            {/* Contact & Route Section */}
            <h4 className="mt-4 mb-3 text-secondary">Route Assignment</h4>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="phoneNumber" className="form-label">
                  Phone Number<span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="e.g., 9876543210"
                  value={agent.phoneNumber}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="assignedRoute" className="form-label">
                  Assigned Route/Area <span className="text-danger">*</span>
                </label>
                {/* Loading and Error Indicators */}
                {isLoading && (
                    <div className="text-info small">Loading routes...</div>
                )}
                {fetchError && (
                    <div className="text-danger small">{fetchError}</div>
                )}
                
                {/* Dynamic Select Dropdown */}
                <select
                  id="assignedRoute"
                  name="assignedRoute"
                  value={agent.assignedRoute}
                  onChange={inputHandler}
                  className="form-select"
                  disabled={isLoading || fetchError}
                  required
                >
                  <option value="" disabled>-- Select a Building / Area --</option>
                  {buildingNames.map((building, index) => (
                    <option key={index} value={building}>
                      {building}
                    </option>
                  ))}
                  {/* Fallback option if no buildings are loaded */}
                  {!isLoading && buildingNames.length === 0 && (
                      <option value="" disabled>No buildings found</option>
                  )}
                </select>
              </div>
            </div>
            
            {/* Status Checkbox */}
            <div className="mb-4 form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={agent.isActive}
                onChange={inputHandler}
              />
              <label className="form-check-label" htmlFor="isActive">
                Agent is <b>Active</b> (Can be assigned deliveries)
              </label>
            </div>

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <button 
                type="submit" 
                className="btn btn-primary btn-lg"
                disabled={isLoading} 
              >
                ➕ Add Delivery Agent
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddNewAgentForm;
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Phone, MapPin, Mail, Briefcase, Loader2, RefreshCw } from 'lucide-react';

function AddNewAgentForm() {
  const [agent, setAgent] = useState({
    agentId: '',       // ✅ Renamed from agentID to agentId to match Backend
    password: '',      
    agentName: '',
    phoneNumber: '',   
    email: '',
    building: '',      
    isActive: true,
  });

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [buildingNames, setBuildingNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const navigate = useNavigate();

  // ✅ NEW: Generate Random Staff ID on Mount
  useEffect(() => {
    generateNewAgentId();
  }, []);

  const generateNewAgentId = async () => {
    try {
      const response = await client.get("/admin/agents/generate-id");
      const newId = response?.data?.agentId;
      if (!newId) {
        throw new Error("No agentId returned by server");
      }
      setAgent((prev) => ({ ...prev, agentId: newId }));
    } catch (error) {
      console.error("Failed to generate unique agent id:", error);
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const fallbackId = `STF${randomNum}`;
      setAgent((prev) => ({ ...prev, agentId: fallbackId }));
    }
  };

  // --- Fetch Building Names ---
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        setIsLoading(true);
        const response = await client.get("/admin/buildings");
        setBuildingNames(response.data);
        setFetchError(null);
      } catch (error) {
        console.error("Error fetching buildings:", error);
        if (error.response && error.response.status === 401) {
             setFetchError("Session expired. Please login again.");
        } else {
             setFetchError("Could not load areas. check server.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchBuildings();
  }, []); 

  useEffect(() => {
    if (!isLoading && buildingNames.length === 0) {
      setIsManualEntry(true); 
    }
  }, [isLoading, buildingNames]);

  const inputHandler = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setAgent({ ...agent, [name]: newValue });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Updated check to use agentId
    if (!agent.agentId || !agent.password || !agent.agentName || !agent.phoneNumber || !agent.building) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const response = await client.post("/admin/addagent", agent);
      const createdAgentId = response?.data?.data?.agent_id || agent.agentId;
      
      // Show the ID in the success message so admin can note it down
      alert(`✅ Delivery Agent Created Successfully!\n\nAgent ID: ${createdAgentId}\n(Please share this ID with the agent for login)`);
      navigate("/admin/agents");
    } catch (error) {
      console.error("Error adding agent:", error);
      
      if (error.response && error.response.status === 401) {
        alert("Session expired. Please login again.");
        navigate("/admin/login");
        return;
      }

      const msg = error.response?.data?.error || "Network Error";
      alert(`Failed to add agent: ${msg}`);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card shadow-lg border-0 rounded-3">
            <div className="card-header bg-primary text-white text-center py-3">
              <h3 className="mb-0 fw-bold">🚚 Add New Delivery Agent</h3>
            </div>
            
            <div className="card-body p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                
                {/* SECTION 1: LOGIN CREDENTIALS */}
                <h5 className="text-primary mb-3 border-bottom pb-2">
                  <Lock size={20} className="me-2 mb-1"/> 
                  Login Credentials
                </h5>
                
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label htmlFor="agentId" className="form-label fw-bold">
                      Staff ID <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><User size={18}/></span>
                      <input
                        type="text"
                        id="agentId"
                        name="agentId" // ✅ Updated Name
                        value={agent.agentId}
                        readOnly // 🔒 BLOCKED EDITING
                        className="form-control text-uppercase fw-bold bg-light text-secondary cursor-not-allowed" // ✅ Visually disabled
                        required
                      />
                      {/* Optional: Button to regenerate if needed */}
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary" 
                        onClick={generateNewAgentId}
                        title="Generate new ID"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <div className="form-text text-muted small">
                      Auto-generated ID. Used for Agent Login.
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="password" className="form-label fw-bold">
                      Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><Lock size={18}/></span>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="Set login password"
                        value={agent.password}
                        onChange={inputHandler}
                        className="form-control"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: PERSONAL DETAILS */}
                <h5 className="text-primary mb-3 border-bottom pb-2 mt-4">
                  <Briefcase size={20} className="me-2 mb-1"/> 
                  Agent Details
                </h5>

                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label htmlFor="agentName" className="form-label fw-bold">Full Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      id="agentName"
                      name="agentName"
                      placeholder="e.g., Rajesh Kumar"
                      value={agent.agentName}
                      onChange={inputHandler}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="phoneNumber" className="form-label fw-bold">
                      Mobile Number <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><Phone size={18}/></span>
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
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="email" className="form-label fw-bold">Email Address <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><Mail size={18}/></span>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="agent@dairy.com"
                        value={agent.email}
                        onChange={inputHandler}
                        className="form-control"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: ROUTE ASSIGNMENT */}
                <h5 className="text-primary mb-3 border-bottom pb-2 mt-4">
                  <MapPin size={20} className="me-2 mb-1"/> 
                  Route Assignment
                </h5>

                <div className="row g-3 mb-4">
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <label htmlFor="building" className="form-label fw-bold mb-0">
                        Assigned Route / Building <span className="text-danger">*</span>
                        </label>
                        <button 
                            type="button" 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setIsManualEntry(!isManualEntry)}
                        >
                            {isManualEntry ? "Select from List" : "Type Manually"}
                        </button>
                    </div>
                    
                    {fetchError && <div className="text-danger small mb-1">{fetchError}</div>}
                    
                    {isManualEntry ? (
                        <div>
                            <input
                                type="text"
                                id="building"
                                name="building"
                                placeholder="Type new building name (e.g., Green Valley)"
                                value={agent.building}
                                onChange={inputHandler}
                                className="form-control form-control-lg border-primary"
                                required
                            />
                            <div className="form-text text-primary">
                                <small>You are adding a new route to the system.</small>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <select
                                id="building"
                                name="building"
                                value={agent.building}
                                onChange={inputHandler}
                                className="form-select form-select-lg"
                                disabled={isLoading}
                                required
                            >
                                <option value="" disabled>-- Select Route --</option>
                                {buildingNames.map((bName, index) => (
                                    <option key={index} value={bName}>{bName}</option>
                                ))}
                            </select>
                            {isLoading && (
                              <div className="text-muted small mt-1 d-inline-flex align-items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Loading available routes...
                              </div>
                            )}
                        </div>
                    )}
                  </div>
                </div>

                <div className="form-check form-switch mb-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={agent.isActive}
                    onChange={inputHandler}
                  />
                  <label className="form-check-label" htmlFor="isActive">
                    Agent Account is <strong>Active</strong>
                  </label>
                </div>

                <hr className="my-4"/>

                <div className="d-flex justify-content-end gap-3">
                  <button 
                    type="button" 
                    className="btn btn-light border"
                    onClick={() => navigate('/admin/agents')}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary px-5 fw-bold"
                    disabled={isLoading}
                  >
                    Save Agent
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddNewAgentForm;


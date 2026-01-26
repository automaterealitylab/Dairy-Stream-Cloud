import React, { useState } from 'react';

// Initial structure for a single delivery record
const initialEntryState = {
  buildingName: '',
  wing: '',
  roomNo: '',
  milkQuantityLiters: 1.0, 
  extraProduct: 'None', 
  extraProductQuantity: 1,
  notes: '',
};

function MilkDeliveryVerticalForm() {
  const [currentEntry, setCurrentEntry] = useState(initialEntryState);
  const [deliveryRecords, setDeliveryRecords] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));

  // Handles changes for the currently active entry state
  const handleChange = (field, value) => {
    setCurrentEntry(prevEntry => ({ ...prevEntry, [field]: value }));
  };

  // Saves the current entry to the master list and resets the form for the next entry
  const handleSaveEntry = (e) => {
    e.preventDefault();
    
    // Simple validation
    if (!currentEntry.roomNo || currentEntry.milkQuantityLiters <= 0) {
        alert("Please ensure Room No. and Milk Quantity are entered.");
        return;
    }

    const newRecord = { 
        ...currentEntry, 
        id: Date.now(),
        // Clean up quantity if product is 'None'
        extraProductQuantity: currentEntry.extraProduct === 'None' ? 0 : currentEntry.extraProductQuantity
    };

    setDeliveryRecords(prevRecords => [...prevRecords, newRecord]);
    
    // Reset the form for the next customer, preserving the date
    setCurrentEntry(initialEntryState);
    
    console.log("Entry Saved:", newRecord);
    alert(`Entry for Room ${newRecord.roomNo} saved! Total entries: ${deliveryRecords.length + 1}`);
  };

  // Handles the final submission of ALL saved records
  const handleSubmitAll = (e) => {
    e.preventDefault();
    if (deliveryRecords.length === 0) {
        alert("No entries to submit.");
        return;
    }
    console.log(`Submitting ALL ${deliveryRecords.length} Deliveries for ${deliveryDate}:`, deliveryRecords);
    alert(`Successfully submitted ${deliveryRecords.length} entries for ${deliveryDate}!`);
    // Final API call goes here
    setDeliveryRecords([]); // Clear the list after submission
  };

  return (
    <div className="container py-4">
      <h1 className="mb-4 text-primary">Daily Milk Delivery Entry</h1>
      
      {/* Date and Total Entries Display */}
      <div className="row mb-4 align-items-center">
        <div className="col-md-4">
          <label htmlFor="deliveryDate" className="form-label fw-bold">Delivery Date:</label>
          <input
            type="date"
            id="deliveryDate"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="form-control"
            required
          />
        </div>
        <div className="col-md-8 text-md-end">
            <h5 className="mb-0 text-secondary">Entries Saved: <span className="badge bg-info">{deliveryRecords.length}</span></h5>
        </div>
      </div>

      <form onSubmit={handleSaveEntry} className="p-3 border rounded shadow-sm bg-light mb-4">
        <h4 className="mb-3">Customer Details</h4>
        
        {/* Row 1: Location Details (Building, Wing, Room) */}
        <div className="row g-3 mb-3">
          <div className="col-md-5">
            <label htmlFor="buildingName" className="form-label">Building Name</label>
            <input
              type="text"
              id="buildingName"
              placeholder="e.g., Varthman Bld."
              value={currentEntry.buildingName}
              onChange={(e) => handleChange('buildingName', e.target.value)}
              className="form-control"
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="wing" className="form-label">Wing</label>
            <input
              type="text"
              id="wing"
              placeholder="e.g., A or B"
              value={currentEntry.wing}
              onChange={(e) => handleChange('wing', e.target.value)}
              className="form-control text-center"
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="roomNo" className="form-label fw-bold">Room No. <span className="text-danger">*</span></label>
            <input
              type="text"
              id="roomNo"
              placeholder="e.g., 101"
              value={currentEntry.roomNo}
              onChange={(e) => handleChange('roomNo', e.target.value)}
              className="form-control text-center"
              required
            />
          </div>
        </div>

        {/* Row 2: Milk Quantity */}
        <div className="row g-3 mb-3">
            <div className="col-md-4">
                <label htmlFor="milkQuantity" className="form-label fw-bold">Milk Qty (Liters) <span className="text-danger">*</span></label>
                <input
                    type="number"
                    step="0.5"
                    min="0"
                    id="milkQuantity"
                    value={currentEntry.milkQuantityLiters}
                    onChange={(e) => handleChange('milkQuantityLiters', parseFloat(e.target.value))}
                    className="form-control form-control-lg text-center"
                    required
                />
            </div>
            {/* Empty column for spacing / alignment */}
            <div className="col-md-8"></div> 
        </div>

        {/* Row 3: Extra Product and Quantity */}
        <div className="row g-3 mb-3 border-top pt-3">
            <div className="col-md-6">
                <label htmlFor="extraProduct" className="form-label">Extra Product</label>
                <select
                    id="extraProduct"
                    value={currentEntry.extraProduct}
                    onChange={(e) => handleChange('extraProduct', e.target.value)}
                    className="form-select"
                >
                    <option value="None">None</option>
                    <option value="Curd">Curd</option>
                    <option value="Butter">Butter</option>
                    <option value="Paneer">Paneer</option>
                    <option value="Chaas">Chaas</option>
                </select>
            </div>
            
            {/* Conditional Quantity Input */}
            {currentEntry.extraProduct !== 'None' && (
                <div className="col-md-3">
                    <label htmlFor="extraQuantity" className="form-label">Quantity</label>
                    <input
                        type="number"
                        min="1"
                        id="extraQuantity"
                        value={currentEntry.extraProductQuantity}
                        onChange={(e) => handleChange('extraProductQuantity', parseInt(e.target.value))}
                        className="form-control text-center"
                        required
                    />
                </div>
            )}
        </div>

        {/* Row 4: Notes */}
        <div className="mb-4">
          <label htmlFor="notes" className="form-label">Notes/Instructions</label>
          <input
            type="text"
            id="notes"
            placeholder="e.g., Delivery at 7 AM, Paid cash"
            value={currentEntry.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="form-control"
          />
        </div>
        
        {/* Save Entry Button */}
        <div className="d-grid">
          <button type="submit" className="btn btn-primary btn-lg">
            ➕ Save Entry & Go To Next Customer
          </button>
        </div>
      </form>

      {/* Final Submit Button */}
      <div className="mt-4 text-center">
        <button 
            type="button" 
            onClick={handleSubmitAll} 
            className="btn btn-success btn-lg"
            disabled={deliveryRecords.length === 0}
        >
          💾 Submit ALL {deliveryRecords.length} Daily Deliveries
        </button>
        {deliveryRecords.length > 0 && (
            <p className="mt-2 text-muted">Click this button when all entries for the day are complete.</p>
        )}
      </div>

    </div>
  );
}

export default MilkDeliveryVerticalForm;
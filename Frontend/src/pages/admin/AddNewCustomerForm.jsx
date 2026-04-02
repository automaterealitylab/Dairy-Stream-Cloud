import React, { useState } from 'react';
import client from '../../api/client';
import { useNavigate } from 'react-router-dom';
import toast from "react-hot-toast";

function AddNewCustomerForm() {
  const [customer, setCustomer] = useState({
    // 👇 ADDED required fields for schema
    email: '',
    password: '',
    // 👆 ADDED required fields
    customerName: '',
    buildingName: '',
    wing: '',
    roomNo: '',
    defaultMilkQuantityLiters: 1.0,
    defaultExtraProduct: 'None',
    defaultExtraProductQuantity: 0,
    phoneNumber: '',
    billingCycle: 'Monthly',
  });

  const navigate = useNavigate();

  // Handle input changes
  const inputHandler = (e) => {
    const { name, value } = e.target;
    setCustomer({ ...customer, [name]: value });
  };

  // Handles form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Frontend Validation (Updated to include email and password)
    if (!customer.customerName || !customer.roomNo || !customer.buildingName || !customer.phoneNumber || !customer.email || !customer.password) {
      toast.error("All required fields (Name, Phone, Address, Email, and Password) must be filled.");
      return;
    }

    if (customer.defaultMilkQuantityLiters <= 0) {
        toast.error("Daily Milk Quantity must be greater than 0.");
        return;
    }

    if (customer.defaultExtraProduct !== 'None' && customer.defaultExtraProductQuantity <= 0) {
      toast.error("Please set a quantity greater than 0 for the selected extra product.");
      return;
    }

    try {
      await client.post("/customer/addCustomer", customer);
      toast.success("Customer added successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error adding customer:", error);
      
      
      const serverErrorMessage = error.response?.data?.message || error.response?.data?.error;

      if (serverErrorMessage) {
          toast.error(serverErrorMessage);
      } else {
          toast.error("Failed to add customer. Check the console for network error details.");
      }
    }
  };

  const isExtraProductSelected = customer.defaultExtraProduct !== 'None';

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-xl-6">
          <h2 className="mb-4 text-success text-center">👤 Add New Customer</h2>

          <form onSubmit={handleSubmit} className="p-4 border border-success rounded shadow-sm bg-white">
            
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="email" className="form-label">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  value={customer.email}
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
                  value={customer.password}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
            </div>
            
            <hr className='mt-0'/>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label htmlFor="customerName" className="form-label">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  placeholder="e.g., Mrs. Sharma"
                  value={customer.customerName}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="phoneNumber" className="form-label">
                  Phone Number<span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="e.g., 9876543210"
                  value={customer.phoneNumber}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
            </div>

            {/* Row 2 (Address details) */}
            <div className="row g-3 mb-3 border-top pt-3">
              <div className="col-md-5">
                <label htmlFor="buildingName" className="form-label">
                  Building Name<span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="buildingName"
                  name="buildingName"
                  placeholder="e.g., Varthman Bld."
                  value={customer.buildingName}
                  onChange={inputHandler}
                  className="form-control"
                  required
                />
              </div>
              <div className="col-md-3">
                <label htmlFor="wing" className="form-label">Wing</label>
                <input
                  type="text"
                  id="wing"
                  name="wing"
                  placeholder="e.g., A"
                  value={customer.wing}
                  onChange={inputHandler}
                  className="form-control text-center"
                />
              </div>
              <div className="col-md-4">
                <label htmlFor="roomNo" className="form-label">
                  Room No.<span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="roomNo"
                  name="roomNo"
                  placeholder="e.g., 101"
                  value={customer.roomNo}
                  onChange={inputHandler}
                  className="form-control text-center"
                  required
                />
              </div>
            </div>

            {/* Default Order Section */}
            <h4 className="mt-4 mb-3 text-secondary border-top pt-3">Default Order</h4>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label htmlFor="defaultMilkQuantityLiters" className="form-label">
                  Daily Milk Qty (Liters)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  id="defaultMilkQuantityLiters"
                  name="defaultMilkQuantityLiters"
                  value={customer.defaultMilkQuantityLiters}
                  onChange={inputHandler}
                  className="form-control text-center"
                />
              </div>
              <div className="col-md-4">
                <label htmlFor="billingCycle" className="form-label">Billing Cycle</label>
                <select
                  id="billingCycle"
                  name="billingCycle"
                  value={customer.billingCycle}
                  onChange={inputHandler}
                  className="form-select"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Daily">Daily (Cash)</option>
                </select>
              </div>
            </div>

            {/* Extra Product Section */}
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label htmlFor="defaultExtraProduct" className="form-label">Default Extra Product</label>
                <select
                  id="defaultExtraProduct"
                  name="defaultExtraProduct"
                  value={customer.defaultExtraProduct}
                  onChange={inputHandler}
                  className="form-select"
                >
                  <option value="None">None</option>
                  <option value="Curd">Curd</option>
                  <option value="Butter">Butter</option>
                  <option value="Paneer">Paneer</option>
                  <option value="Chaas">Chaas</option>
                </select>
              </div>

              {isExtraProductSelected && (
                <div className="col-md-3">
                  <label htmlFor="defaultExtraProductQuantity" className="form-label">Default Quantity</label>
                  <input
                    type="number"
                    min="1"
                    id="defaultExtraProductQuantity"
                    name="defaultExtraProductQuantity"
                    value={customer.defaultExtraProductQuantity}
                    onChange={inputHandler}
                    className="form-control text-center"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success btn-lg">
                ➕ Add New Customer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddNewCustomerForm;

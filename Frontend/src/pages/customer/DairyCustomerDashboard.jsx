import React, { useState, useEffect } from 'react';

const DairyCustomerDashboard = () => {
  const [showNotification, setShowNotification] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: 'Plan is active.', color: 'text-success', opacity: 'opacity-0' });
  const [paymentStatus, setPaymentStatus] = useState({
    text: 'PENDING (₹1200)',
    bgColor: 'bg-danger',
    textColor: 'text-white',
    badgeColor: 'bg-danger-subtle text-danger-emphasis'
  });

  
  useEffect(() => {
    const timer = setTimeout(() => {
      setPaymentStatus({
        text: 'PENDING (₹1200)',
        bgColor: 'bg-danger',
        textColor: 'text-white',
        badgeColor: 'bg-danger-subtle text-danger-emphasis'
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleToggleSubscription = (action) => {
    let newMessage = '';
    let newColor = '';
    let newIsPaused = isPaused;

    if (action === 'pause') {
      if (isPaused) {
        // Un-Pause
        newMessage = 'Subscription Resumed! Enjoy your daily delivery.';
        newColor = 'text-success';
        newIsPaused = false;
      } else {
        // Pause
        newMessage = 'Subscription Paused Successfully! Click Un-Pause to resume.';
        newColor = 'text-danger';
        newIsPaused = true;
      }
    } else if (action === 'modify') {
      newMessage = 'Redirecting to plan modification page...';
      newColor = 'text-primary';
      newIsPaused = false;
    }

    setIsPaused(newIsPaused);
    setStatusMessage({ text: newMessage, color: newColor, opacity: 'opacity-100' });

    setTimeout(() => {
      setStatusMessage(prev => ({ ...prev, opacity: 'opacity-0' }));
    }, 3000);
  };

  // --- Reusable Card Component ---
  const Card = ({ title, icon, children, titleColor = 'text-secondary', className = '' }) => (
    <div className={`card shadow-sm border-0 rounded-3 ${className}`}>
      <div className="card-body">
        <h2 className={`card-title fs-4 ${titleColor} mb-3 d-flex align-items-center`}>
          {icon}
          {title}
        </h2>
        {children}
      </div>
    </div>
  );

  // --- Data for the Orders Table ---
  const dailyOrders = [
    { date: 'Oct 05, 2025', type: 'Cow Milk (Full Cream)', qty: '1.0', status: 'Delivered' },
    { date: 'Oct 04, 2025', type: 'Toned Milk', qty: '0.5', status: 'Delivered' },
    { date: 'Oct 03, 2025', type: 'Not Subscribed', qty: '0.0', status: 'Paused' },
    { date: 'Oct 02, 2025', type: 'Cow Milk (Full Cream)', qty: '1.0', status: 'Delivered' },
  ];

  // Helper to determine status style
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Delivered':
        return 'bg-success-subtle text-success-emphasis'; // Success badge
      case 'Paused':
      case 'Not Subscribed':
        return 'bg-warning-subtle text-warning-emphasis'; // Warning badge
      default:
        return 'bg-light text-secondary';
    }
  };

  return (
    <div className="bg-light min-vh-100 p-3 p-sm-4 p-lg-5">
      {/* Header Section */}
      <header className="mb-4">
        <h1 className="fs-2 fw-bold text-primary">My Dairy Dashboard</h1>
        <p className="text-secondary mt-1">Welcome back, Anya Sharma. Manage your daily subscription.</p>
      </header>

      {/* Notifications Banner */}
      {showNotification && (
        <div
          className="alert alert-warning border-start border-5 border-warning p-4 rounded-3 shadow-sm mb-4 d-flex justify-content-between align-items-center"
          role="alert"
        >
          <div className="d-flex align-items-center">
            {/* Bootstrap uses icons or custom SVGs. Using a generic icon for illustration */}
            <svg className="bi me-3" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
            </svg>
            <p className="mb-0 fw-medium">Special Offer: Get 10% cashback on next month's prepaid subscription!</p>
          </div>
          <button onClick={() => setShowNotification(false)} className="btn-close" aria-label="Close"></button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="row g-4">

        {/* Column 1 & 2: Main Info */}
        <div className="col-lg-8">
          <div className="d-flex flex-column gap-4">

            {/* 1. Customer Profile Card */}
            <Card
              title="Customer Profile"
              titleColor="text-primary"
              icon={<svg className="bi me-2" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M11 6a3 3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg>}
            >
              <div className="row g-3 text-secondary">
                <div className="col-sm-6"><p className="mb-0"><strong>Name:</strong> Anya Sharma</p></div>
                <div className="col-sm-6"><p className="mb-0"><strong>ID:</strong> DAIRY-C-4589</p></div>
                <div className="col-12"><p className="mb-0"><strong>Address:</strong> A-201, Green Meadows Society, Pune, 411001</p></div>
                <div className="col-12"><p className="mb-0"><strong>Preferred Delivery Time:</strong> <span className="text-success fw-medium">6:00 AM - 6:30 AM</span></p></div>
              </div>
            </Card>

            {/* 2. Daily Milk Orders Table/List */}
            <Card
              title="Daily Milk Orders (Last 7 Days)"
              titleColor="text-primary"
              icon={<svg className="bi me-2" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M7.708 1.528a.125.125 0 0 1 .584 0l7.265 6.054a.125.125 0 0 1 .052.126.125.125 0 0 1-.092.093l-1.574.314V14.5a.5.5 0 0 1-.5.5H.824a.5.5 0 0 1-.5-.5V8.118L.38 7.708a.125.125 0 0 1 .158-.04l7.265-6.054zM8 3.298 14.5 8.71 14.5 14.5h-13L1.5 8.71 8 3.298z"/></svg>}
            >

              {/* Desktop/Tablet View (hidden on mobile) */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Type</th>
                      <th scope="col">Qty (L)</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyOrders.map((order, index) => (
                      <tr key={index}>
                        <td>{order.date}</td>
                        <td>{order.type}</td>
                        <td className="fw-medium">{order.qty}</td>
                        <td>
                          <span className={`badge rounded-pill ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (hidden on desktop/tablet) */}
              <div className="d-md-none">
                <div className="list-group list-group-flush">
                  {dailyOrders.slice(0, 3).map((order, index) => (
                    <div key={`mobile-${index}`} className="list-group-item bg-light p-3 my-2 rounded-3 border">
                      <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-secondary">Date:</span> <span className="fw-medium">{order.date.split(',')[0]}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-secondary">Type:</span> <span className="fw-medium">{order.type.includes('Milk') ? order.type.split(' ')[0] + ' Milk' : order.type}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-secondary">Qty:</span> <span className="fw-medium">{order.qty} L</span>
                      </div>
                      <div className="d-flex justify-content-between py-1">
                          <span className="text-secondary">Status:</span> 
                          <span className={`badge rounded-pill ${getStatusStyle(order.status)}`}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-link mt-3 text-decoration-none text-primary fw-medium">View Full History &rarr;</button>
              </div>
            </Card>
          </div>
        </div>

        {/* Column 3: Summary, Payment, Subscription */}
        <div className="col-lg-4">
          <div className="d-flex flex-column gap-4">

            {/* 3. Payment Info Card */}
            <Card
              title="Payment Status"
              titleColor="text-primary"
              icon={<svg className="bi me-2" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M12.643 1.252A6.71 6.71 0 0 1 15 8c0 4.288-3.473 7.76-7.76 7.76A7.76 7.76 0 0 1 .24 8a7.76 7.76 0 0 1 7.76-7.76c.49 0 .973.045 1.442.133l2.844-.099zM8 2.001c3.197 0 5.799 2.602 5.799 5.799S11.197 13.599 8 13.599 2.201 10.997 2.201 7.799 4.803 2.001 8 2.001zm0 2.25a3.55 3.55 0 1 0 0 7.1 3.55 3.55 0 0 0 0-7.1z"/></svg>}
            >
              <div className="row g-2">
                <div className="col-12">
                  <p className="d-flex justify-content-between align-items-center mb-1 text-secondary">
                    <strong>Current Status:</strong>
                    <span
                      id="payment-status"
                      className={`badge rounded-pill fw-bold ${paymentStatus.badgeColor} transition-colors duration-300`}
                    >
                      {paymentStatus.text}
                    </span>
                  </p>
                </div>
                <div className="col-12"><p className="mb-1 text-secondary"><strong>Last Payment:</strong> Sep 30, 2025</p></div>
                <div className="col-12"><p className="mb-3 text-secondary"><strong>Mode:</strong> UPI (Auto-Pay Enabled)</p></div>
              </div>
              <button className="btn btn-success w-100 fw-semibold shadow-sm">
                Pay Now
              </button>
            </Card>

            {/* 4. Monthly Summary Card */}
            <Card
  title="Monthly Summary (Sep 2025)"
  titleColor="text-primary"
  icon={<svg className="bi me-2" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M11 2a1 1 0 0 0-1 1v1h2V3a1 1 0 0 0-1-1z"/><path d="M12 1a2 2 0 0 0-2 2v1H4V3a2 2 0 0 0-2-2H1a1 1 0 0 0 0 2h1v1h12V3h1a1 1 0 0 0 0-2h-1zM2 5V4h12v1H2zm13 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6h14z"/></svg>}
>
  {/* Add d-flex to the row and ensure item heights are managed */}
  <div className="row text-center g-3 align-items-stretch"> 
    
    {/* Total Litres */}
    <div className="col-4">
      <div className="p-3 rounded-2 border border-primary-subtle bg-info-subtle h-100 d-flex flex-column justify-content-center">
        <p className="fs-4 fw-bold text-primary mb-0">30.5</p>
        <p className="text-muted text-uppercase mt-1 mb-0 small">Total Litres</p>
      </div>
    </div>
    
    {/* Total Amount */}
    <div className="col-4">
      <div className="p-3 rounded-2 border border-primary-subtle bg-info-subtle h-100 d-flex flex-column justify-content-center">
        <p className="fs-4 fw-bold text-primary mb-0">₹1450</p>
        <p className="text-muted text-uppercase mt-1 mb-0 small">Total Amount</p>
      </div>
    </div>
    
    {/* Missed Days */}
    <div className="col-4">
      <div className="p-3 rounded-2 border border-danger-subtle bg-danger-subtle h-100 d-flex flex-column justify-content-center">
        <p className="fs-4 fw-bold text-danger mb-0">2</p>
        <p className="text-muted text-uppercase mt-1 mb-0 small">Missed Days</p>
      </div>
    </div>
  </div>
</Card>

            {/* 5. Subscription Plan Card */}
            <Card
              title="Subscription Plan"
              titleColor="text-primary"
              icon={<svg className="bi me-2" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM4.5 4a.5.5 0 0 1 .5.5v3h6v-3a.5.5 0 0 1 1 0v3.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5z"/></svg>}
            >
              <p className="fs-5 fw-medium text-secondary">Cow Milk (Full Cream) - 1.0 L Daily</p>
              <p className="text-muted small mt-1">Next Renewal Date: Nov 1, 2025</p>

              <div className="d-flex gap-3 mt-4">
                <button
                  id="pause-btn"
                  onClick={() => handleToggleSubscription('pause')}
                  className={`btn flex-fill fw-semibold ${
                    isPaused
                      ? 'btn-outline-success'
                      : 'btn-outline-danger'
                  }`}
                >
                  {isPaused ? 'Un-Pause Deliveries' : 'Pause Deliveries'}
                </button>
                <button
                  id="renew-btn"
                  onClick={() => handleToggleSubscription('modify')}
                  className="btn btn-primary flex-fill fw-semibold shadow-sm"
                >
                  Modify Plan
                </button>
              </div>
              <p
                id="sub-status-message"
                className={`text-center mt-3 small fw-medium transition-opacity duration-300 ${statusMessage.color} ${statusMessage.opacity}`}
              >
                {statusMessage.text}
              </p>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DairyCustomerDashboard;
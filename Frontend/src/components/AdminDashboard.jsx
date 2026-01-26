import React from "react";
import { Card, Row, Col, Table, Badge } from "react-bootstrap";

const AdminDashboard = () => {
  return (
    <div className="container-fluid p-4" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <h2 className="fw-bold text-primary mb-1">Admin Dashboard</h2>
      <p className="text-secondary mb-4">Welcome back! Monitor your dairy business operations.</p>

      {/* ===== Stats Cards ===== */}
      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <Card className="shadow-sm stat-card border-0">
            <Card.Body>
              <i className="bi bi-people-fill text-primary fs-2"></i>
              <h5 className="mt-2">Total Customers</h5>
              <h2 className="fw-bold text-primary">128</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm stat-card border-0">
            <Card.Body>
              <i className="bi bi-truck text-success fs-2"></i>
              <h5 className="mt-2">Delivery Agents</h5>
              <h2 className="fw-bold text-success">12</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm stat-card border-0">
            <Card.Body>
              <i className="bi bi-calendar-check text-warning fs-2"></i>
              <h5 className="mt-2">Deliveries Today</h5>
              <h2 className="fw-bold text-warning">524</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm stat-card border-0">
            <Card.Body>
              <i className="bi bi-cash-coin text-danger fs-2"></i>
              <h5 className="mt-2">Pending Payments</h5>
              <h2 className="fw-bold text-danger">₹ 32,870</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ===== Recent Orders / Activities ===== */}
      <Row className="g-4">
        <Col lg={8}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white fw-bold text-primary fs-5">
              Recent Deliveries
            </Card.Header>
            <Card.Body className="p-0">
              <Table striped hover responsive className="mb-0 text-center">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Qty (L)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>05 Oct 2025</td>
                    <td>Amit Patil</td>
                    <td>1.0</td>
                    <td><Badge bg="success">Delivered</Badge></td>
                  </tr>
                  <tr>
                    <td>05 Oct 2025</td>
                    <td>Shaikh Household</td>
                    <td>0.5</td>
                    <td><Badge bg="warning">Paused</Badge></td>
                  </tr>
                  <tr>
                    <td>04 Oct 2025</td>
                    <td>Nimbalkar Society</td>
                    <td>1.0</td>
                    <td><Badge bg="danger">Missed</Badge></td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        {/* Activities Panel */}
        <Col lg={4}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white fw-bold text-primary fs-5">
              Recent Activities
            </Card.Header>
            <Card.Body>
              <ul className="list-unstyled">
                <li className="mb-3"><i className="bi bi-plus-circle text-primary"></i> New customer registered — <strong>Amit Patil</strong></li>
                <li className="mb-3"><i className="bi bi-person-plus text-success"></i> Delivery agent added — <strong>Suresh Kumar</strong></li>
                <li className="mb-3"><i className="bi bi-wallet text-warning"></i> Payment received — <strong>₹590</strong></li>
                <li className="mb-2"><i className="bi bi-x-circle text-danger"></i> Delivery skipped — <strong>Flat 304</strong></li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;

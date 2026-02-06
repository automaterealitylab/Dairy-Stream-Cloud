import React from "react";
import { Card, Row, Col, Table, Badge, Button } from "react-bootstrap";

const AgentDashboard = () => {
  return (
    <div className="p-4" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <h2 className="fw-bold text-primary mb-1">Delivery Agent Dashboard</h2>
      <p className="text-secondary mb-4">Welcome! Track & update your delivery tasks for today.</p>

      {/* ===== Delivery Stats ===== */}
      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h6>Total Assigned Deliveries</h6>
              <h2 className="fw-bold text-primary">38</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h6>Completed</h6>
              <h2 className="fw-bold text-success">21</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h6>Pending</h6>
              <h2 className="fw-bold text-warning">14</h2>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h6>Skipped / Not Subscribed</h6>
              <h2 className="fw-bold text-danger">3</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ===== Today's Deliveries ===== */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white fw-bold text-primary">Today's Delivery List</Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 text-center">
            <thead className="table-light">
              <tr>
                <th>Customer</th>
                <th>Address</th>
                <th>Qty (L)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Amit Patil</td>
                <td>Green Valley Society, Flat 102</td>
                <td>1.0</td>
                <td><Badge bg="warning">Pending</Badge></td>
                <td>
                  <Button size="sm" variant="success" className="me-2">Delivered</Button>
                  <Button size="sm" variant="danger">Missed</Button>
                </td>
              </tr>

              <tr>
                <td>Pooja Household</td>
                <td>Sunshine Building, Flat B-304</td>
                <td>0.5</td>
                <td><Badge bg="warning">Pending</Badge></td>
                <td>
                  <Button size="sm" variant="success" className="me-2">Delivered</Button>
                  <Button size="sm" variant="danger">Missed</Button>
                </td>
              </tr>

              <tr>
                <td>Shaikh Family</td>
                <td>Lotus Heights Tower, 7th Floor</td>
                <td>1.0</td>
                <td><Badge bg="success">Completed</Badge></td>
                <td>
                  <Button size="sm" variant="secondary" disabled>Updated</Button>
                </td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* ===== Route Info / Contact Support ===== */}
      <Row className="g-4">
        <Col lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white fw-bold text-primary">Route Information</Card.Header>
            <Card.Body>
              <p className="m-0">
                <strong>Assigned Route:</strong> Narhe – Ambegaon – Dhayari
              </p>
              <p className="mt-1">
                <strong>Start Time:</strong> 5:30 AM – 9:00 AM
              </p>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white fw-bold text-primary">Support</Card.Header>
            <Card.Body>
              <p className="mb-2"><strong>Need Help?</strong></p>
              <Button variant="primary"><i className="bi bi-chat-fill me-2"></i> Contact Support</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AgentDashboard;

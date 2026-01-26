import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Table, Button, Modal } from "react-bootstrap";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [stats, setStats] = useState({ totalLitres: 0, grossRevenue: 0, outstanding: 0 });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const res = await axios.get("http://localhost:3000/api/customers");
    setCustomers(res.data);

    // Calculate stats dynamically
    const totalLitres = res.data.reduce((sum, c) => sum + c.totalLitres, 0);
    const outstanding = res.data.reduce((sum, c) => sum + c.outstanding, 0);
    const grossRevenue = totalLitres * 40; // example rate ₹40/L
    setStats({ totalLitres, outstanding, grossRevenue });
  };

  return (
    <Container fluid className="p-4 bg-light min-vh-100">
      <h2 className="fw-bold mb-4">🧈 Dairy Customer Dashboard</h2>

      {/* Top Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center text-white bg-success">
            <Card.Body>
              <Card.Title>Gross Revenue</Card.Title>
              <h3>₹{stats.grossRevenue.toLocaleString()}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center text-white bg-primary">
            <Card.Body>
              <Card.Title>Total Litres Sold</Card.Title>
              <h3>{stats.totalLitres.toLocaleString()}L</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center text-white bg-danger">
            <Card.Body>
              <Card.Title>Outstanding Payments</Card.Title>
              <h3>₹{stats.outstanding.toLocaleString()}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <Card.Header className="fw-bold bg-secondary text-white">
          Customer Details
        </Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Total Litres</th>
                <th>Outstanding (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => (
                <tr key={cust._id}>
                  <td>{cust.name}</td>
                  <td>{cust.totalLitres}</td>
                  <td>{cust.outstanding}</td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => setSelectedCustomer(cust)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Modal */}
      <Modal show={!!selectedCustomer} onHide={() => setSelectedCustomer(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedCustomer?.name}'s Monthly Trend</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={selectedCustomer?.monthlyTrend || []}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="litres" stroke="#0d6efd" />
            </LineChart>
          </ResponsiveContainer>
          <hr />
          <p><strong>Total Litres:</strong> {selectedCustomer?.totalLitres}L</p>
          <p><strong>Outstanding:</strong> ₹{selectedCustomer?.outstanding}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelectedCustomer(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default App;

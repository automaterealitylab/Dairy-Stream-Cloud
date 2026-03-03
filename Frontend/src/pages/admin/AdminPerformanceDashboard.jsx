import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle, XCircle, Zap, Calendar } from 'lucide-react';

const AdminPerformanceDashboard = () => {
  const [performanceData, setPerformanceData] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [missedDeliveries, setMissedDeliveries] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalAgents: 0,
    totalDeliveries: 0,
    completedDeliveries: 0,
    missedDeliveries: 0,
    overallEfficiency: 0,
  });
  const [dateRange, setDateRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API calls
        // const performance = await fetchAgentPerformance(dateRange);
        // const topAgents = await fetchTopPerformers();
        // const missed = await fetchMissedDeliveries();

        // Mock data for demonstration
        const mockPerformance = [
          { agent: 'Raj Kumar', completed: 45, failed: 5, efficiency: 90 },
          { agent: 'Priya Singh', completed: 42, failed: 3, efficiency: 93 },
          { agent: 'Amit Patel', completed: 38, failed: 7, efficiency: 84 },
          { agent: 'Neha Verma', completed: 40, failed: 5, efficiency: 89 },
          { agent: 'Sanjay Gupta', completed: 35, failed: 8, efficiency: 81 },
        ];

        const mockTopPerformers = [
          { agentName: 'Priya Singh', completionRate: 93, deliveriesCompleted: 42 },
          { agentName: 'Raj Kumar', completionRate: 90, deliveriesCompleted: 45 },
          { agentName: 'Neha Verma', completionRate: 89, deliveriesCompleted: 40 },
        ];

        const mockMissedDeliveries = [
          {
            agentName: 'Sanjay Gupta',
            customerName: 'John Doe',
            address: 'Flat 101, Building A',
            failedReason: 'CUSTOMER_UNAVAILABLE',
            deliveryDate: new Date().toLocaleDateString(),
          },
          {
            agentName: 'Amit Patel',
            customerName: 'Jane Smith',
            address: 'Flat 202, Building B',
            failedReason: 'PAYMENT_ISSUE',
            deliveryDate: new Date(Date.now() - 86400000).toLocaleDateString(),
          },
        ];

        setPerformanceData(mockPerformance);
        setTopPerformers(mockTopPerformers);
        setMissedDeliveries(mockMissedDeliveries);

        const totalDeliveries = mockPerformance.reduce((sum, item) => sum + item.completed + item.failed, 0);
        const completedDeliveries = mockPerformance.reduce((sum, item) => sum + item.completed, 0);

        setSummaryStats({
          totalAgents: mockPerformance.length,
          totalDeliveries,
          completedDeliveries,
          missedDeliveries: totalDeliveries - completedDeliveries,
          overallEfficiency: Math.round(completedDeliveries / totalDeliveries * 100),
        });

        setError(null);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  const efficiencyData = [
    { name: '90-100%', value: topPerformers.length, color: '#10b981' },
    { name: '80-90%', value: performanceData.filter(d => d.efficiency >= 80 && d.efficiency < 90).length, color: '#f59e0b' },
    { name: '< 80%', value: performanceData.filter(d => d.efficiency < 80).length, color: '#ef4444' },
  ];

  const failureReasons = {
    CUSTOMER_UNAVAILABLE: missedDeliveries.filter(d => d.failedReason === 'CUSTOMER_UNAVAILABLE').length,
    PAYMENT_ISSUE: missedDeliveries.filter(d => d.failedReason === 'PAYMENT_ISSUE').length,
    WRONG_ADDRESS: missedDeliveries.filter(d => d.failedReason === 'WRONG_ADDRESS').length,
    OTHER: missedDeliveries.filter(d => d.failedReason === 'OTHER').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Agent Performance Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor agent performance and delivery metrics</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-4">
            <Calendar size={24} className="text-gray-600" />
            <div className="flex gap-2">
              {[
                { value: '7days', label: 'Last 7 days' },
                { value: '30days', label: 'Last 30 days' },
                { value: 'month', label: 'This Month' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    dateRange === option.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Agents</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{summaryStats.totalAgents}</p>
              </div>
              <Users size={40} className="text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Deliveries</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{summaryStats.totalDeliveries}</p>
              </div>
              <Zap size={40} className="text-yellow-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{summaryStats.completedDeliveries}</p>
              </div>
              <CheckCircle size={40} className="text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Missed</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{summaryStats.missedDeliveries}</p>
              </div>
              <XCircle size={40} className="text-red-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Overall Efficiency</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{summaryStats.overallEfficiency}%</p>
              </div>
              <TrendingUp size={40} className="text-indigo-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Performance by Agent */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance by Agent</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agent" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" name="Completed" />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Efficiency Distribution */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Efficiency Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={efficiencyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {efficiencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={24} className="text-green-600" />
              Top Performers
            </h3>
            <div className="space-y-4">
              {topPerformers.map((agent, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{agent.agentName}</p>
                      <p className="text-sm text-gray-600">{agent.deliveriesCompleted} deliveries</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{agent.completionRate}%</p>
                    <p className="text-xs text-gray-600">efficiency</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Failure Reasons */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Failure Reasons</h3>
            <div className="space-y-3">
              {[
                { reason: 'Customer Unavailable', count: failureReasons.CUSTOMER_UNAVAILABLE, color: 'bg-red-500' },
                { reason: 'Payment Issue', count: failureReasons.PAYMENT_ISSUE, color: 'bg-orange-500' },
                { reason: 'Wrong Address', count: failureReasons.WRONG_ADDRESS, color: 'bg-yellow-500' },
                { reason: 'Other', count: failureReasons.OTHER, color: 'bg-gray-500' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`${item.color} w-4 h-4 rounded`}></div>
                  <span className="flex-1 text-gray-700 font-medium">{item.reason}</span>
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold text-gray-800">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Missed Deliveries */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Missed Deliveries</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Agent</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {missedDeliveries.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.agentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{item.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{item.address}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                        {item.failedReason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{item.deliveryDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPerformanceDashboard;

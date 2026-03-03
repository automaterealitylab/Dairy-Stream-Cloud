import React, { useState, useEffect } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import {
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';

const AgentEarnings = () => {
  const [todayData, setTodayData] = useState({
    deliveries: { total: 0, completed: 0, pending: 0, failed: 0 },
    earnings: { deliveries_completed: 0, total_earnings: 0, net_earnings: 0, bonus_amount: 0 },
  });
  const [summaryData, setSummaryData] = useState({
    earnings: [],
    summary: { totalEarnings: 0, totalDeliveries: 0, averagePerDay: 0, count: 0 },
  });
  const [dateRange, setDateRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API calls
        // const today = await fetchTodayWorkSummary();
        // const summary = await fetchEarningsSummary(dateRange);
        
        // Mock data for now
        setTodayData({
          deliveries: { total: 12, completed: 10, pending: 2, failed: 0 },
          earnings: {
            deliveries_completed: 10,
            total_earnings: 500,
            net_earnings: 500,
            bonus_amount: 50,
          },
        });

        setSummaryData({
          earnings: [
            { earning_date: new Date().toLocaleDateString(), net_earnings: 500, deliveries_completed: 10 },
            { earning_date: new Date(Date.now() - 86400000).toLocaleDateString(), net_earnings: 450, deliveries_completed: 9 },
            { earning_date: new Date(Date.now() - 172800000).toLocaleDateString(), net_earnings: 550, deliveries_completed: 11 },
          ],
          summary: { totalEarnings: 1500, totalDeliveries: 30, averagePerDay: 500, count: 3 },
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching earnings data:', err);
        setError('Failed to load earnings data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  const calculateProgress = () => {
    const completed = todayData.deliveries.completed;
    const total = todayData.deliveries.total;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading earnings data...</div>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800">Earnings & Work Summary</h1>
            <p className="text-gray-600 mt-2">Track your daily deliveries and earnings</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Today's Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Deliveries */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Deliveries</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {todayData.deliveries.total}
                  </p>
                </div>
                <Package size={40} className="text-blue-500 opacity-20" />
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {todayData.deliveries.completed}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {calculateProgress()}% completed
                  </p>
                </div>
                <CheckCircle size={40} className="text-green-500 opacity-20" />
              </div>
            </div>

            {/* Pending/Failed */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Pending/Failed</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {todayData.deliveries.pending + todayData.deliveries.failed}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {todayData.deliveries.pending} pending,{' '}
                    {todayData.deliveries.failed} failed
                  </p>
                </div>
                <AlertCircle size={40} className="text-orange-500 opacity-20" />
              </div>
            </div>

            {/* Today's Earnings */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Today's Earnings</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">
                    {todayData.earnings.net_earnings > 0 ? `₹${todayData.earnings.net_earnings}` : '₹0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    +₹{todayData.earnings.bonus_amount} bonus
                  </p>
                </div>
                <DollarSign size={40} className="text-indigo-500 opacity-20" />
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Progress</h3>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {todayData.deliveries.completed} of {todayData.deliveries.total} deliveries completed
                </span>
                <span className="text-sm font-semibold text-gray-800">{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-4 rounded-full transition-all"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>
          </div>

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

          {/* Earnings Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={24} className="text-green-600" />
              Earnings Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  ₹{summaryData.summary.totalEarnings}
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                <p className="text-sm text-gray-600">Total Deliveries</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">
                  {summaryData.summary.totalDeliveries}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                <p className="text-sm text-gray-600">Average Per Day</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">
                  ₹{summaryData.summary.averagePerDay}
                </p>
              </div>
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Deliveries
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Earnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.earnings.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">{item.earning_date}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {item.deliveries_completed} completed
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        ₹{item.net_earnings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentEarnings;

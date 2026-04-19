import React, { useState, useEffect } from "react";
import AgentLayout from "../../components/agent/AgentLayout";
import {
  TrendingUp,
  DollarSign,
  Package,
  CheckCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const SummaryCard = ({ label, value, helper, Icon, iconTone }) => (
  <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">{label}</p>
        <p className="mt-2 text-3xl font-black text-[#2C1A0E]">{value}</p>
        {helper ? <p className="mt-1 text-xs font-semibold text-[#8B7355]">{helper}</p> : null}
      </div>
      <div className={`rounded-[18px] border px-3 py-3 ${iconTone}`}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);

const AgentEarnings = () => {
  const [todayData, setTodayData] = useState({
    deliveries: { total: 0, completed: 0, pending: 0, failed: 0 },
    earnings: { deliveries_completed: 0, total_earnings: 0, net_earnings: 0, bonus_amount: 0 },
  });
  const [summaryData, setSummaryData] = useState({
    earnings: [],
    summary: { totalEarnings: 0, totalDeliveries: 0, averagePerDay: 0, count: 0 },
  });
  const [dateRange, setDateRange] = useState("7days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
      } catch (_err) {
        setError("Failed to load earnings data");
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
        <div className="flex min-h-screen items-center justify-center bg-[#FFFDF7] text-[#8B7355]">
          Loading earnings data...
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout>
      <div className="min-h-screen bg-[#FFFDF7] px-4 pb-6 text-[#2C1A0E]">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-[32px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#2C1A0E_0%,#4A3820_58%,#6B4F2A_100%)] px-6 py-6 text-white shadow-[0_22px_50px_rgba(92,61,30,0.22)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Earnings</p>
            <h1 className="mt-2 text-4xl font-black leading-none" style={headingFont}>
              Work Summary
            </h1>
            <p className="mt-3 text-sm font-medium text-white/75">Track your daily deliveries and earnings</p>
          </section>

          {error && (
            <div className="rounded-[22px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#C0392B]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total Deliveries"
              value={todayData.deliveries.total}
              Icon={Package}
              iconTone="border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]"
            />
            <SummaryCard
              label="Completed"
              value={todayData.deliveries.completed}
              helper={`${calculateProgress()}% completed`}
              Icon={CheckCircle}
              iconTone="border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
            />
            <SummaryCard
              label="Pending / Failed"
              value={todayData.deliveries.pending + todayData.deliveries.failed}
              helper={`${todayData.deliveries.pending} pending, ${todayData.deliveries.failed} failed`}
              Icon={AlertCircle}
              iconTone="border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]"
            />
            <SummaryCard
              label="Today's Earnings"
              value={`Rs ${todayData.earnings.net_earnings || 0}`}
              helper={`+Rs ${todayData.earnings.bonus_amount} bonus`}
              Icon={DollarSign}
              iconTone="border-[#F3E7D6] bg-[#FFF8EF] text-[#8B5CF6]"
            />
          </div>

          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">Today's Progress</p>
                <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">
                  {todayData.deliveries.completed} of {todayData.deliveries.total} deliveries completed
                </p>
              </div>
              <span className="text-lg font-black text-[#B8641A]">{calculateProgress()}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-[#F3E7D6]">
              <div
                className="h-4 rounded-full bg-[linear-gradient(90deg,#B8641A_0%,#D9903D_100%)]"
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-[#B8641A]">
                <Calendar size={20} />
                <span className="text-sm font-black uppercase tracking-[0.16em] text-[#A88763]">Date Range</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "7days", label: "Last 7 days" },
                  { value: "30days", label: "Last 30 days" },
                  { value: "month", label: "This Month" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateRange(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      dateRange === option.value
                        ? "bg-[#B8641A] text-white"
                        : "bg-[#FFF8EF] text-[#8B7355]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-black text-[#2C1A0E]">
              <TrendingUp size={22} className="text-[#4A7C2F]" />
              Earnings Summary
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[22px] bg-[linear-gradient(135deg,#EEF5E7_0%,#F8FBF4_100%)] p-6">
                <p className="text-sm text-[#6B5B3E]">Total Earnings</p>
                <p className="mt-2 text-3xl font-black text-[#4A7C2F]">Rs {summaryData.summary.totalEarnings}</p>
              </div>
              <div className="rounded-[22px] bg-[linear-gradient(135deg,#FFF4E2_0%,#FFF8EF_100%)] p-6">
                <p className="text-sm text-[#6B5B3E]">Total Deliveries</p>
                <p className="mt-2 text-3xl font-black text-[#B8641A]">{summaryData.summary.totalDeliveries}</p>
              </div>
              <div className="rounded-[22px] bg-[linear-gradient(135deg,#FFF1E4_0%,#FFF8EF_100%)] p-6">
                <p className="text-sm text-[#6B5B3E]">Average Per Day</p>
                <p className="mt-2 text-3xl font-black text-[#C86A2B]">Rs {summaryData.summary.averagePerDay}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <h3 className="mb-4 text-lg font-black text-[#2C1A0E]">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full overflow-hidden rounded-[20px]">
                <thead className="border-b border-[#F3E7D6] bg-[#FFF8EF]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[#6B5B3E]">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[#6B5B3E]">Deliveries</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[#6B5B3E]">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.earnings.map((item, index) => (
                    <tr key={index} className="border-b border-[#F8F1E7] hover:bg-[#FFFDF9]">
                      <td className="px-4 py-3 text-sm text-[#2C1A0E]">{item.earning_date}</td>
                      <td className="px-4 py-3 text-sm text-[#2C1A0E]">{item.deliveries_completed} completed</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#4A7C2F]">Rs {item.net_earnings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentEarnings;

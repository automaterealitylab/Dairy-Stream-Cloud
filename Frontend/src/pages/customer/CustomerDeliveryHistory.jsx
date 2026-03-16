import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import {
  RefreshCw, Loader2, MapPin, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronUp, CalendarCheck2, CalendarX2, CirclePlus,
} from 'lucide-react';
import { fetchCustomerDeliveries } from '../../api/customer/customer.api';

const PREVIEW = 7;

const STATUS_CFG = {
  DELIVERED: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-50 text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
    label: 'Delivered',
    sub: (item) => (item.time ? `Dropped at ${item.time}` : 'Delivered'),
  },
  SKIPPED: {
    icon: XCircle,
    iconBg: 'bg-red-50 text-red-500',
    badge: 'bg-red-50 text-red-600',
    label: 'Skipped',
    sub: () => 'Not delivered',
  },
  PENDING: {
    icon: Clock,
    iconBg: 'bg-amber-50 text-amber-500',
    badge: 'bg-amber-50 text-amber-600',
    label: 'Pending',
    sub: () => 'Partner not assigned',
  },
  PENDING_APPROVAL: {
    icon: Clock,
    iconBg: 'bg-amber-50 text-amber-500',
    badge: 'bg-amber-50 text-amber-600',
    label: 'Pending',
    sub: () => 'Partner not assigned',
  },
};

function getCfg(status) {
  return STATUS_CFG[String(status || '').toUpperCase()] || STATUS_CFG.PENDING;
}

function getWeekBucket(dateStr) {
  try {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff < 7)  return { key: 'w0', label: 'This week' };
    if (diff < 14) return { key: 'w1', label: 'Last week' };
    if (diff < 21) return { key: 'w2', label: '2 weeks ago' };
    if (diff < 28) return { key: 'w3', label: '3 weeks ago' };
    return { key: 'w4', label: '4+ weeks ago' };
  } catch {
    return { key: 'w9', label: 'Earlier' };
  }
}

function getMonthBucket(dateStr) {
  try {
    const d = new Date(dateStr);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    const key = `m_${d.getFullYear()}_${d.getMonth()}`;
    return { key, label };
  } catch {
    return { key: 'm_old', label: 'Earlier' };
  }
}

function buildGroups(deliveries, view) {
  const map = new Map();
  deliveries.forEach((d) => {
    const bucket = view === 'week' ? getWeekBucket(d.date) : getMonthBucket(d.date);
    if (!map.has(bucket.key)) map.set(bucket.key, { label: bucket.label, items: [] });
    map.get(bucket.key).items.push(d);
  });
  return Array.from(map.values());
}

function DeliveryRow({ item, muted = false }) {
  const cfg  = getCfg(item.status);
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-none transition-colors hover:bg-gray-50/60 ${muted ? 'opacity-40' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${muted ? 'text-sm text-gray-500' : 'text-sm text-gray-900'}`}>
          {item.qty} {item.product}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{cfg.sub(item)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-gray-300 mb-1">{item.date}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

function CollapsedSummary({ items, onExpand }) {
  const delivered = items.filter((x) => String(x.status).toUpperCase() === 'DELIVERED').length;
  const skipped   = items.filter((x) => String(x.status).toUpperCase() === 'SKIPPED').length;
  const pending   = items.filter((x) => ['PENDING','PENDING_APPROVAL'].includes(String(x.status).toUpperCase())).length;
  const parts = [
    delivered ? `${delivered} delivered` : '',
    skipped   ? `${skipped} skipped`     : '',
    pending   ? `${pending} pending`     : '',
  ].filter(Boolean).join(' · ');

  return (
    <button onClick={onExpand} className="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-gray-50/60 transition-colors">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {delivered > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          {skipped   > 0 && <span className="w-2 h-2 rounded-full bg-red-400" />}
          {pending   > 0 && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>
        <span className="text-xs text-gray-400">{parts}</span>
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold text-gray-300">
        Show all <ChevronDown size={13} />
      </span>
    </button>
  );
}

function GroupBlock({ group, isFirst }) {
  const [showMore,   setShowMore]   = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { label, items } = group;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-50">
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] text-gray-200">{items.length} deliveries</span>
      </div>
      {isFirst ? (
        <>
          {items.slice(0, showMore ? items.length : PREVIEW).map((item, i) => (
            <DeliveryRow key={item.id ?? i} item={item} muted={showMore && i >= PREVIEW} />
          ))}
          {items.length > PREVIEW && (
            <button
              onClick={() => setShowMore((p) => !p)}
              className="w-full flex items-center justify-between px-6 py-3.5 border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
            >
              <span className="text-xs text-gray-400">
                {showMore ? 'Hide extra rows' : `${items.length - PREVIEW} more deliveries`}
              </span>
              {showMore
                ? <ChevronUp size={14} className="text-gray-300" />
                : <ChevronDown size={14} className="text-gray-300" />}
            </button>
          )}
        </>
      ) : isExpanded ? (
        <>
          {items.map((item, i) => <DeliveryRow key={item.id ?? i} item={item} muted />)}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-between px-6 py-3.5 border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
          >
            <span className="text-xs text-gray-400">Collapse</span>
            <ChevronUp size={14} className="text-gray-300" />
          </button>
        </>
      ) : (
        <CollapsedSummary items={items} onExpand={() => setIsExpanded(true)} />
      )}
    </div>
  );
}

export default function Deliveries() {
  const navigate = useNavigate();
  const [deliveries,    setDeliveries] = useState([]);
  const [todayDelivery, setToday]      = useState(null);
  const [insights,      setInsights]   = useState({
    monthLabel: '', monthlyDeliveryCount: 0, skippedDays: 0, extraOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [view,    setView]    = useState('week');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchCustomerDeliveries();
      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
      setToday(data?.todayDelivery || null);
      setInsights({
        monthLabel:           data?.insights?.monthLabel || '',
        monthlyDeliveryCount: Number(data?.insights?.monthlyDeliveryCount || 0),
        skippedDays:          Number(data?.insights?.skippedDays || 0),
        extraOrders:          Number(data?.insights?.extraOrders || 0),
      });
    } catch (err) {
      setError(err?.message || 'Could not load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const groups = useMemo(() => buildGroups(deliveries, view), [deliveries, view]);

  const todayStatus      = String(todayDelivery?.status || 'PENDING').toUpperCase();
  const todayCfg         = getCfg(todayStatus);
  const canTrack         = !!todayDelivery?.canTrackAgent;
  const todayTimingLabel =
    todayStatus === 'DELIVERED'
      ? todayDelivery?.time ? `Delivered at ${todayDelivery.time}` : 'Delivered'
      : todayDelivery?.slotWindow  ? `Expected ${todayDelivery.slotWindow}`
      : todayDelivery?.slot && todayDelivery.slot !== '-' ? `${todayDelivery.slot} slot`
      : 'Expected today';

  const insightCards = [
    { label: insights.monthLabel ? `${insights.monthLabel} Deliveries` : 'Monthly', value: insights.monthlyDeliveryCount, color: 'text-emerald-600', iconBg: 'bg-emerald-50 text-emerald-500', Icon: CalendarCheck2 },
    { label: 'Skipped Days',  value: insights.skippedDays,  color: 'text-red-500',  iconBg: 'bg-red-50 text-red-400',   Icon: CalendarX2 },
    { label: 'Extra Orders',  value: insights.extraOrders,  color: 'text-blue-600', iconBg: 'bg-blue-50 text-blue-500', Icon: CirclePlus },
  ];

  return (
    <CustomerLayout>
      {/*
        Single-column, full-width — matches the rest of the dashboard layout.
        No max-w constraint; CustomerLayout's own padding/max-w handles the outer bounds.
      */}
      <div className="w-full px-6 py-8 space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Delivery History
          </h1>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* ── Stat cards — always 3 columns ── */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            {insightCards.map(({ label, value, color, iconBg, Icon }) => (
              <div
                key={label}
                className="bg-white border border-gray-100 rounded-2xl p-5 flex justify-between items-end hover:-translate-y-0.5 transition-transform"
              >
                <div>
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">{label}</p>
                  <p className={`text-4xl font-extrabold leading-none tracking-tight ${color}`}>{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                  <Icon size={18} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Today card — full width banner ── */}
        {todayDelivery && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 relative overflow-hidden">
            <MapPin className="absolute -right-4 -bottom-4 text-gray-100" size={120} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-3">
              Today's Delivery
            </p>
            <div className="flex items-center justify-between gap-6 relative">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {todayDelivery.quantity} {todayDelivery.product}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${todayCfg.badge}`}>
                    {todayDelivery.status}
                  </span>
                  {todayDelivery.isOneTimeOrder && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      One-time
                    </span>
                  )}
                  {todayDelivery.slot && todayDelivery.slot !== '-' && (
                    <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-500">
                      {todayDelivery.slot}
                    </span>
                  )}
                  {todayDelivery.paymentMethod && todayDelivery.paymentMethod !== '-' && (
                    <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-500">
                      {todayDelivery.paymentMethod}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                  <Clock size={11} className="flex-shrink-0" />
                  {todayTimingLabel}
                  {todayDelivery.dairyName && <span className="text-gray-300 mx-1">·</span>}
                  {todayDelivery.dairyName && <span>{todayDelivery.dairyName}</span>}
                </p>
              </div>
              <button
                onClick={() => navigate('/customer/dashboard/track/agent', { state: { delivery: todayDelivery } })}
                disabled={!canTrack}
                className="flex-shrink-0 flex items-center gap-2 bg-gray-900 text-white px-6 py-3.5 rounded-2xl text-sm font-bold hover:bg-gray-700 transition active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <MapPin size={16} />
                Track Agent
              </button>
            </div>
          </div>
        )}

        {/* ── Recent deliveries ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-32 flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Loading…</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
            <p className="text-sm text-gray-400">No delivery records yet.</p>
          </div>
        ) : (
          <>
            {/* Section header + week/month toggle */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                Recent Deliveries
              </p>
              <div className="flex bg-white border border-gray-100 rounded-xl p-1 gap-1">
                {['week', 'month'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      view === v ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Grouped delivery list */}
            <div>
              {groups.map((group, idx) => (
                <GroupBlock key={group.label} group={group} isFirst={idx === 0} />
              ))}
            </div>
          </>
        )}

      </div>
    </CustomerLayout>
  );
}

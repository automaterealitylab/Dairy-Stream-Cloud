import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import {
  RefreshCw, Loader2, MapPin, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronUp, CalendarCheck2, CalendarX2, CirclePlus,
} from 'lucide-react';
import {
  fetchCustomerDeliveries,
  getCachedCustomerDeliveries,
} from '../../api/customer/customer.api';

const PREVIEW = 7;
const headingFont = { fontFamily: "'Lora', serif" };
const EMPTY_INSIGHTS = {
  monthLabel: '',
  monthlyDeliveryCount: 0,
  skippedDays: 0,
  extraOrders: 0,
};

const STATUS_CFG = {
  DELIVERED: {
    icon: CheckCircle,
    iconBg: 'bg-[#EEF5E7] text-[#4A7C2F]',
    badge: 'bg-[#EEF5E7] text-[#4A7C2F]',
    label: 'Delivered',
    sub: (item) => (item.time ? `Dropped at ${item.time}` : 'Delivered'),
  },
  SKIPPED: {
    icon: XCircle,
    iconBg: 'bg-[#FDECEA] text-[#C0392B]',
    badge: 'bg-[#FDECEA] text-[#C0392B]',
    label: 'Skipped',
    sub: () => 'Not delivered',
  },
  PENDING: {
    icon: Clock,
    iconBg: 'bg-[#FFF1E4] text-[#B8641A]',
    badge: 'bg-[#FFF1E4] text-[#B8641A]',
    label: 'Pending',
    sub: () => 'Partner not assigned',
  },
  PENDING_APPROVAL: {
    icon: Clock,
    iconBg: 'bg-[#FFF1E4] text-[#B8641A]',
    badge: 'bg-[#FFF1E4] text-[#B8641A]',
    label: 'Approval Pending',
    sub: () => 'Waiting for dairy approval',
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

function toDeliveryViewState(data) {
  return {
    deliveries: Array.isArray(data?.deliveries) ? data.deliveries : [],
    todayDelivery: data?.todayDelivery || null,
    insights: {
      monthLabel: data?.insights?.monthLabel || '',
      monthlyDeliveryCount: Number(data?.insights?.monthlyDeliveryCount || 0),
      skippedDays: Number(data?.insights?.skippedDays || 0),
      extraOrders: Number(data?.insights?.extraOrders || 0),
    },
  };
}

function getDeliveryTypeLabel(delivery = {}) {
  const normalizedType = String(delivery?.deliveryType || '').toUpperCase();
  if (normalizedType === 'ONE_TIME') return 'One-time';
  if (normalizedType === 'SUBSCRIPTION') return 'Subscription';
  return delivery?.isOneTimeOrder ? 'One-time' : 'Subscription';
}

function DeliveryRow({ item, muted = false }) {
  const cfg  = getCfg(item.status);
  const Icon = cfg.icon;
  const hasIssue = Boolean(String(item?.customerIssue || '').trim());
  const issueStatus = String(item?.issueStatus || '').toUpperCase();
  const hasAdminAction = Boolean(String(item?.issueAdminAction || '').trim());
  const Divider = () => <span className="mx-1 text-[#D8C8B2]">|</span>;
  return (
    <div className={`flex items-start gap-4 border-b border-[#F2EDE4] px-6 py-4 transition-colors hover:bg-[#FBF7F0] last:border-none ${muted ? 'opacity-45' : ''}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${cfg.iconBg}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`truncate font-semibold ${muted ? 'text-sm text-[#8B7355]' : 'text-sm text-[#2C1A0E]'}`}>
          {getDeliveryTypeLabel(item)} • {item.qty} {item.product}
        </p>
        <p className="mt-0.5 text-xs text-[#A88763]">
          <span>{cfg.sub(item)}</span>
          {hasIssue && <Divider />}
          {hasIssue && (
            <span className="font-medium text-rose-700">
              Reported Issue: {item.customerIssue}
            </span>
          )}
          {hasIssue && issueStatus === 'OPEN' && (
            <>
              <Divider />
              <span className="font-medium text-amber-700">Pending resolution</span>
            </>
          )}
          {hasAdminAction && (
            <>
              <Divider />
              <span className="font-medium text-emerald-700">
                Action Taken: {item.issueAdminAction}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="mb-1 text-xs text-[#C4A882]">{item.date}</p>
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
  ].filter(Boolean).join(' Â· ');

  return (
    <button onClick={onExpand} className="w-full flex items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-[#FBF7F0]">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {delivered > 0 && <span className="h-2 w-2 rounded-full bg-[#4A7C2F]" />}
          {skipped   > 0 && <span className="h-2 w-2 rounded-full bg-[#C0392B]" />}
          {pending   > 0 && <span className="h-2 w-2 rounded-full bg-[#B8641A]" />}
        </div>
        <span className="text-xs text-[#8B7355]">{parts}</span>
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold text-[#C4A882]">
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
    <div className="mb-5 overflow-hidden rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF7]">
      <div className="flex items-center justify-between border-b border-[#F2EDE4] px-6 py-3.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">{label}</span>
        <span className="text-[10px] text-[#C4A882]">{items.length} deliveries</span>
      </div>
      {isFirst ? (
        <>
          {items.slice(0, showMore ? items.length : PREVIEW).map((item, i) => (
            <DeliveryRow key={item.id ?? i} item={item} muted={showMore && i >= PREVIEW} />
          ))}
          {items.length > PREVIEW && (
            <button
              onClick={() => setShowMore((p) => !p)}
              className="w-full flex items-center justify-between border-t border-[#F2EDE4] px-6 py-3.5 transition-colors hover:bg-[#FBF7F0]"
            >
              <span className="text-xs text-[#8B7355]">
                {showMore ? 'Hide extra rows' : `${items.length - PREVIEW} more deliveries`}
              </span>
              {showMore
                ? <ChevronUp size={14} className="text-[#C4A882]" />
                : <ChevronDown size={14} className="text-[#C4A882]" />}
            </button>
          )}
        </>
      ) : isExpanded ? (
        <>
          {items.map((item, i) => <DeliveryRow key={item.id ?? i} item={item} muted />)}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-between border-t border-[#F2EDE4] px-6 py-3.5 transition-colors hover:bg-[#FBF7F0]"
          >
            <span className="text-xs text-[#8B7355]">Collapse</span>
            <ChevronUp size={14} className="text-[#C4A882]" />
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
  const cachedDeliveries = getCachedCustomerDeliveries();
  const initialDeliveryState = toDeliveryViewState(cachedDeliveries);
  const [deliveries, setDeliveries] = useState(initialDeliveryState.deliveries);
  const [todayDelivery, setToday] = useState(initialDeliveryState.todayDelivery);
  const [insights, setInsights] = useState(initialDeliveryState.insights);
  const [loading, setLoading] = useState(() => !cachedDeliveries);
  const [error,   setError]   = useState(null);
  const [view,    setView]    = useState('week');

  const applyDeliveryState = (data) => {
    const nextState = toDeliveryViewState(data);
    setDeliveries(nextState.deliveries);
    setToday(nextState.todayDelivery);
    setInsights(nextState.insights);
  };

  const load = async ({ force = false, showSpinner = force || !getCachedCustomerDeliveries() } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchCustomerDeliveries({ force });
      applyDeliveryState(data);
    } catch (err) {
      setError(err?.message || 'Could not load deliveries.');
      const hasVisibleDeliveryState = deliveries.length > 0 || Boolean(todayDelivery);

      if (!hasVisibleDeliveryState) {
        setDeliveries([]);
        setToday(null);
        setInsights(EMPTY_INSIGHTS);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const groups = useMemo(() => buildGroups(deliveries, view), [deliveries, view]);

  const todayStatus      = String(todayDelivery?.status || 'PENDING').toUpperCase();
  const todayCfg         = getCfg(todayStatus);
  const canTrack         = !!todayDelivery?.canTrackAgent;
  const todayHasIssue    = Boolean(String(todayDelivery?.customerIssue || '').trim());
  const todayIssueStatus = String(todayDelivery?.issueStatus || '').toUpperCase();
  const todayHasAdminAction = Boolean(String(todayDelivery?.issueAdminAction || '').trim());
  const todayTimingLabel =
    todayStatus === 'DELIVERED'
      ? todayDelivery?.time ? `Delivered at ${todayDelivery.time}` : 'Delivered'
      : todayDelivery?.slotWindow  ? `Expected ${todayDelivery.slotWindow}`
      : todayDelivery?.slot && todayDelivery.slot !== '-' ? `${todayDelivery.slot} slot`
      : 'Expected today';
  const todayMetaParts = [
    <span key="today-meta">{todayTimingLabel}</span>,
    <span key="today-type">{getDeliveryTypeLabel(todayDelivery)}</span>,
    todayDelivery?.dairyName ? <span key="today-dairy">{todayDelivery.dairyName}</span> : null,
    todayHasIssue ? (
      <span key="today-issue" className="font-medium text-rose-700">
        Reported Issue: {todayDelivery.customerIssue}
      </span>
    ) : null,
    todayHasIssue && todayIssueStatus === 'OPEN' ? (
      <span key="today-status" className="font-medium text-amber-700">
        Status: Pending resolution
      </span>
    ) : null,
    todayHasAdminAction ? (
      <span key="today-action" className="font-medium text-emerald-700">
        Action Taken: {todayDelivery.issueAdminAction}
      </span>
    ) : null,
  ].filter(Boolean);

  const insightCards = [
    { label: insights.monthLabel ? `${insights.monthLabel} Deliveries` : 'Monthly', value: insights.monthlyDeliveryCount, color: 'text-[#4A7C2F]', iconBg: 'bg-[#EEF5E7] text-[#4A7C2F]', Icon: CalendarCheck2 },
    { label: 'Skipped Days',  value: insights.skippedDays,  color: 'text-[#C0392B]',  iconBg: 'bg-[#FDECEA] text-[#C0392B]',   Icon: CalendarX2 },
    { label: 'Extra Orders',  value: insights.extraOrders,  color: 'text-[#B8641A]', iconBg: 'bg-[#FFF1E4] text-[#B8641A]', Icon: CirclePlus },
  ];

  return (
    <CustomerLayout>
      {/*
        Single-column, full-width â€” matches the rest of the dashboard layout.
        No max-w constraint; CustomerLayout's own padding/max-w handles the outer bounds.
      */}
      <div className="space-y-8 lg:space-y-10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Header ── */}
        <div className="rounded-[30px] border border-[#EDE8DF] bg-[#F5F0E8] p-5 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:p-7 xl:p-9">
          <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
              Delivery Overview
            </p>
            <h1 className="mt-2 text-[32px] font-semibold text-[#2C1A0E] sm:text-[36px]" style={headingFont}>
              Delivery <span className="text-[#B8641A]">History</span>
            </h1>
            <p className="mt-2 text-sm text-[#8B7355]">
              Review completed drops, skipped days, and today&apos;s delivery status.
            </p>
          </div>
          <button
            onClick={() => load({ force: true })}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-[12px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 py-2 text-xs font-semibold text-[#6B5B3E] transition hover:border-[#D97706] hover:text-[#B45309] disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? 'Refreshingâ€¦' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3.5 text-sm text-[#C0392B]">
            {error}
          </div>
        )}

        {/* â”€â”€ Stat cards â€” always 3 columns â”€â”€ */}
        {!loading && (
          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            {insightCards.map((card) => {
              const InsightIcon = card.Icon;

              return (
                <div
                  key={card.label}
                  className="flex items-end justify-between rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7] p-5 transition-transform hover:-translate-y-0.5"
                >
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">{card.label}</p>
                    <p className={`text-4xl font-extrabold leading-none tracking-tight ${card.color}`}>{card.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${card.iconBg}`}>
                    <InsightIcon size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* â”€â”€ Today card â€” full width banner â”€â”€ */}
        {todayDelivery && (
          <div className="relative mt-8 overflow-hidden rounded-[26px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_62%,#6B4F2A_100%)] p-7 sm:p-8">
            <MapPin className="absolute -right-4 -bottom-4 text-white/10" size={120} />
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F3D4A6]">
              Today's Delivery
            </p>
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="mb-3 text-[28px] font-semibold text-white" style={headingFont}>
                  {todayDelivery.quantity} {todayDelivery.product}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${todayCfg.badge}`}>
                    {todayDelivery.status}
                  </span>
                  {todayDelivery.isOneTimeOrder && (
                    <span className="rounded-full bg-[#F6F0FF] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7C4DAB]">
                      One-time
                    </span>
                  )}
                  {todayDelivery.slot && todayDelivery.slot !== '-' && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/70">
                      {todayDelivery.slot}
                    </span>
                  )}
                  {todayDelivery.paymentMethod && todayDelivery.paymentMethod !== '-' && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/70">
                      {todayDelivery.paymentMethod}
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                  <Clock size={11} className="flex-shrink-0" />
                  {todayMetaParts.map((part, index) => (
                    <React.Fragment key={part.key || index}>
                      {index > 0 && <span className="text-gray-300">|</span>}
                      {part}
                    </React.Fragment>
                  ))}
                </p>
              </div>
              <button
                onClick={() => navigate('/customer/dashboard/track/agent', { state: { delivery: todayDelivery } })}
                disabled={!canTrack}
                className="flex flex-shrink-0 items-center gap-2 rounded-[16px] bg-[#FFF4E2] px-6 py-3.5 text-sm font-bold text-[#B8641A] transition hover:bg-[#FDE9C9] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
              >
                <MapPin size={16} />
                Track Agent
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Recent deliveries â”€â”€ */}
        {loading ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] py-32">
            <Loader2 size={32} className="animate-spin text-[#B8641A]" />
            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Loading…</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-[#E7DAC6] bg-[#FFFDF7] py-20 text-center">
            <p className="text-sm text-[#8B7355]">No delivery records yet.</p>
          </div>
        ) : (
          <>
            {/* Section header + week/month toggle */}
              <div className="mt-8 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Recent Deliveries
                </p>
                <div className="flex gap-1 rounded-[14px] border border-[#EDE8DF] bg-[#FFFDF7] p-1">
                  {['week', 'month'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`rounded-[10px] px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
                        view === v ? 'bg-[#2C2416] text-white' : 'text-[#8B7355] hover:text-[#5C3D1E]'
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
      </div>
    </CustomerLayout>
  );
}


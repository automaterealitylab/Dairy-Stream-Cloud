import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  CalendarX2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import {
  cancelCustomerOneTimeOrder,
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
  FAILED: {
    icon: XCircle,
    iconBg: 'bg-[#FDECEA] text-[#C0392B]',
    badge: 'bg-[#FDECEA] text-[#C0392B]',
    label: 'Failed',
    sub: () => 'Auto-failed after scheduled day',
  },
  CANCELLED: {
    icon: XCircle,
    iconBg: 'bg-[#FCE8E6] text-[#B42318]',
    badge: 'bg-[#FCE8E6] text-[#B42318]',
    label: 'Cancelled',
    sub: () => 'Order cancelled by you',
  },
  PENDING: {
    icon: Clock,
    iconBg: 'bg-[#FFF1E4] text-[#B8641A]',
    badge: 'bg-[#FFF1E4] text-[#B8641A]',
    label: 'Pending',
    sub: (item) =>
      String(item?.deliveryType || '').toUpperCase() === 'SUBSCRIPTION'
        ? 'Scheduled for delivery'
        : 'Awaiting delivery',
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
    if (diff < 7) return { key: 'w0', label: 'This week' };
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
  deliveries.forEach((delivery) => {
    const bucket = view === 'week' ? getWeekBucket(delivery.date) : getMonthBucket(delivery.date);
    if (!map.has(bucket.key)) {
      map.set(bucket.key, { label: bucket.label, items: [] });
    }
    map.get(bucket.key).items.push(delivery);
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

function canCancelPendingOneTimeOrder(delivery = {}) {
  return (
    Boolean(delivery?.id) &&
    Boolean(delivery?.isOneTimeOrder) &&
    String(delivery?.status || '').toUpperCase() === 'PENDING_APPROVAL'
  );
}

function DeliveryRow({ item, muted = false, onCancel, isCancelling = false }) {
  const cfg = getCfg(item.status);
  const Icon = cfg.icon;
  const hasIssue = Boolean(String(item?.customerIssue || '').trim());
  const hasAdminAction = Boolean(String(item?.issueAdminAction || '').trim());
  const canCancel = canCancelPendingOneTimeOrder(item);

  return (
    <div
      className={`border-b border-[#F2EDE4] px-4 py-3 transition-colors hover:bg-[#FBF7F0] last:border-none sm:px-6 sm:py-3.5 ${
        muted ? 'opacity-60' : ''
      }`}
    >
      <div className="grid grid-cols-[auto_1fr] gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] sm:h-10 sm:w-10 sm:rounded-[12px] ${cfg.iconBg}`}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <p className={`truncate font-semibold ${muted ? 'text-sm text-[#8B7355]' : 'text-sm text-[#2C1A0E]'}`}>
            {getDeliveryTypeLabel(item)} • {item.qty} {item.product}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[#A88763]">
            <span>{cfg.sub(item)}</span>
            {hasIssue && <span className="mx-1 text-[#D8C8B2]">|</span>}
            {hasIssue && (
              <span className="font-medium text-[#C0392B]">
                Reported Issue: {item.customerIssue}
              </span>
            )}
            {hasAdminAction && <span className="mx-1 text-[#D8C8B2]">|</span>}
            {hasAdminAction && (
              <span className="font-medium text-[#4A7C2F]">
                Resolution: {item.issueAdminAction}
              </span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
            <span className="text-[11px] text-[#C4A882]">{item.date}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
              {cfg.label}
            </span>
            {canCancel && (
              <button
                onClick={() => onCancel?.(item)}
                disabled={isCancelling}
                className="rounded-full border border-[#F2D0C8] bg-[#FDECEA] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C0392B] transition hover:bg-[#F8DDD6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>

        <div className="hidden flex-shrink-0 sm:block sm:text-right">
          <p className="mb-1 text-xs text-[#C4A882]">{item.date}</p>
          <div className="flex items-center justify-end gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
              {cfg.label}
            </span>
            {canCancel && (
              <button
                onClick={() => onCancel?.(item)}
                disabled={isCancelling}
                className="rounded-full border border-[#F2D0C8] bg-[#FDECEA] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C0392B] transition hover:bg-[#F8DDD6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function CollapsedSummary({ items, onExpand }) {
  const delivered = items.filter((item) => String(item.status).toUpperCase() === 'DELIVERED').length;
  const skipped = items.filter((item) => String(item.status).toUpperCase() === 'SKIPPED').length;
  const failed = items.filter((item) => String(item.status).toUpperCase() === 'FAILED').length;
  const cancelled = items.filter((item) => String(item.status).toUpperCase() === 'CANCELLED').length;
  const pending = items.filter((item) =>
    ['PENDING', 'PENDING_APPROVAL'].includes(String(item.status).toUpperCase())
  ).length;

  const parts = [
    delivered ? `${delivered} delivered` : '',
    skipped ? `${skipped} skipped` : '',
    failed ? `${failed} failed` : '',
    cancelled ? `${cancelled} cancelled` : '',
    pending ? `${pending} pending` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <button
      onClick={onExpand}
      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-[#FBF7F0] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5"
    >
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {delivered > 0 && <span className="h-2 w-2 rounded-full bg-[#4A7C2F]" />}
          {skipped > 0 && <span className="h-2 w-2 rounded-full bg-[#C0392B]" />}
          {failed > 0 && <span className="h-2 w-2 rounded-full bg-[#B42318]" />}
          {pending > 0 && <span className="h-2 w-2 rounded-full bg-[#B8641A]" />}
        </div>
        <span className="text-xs text-[#8B7355]">{parts}</span>
      </div>

      <span className="flex items-center gap-1 text-xs font-semibold text-[#C4A882]">
        Show all <ChevronDown size={13} />
      </span>
    </button>
  );
}

function GroupBlock({ group, isFirst, onCancel, cancellingOrderId }) {
  const [showMore, setShowMore] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { label, items } = group;

  return (
    <div className="mb-4 overflow-hidden rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7]">
      <div className="flex flex-col gap-1 border-b border-[#F2EDE4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
          {label}
        </span>
        <span className="text-[10px] text-[#C4A882]">{items.length} deliveries</span>
      </div>

      {isFirst ? (
        <>
          {items.slice(0, showMore ? items.length : PREVIEW).map((item, index) => (
            <DeliveryRow
              key={item.id ?? index}
              item={item}
              muted={showMore && index >= PREVIEW}
              onCancel={onCancel}
              isCancelling={String(cancellingOrderId) === String(item.id)}
            />
          ))}

          {items.length > PREVIEW && (
            <button
              onClick={() => setShowMore((prev) => !prev)}
              className="flex w-full items-center justify-between border-t border-[#F2EDE4] px-4 py-3 transition-colors hover:bg-[#FBF7F0] sm:px-6 sm:py-3.5"
            >
              <span className="text-xs text-[#8B7355]">
                {showMore ? 'Hide extra rows' : `${items.length - PREVIEW} more deliveries`}
              </span>
              {showMore ? (
                <ChevronUp size={14} className="text-[#C4A882]" />
              ) : (
                <ChevronDown size={14} className="text-[#C4A882]" />
              )}
            </button>
          )}
        </>
      ) : isExpanded ? (
        <>
          {items.map((item, index) => (
            <DeliveryRow
              key={item.id ?? index}
              item={item}
              muted
              onCancel={onCancel}
              isCancelling={String(cancellingOrderId) === String(item.id)}
            />
          ))}

          <button
            onClick={() => setIsExpanded(false)}
            className="flex w-full items-center justify-between border-t border-[#F2EDE4] px-4 py-3 transition-colors hover:bg-[#FBF7F0] sm:px-6 sm:py-3.5"
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
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [view, setView] = useState('week');

  const applyDeliveryState = (data) => {
    const nextState = toDeliveryViewState(data);
    setDeliveries(nextState.deliveries);
    setToday(nextState.todayDelivery);
    setInsights(nextState.insights);
  };

  const load = async ({
    force = false,
    showSpinner = force || !getCachedCustomerDeliveries(),
  } = {}) => {
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

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => buildGroups(deliveries, view), [deliveries, view]);

  const todayStatus = String(todayDelivery?.status || 'PENDING').toUpperCase();
  const todayCfg = getCfg(todayStatus);
  const canTrack = !!todayDelivery?.canTrackAgent;
  const todayHasIssue = Boolean(String(todayDelivery?.customerIssue || '').trim());
  const todayIssueStatus = String(todayDelivery?.issueStatus || '').toUpperCase();
  const todayHasAdminAction = Boolean(String(todayDelivery?.issueAdminAction || '').trim());
  const canCancelTodayOrder = canCancelPendingOneTimeOrder(todayDelivery);
  const todayTimingLabel =
    todayStatus === 'DELIVERED'
      ? todayDelivery?.time
        ? `Delivered at ${todayDelivery.time}`
        : 'Delivered'
      : todayDelivery?.slotWindow
      ? `Expected ${todayDelivery.slotWindow}`
      : todayDelivery?.slot && todayDelivery.slot !== '-'
      ? `${todayDelivery.slot} slot`
      : 'Expected today';

  const todayMetaParts = [
    { label: todayTimingLabel },
    { label: getDeliveryTypeLabel(todayDelivery) },
    todayDelivery?.dairyName ? { label: todayDelivery.dairyName } : null,
    todayHasIssue
      ? { label: `Reported Issue: ${todayDelivery.customerIssue}`, className: 'bg-[#FDECEA] text-[#C0392B]' }
      : null,
    todayHasIssue && todayIssueStatus === 'OPEN'
      ? { label: 'Pending resolution', className: 'bg-[#FFF1E4] text-[#B8641A]' }
      : null,
    todayHasAdminAction
      ? { label: `Resolution: ${todayDelivery.issueAdminAction}`, className: 'bg-[#EEF5E7] text-[#4A7C2F]' }
      : null,
  ].filter(Boolean);

  const insightCards = [
    {
      label: insights.monthLabel ? `${insights.monthLabel} Deliveries` : 'Monthly',
      value: insights.monthlyDeliveryCount,
      color: 'text-[#4A7C2F]',
      iconBg: 'bg-[#EEF5E7] text-[#4A7C2F]',
      Icon: CalendarCheck2,
    },
    {
      label: 'Skipped Days',
      value: insights.skippedDays,
      color: 'text-[#C0392B]',
      iconBg: 'bg-[#FDECEA] text-[#C0392B]',
      Icon: CalendarX2,
    },
    {
      label: 'Extra Orders',
      value: insights.extraOrders,
      color: 'text-[#B8641A]',
      iconBg: 'bg-[#FFF1E4] text-[#B8641A]',
      Icon: CirclePlus,
    },
  ];

  const openCancelModal = (delivery) => {
    setNotice(null);
    setCancelTarget(delivery || null);
  };

  const closeCancelModal = () => {
    if (cancellingOrderId) return;
    setCancelTarget(null);
  };

  const confirmCancelOrder = async () => {
    const target = cancelTarget;
    if (!target?.id) return;

    setCancellingOrderId(String(target.id));
    setNotice(null);

    try {
      const response = await cancelCustomerOneTimeOrder({ orderId: target.id });
      setCancelTarget(null);
      setNotice({
        type: 'success',
        message:
          response?.message ||
          'Order cancelled successfully.',
      });
      await load({ force: true, showSpinner: false });
    } catch (err) {
      setNotice({
        type: 'error',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Failed to cancel this order.',
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="rounded-[24px] border border-[#EDE8DF] bg-[linear-gradient(180deg,#F7F1E8_0%,#FDF9F3_100%)] p-4 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:rounded-[30px] sm:p-7 xl:p-9">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">
                Delivery Overview
              </p>
              <h1
                className="mt-2 text-[28px] font-semibold leading-tight text-[#2C1A0E] sm:text-[36px]"
                style={headingFont}
              >
                Delivery <span className="text-[#B8641A]">History</span>
              </h1>
              <p className="mt-2 text-sm text-[#8B7355]">
                Review completed drops, skipped days, and today&apos;s delivery status.
              </p>
            </div>

            <button
              onClick={() => load({ force: true })}
              disabled={loading}
              className="inline-flex items-center gap-2 self-start rounded-[12px] border border-[#EDE8DF] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B5B3E] transition hover:border-[#D97706] hover:text-[#B45309] disabled:opacity-40"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3.5 text-sm text-[#C0392B]">
              {error}
            </div>
          )}

          {notice && (
            <div
              className={`mt-5 rounded-[16px] px-4 py-3.5 text-sm ${
                notice.type === 'success'
                  ? 'border border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]'
                  : 'border border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]'
              }`}
            >
              {notice.message}
            </div>
          )}

          {!loading && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4">
              {insightCards.map((card) => {
                const InsightIcon = card.Icon;

                return (
                  <div
                    key={card.label}
                    className="relative flex flex-col overflow-hidden rounded-[18px] border border-[#EDE8DF] bg-white p-3 transition-transform hover:-translate-y-0.5 sm:rounded-[20px] sm:p-4"
                  >
                    <div className="pr-9 sm:pr-10">
                      <div>
                        <p className="mb-1 max-w-[72px] text-[8px] font-bold uppercase leading-3.5 tracking-[0.14em] text-[#C4A882] sm:max-w-none sm:text-[10px] sm:leading-4 sm:tracking-[0.18em]">
                          {card.label}
                        </p>
                        <p className={`text-[25px] font-extrabold leading-none tracking-tight sm:text-4xl ${card.color}`}>
                          {card.value}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[10px] sm:right-5 sm:top-5 sm:h-10 sm:w-10 sm:rounded-[12px] ${card.iconBg}`}
                    >
                      <InsightIcon size={14} className="sm:h-4 sm:w-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {todayDelivery && (
          <div className="relative overflow-hidden rounded-[22px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_62%,#6B4F2A_100%)] p-4 sm:rounded-[26px] sm:p-8">
            <MapPin className="pointer-events-none absolute bottom-3 right-3 h-20 w-20 text-white/10 sm:bottom-0 sm:right-0 sm:h-[120px] sm:w-[120px]" />

            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">
              Today&apos;s Delivery
            </p>

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="mb-3 text-[20px] font-semibold leading-tight text-white sm:text-[28px]" style={headingFont}>
                  {todayDelivery.quantity} {todayDelivery.product}
                </h3>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${todayCfg.badge}`}>
                    {todayCfg.label}
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

                  {canCancelTodayOrder && (
                    <button
                      onClick={() => openCancelModal(todayDelivery)}
                      disabled={String(cancellingOrderId) === String(todayDelivery?.id)}
                      className="rounded-full border border-[#F2D0C8] bg-[#FDECEA] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C0392B] transition hover:bg-[#F8DDD6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {String(cancellingOrderId) === String(todayDelivery?.id)
                        ? 'Cancelling...'
                        : 'Cancel Order'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {todayMetaParts.map((part, index) => (
                    <span
                      key={`${part.label}-${index}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                        part.className || 'bg-white/10 text-white/80'
                      }`}
                    >
                      {index === 0 && <Clock size={11} className="flex-shrink-0" />}
                      {part.label}
                    </span>
                  ))}
                </div>

              </div>

              <div className="flex w-full flex-shrink-0 flex-col gap-2 sm:w-auto">
                <button
                  onClick={() =>
                    navigate('/customer/dashboard/track/agent', { state: { delivery: todayDelivery } })
                  }
                  disabled={!canTrack}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#FFF4E2] px-5 py-3 text-sm font-bold text-[#B8641A] transition hover:bg-[#FDE9C9] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 sm:w-auto"
                >
                  <MapPin size={16} />
                  Track Agent
                </button>

              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF7] py-24 sm:rounded-[24px] sm:py-32">
            <Loader2 size={32} className="animate-spin text-[#B8641A]" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-300">Loading...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[#E7DAC6] bg-[#FFFDF7] py-16 text-center sm:rounded-[24px] sm:py-20">
            <p className="text-sm text-[#8B7355]">No delivery records yet.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Recent Deliveries
              </p>

              <div className="flex w-full gap-1 rounded-[14px] border border-[#EDE8DF] bg-[#FFFDF7] p-1 sm:w-auto">
                {['week', 'month'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setView(value)}
                    className={`flex-1 rounded-[10px] px-4 py-1.5 text-xs font-semibold capitalize transition-all sm:flex-none ${
                      view === value
                        ? 'bg-[#2C2416] text-white'
                        : 'text-[#8B7355] hover:text-[#5C3D1E]'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {groups.map((group, index) => (
                <GroupBlock
                  key={group.label}
                  group={group}
                  isFirst={index === 0}
                  onCancel={openCancelModal}
                  cancellingOrderId={cancellingOrderId}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {cancelTarget && (
        <CancelOrderModal
          delivery={cancelTarget}
          cancelling={String(cancellingOrderId) === String(cancelTarget?.id)}
          onClose={closeCancelModal}
          onConfirm={confirmCancelOrder}
        />
      )}
    </CustomerLayout>
  );
}

function CancelOrderModal({ delivery, cancelling = false, onClose, onConfirm }) {
  const deliveryDate = delivery?.deliveryDate
    ? new Date(`${delivery.deliveryDate}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : delivery?.date || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C1A0E]/45 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.28)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
          Cancel One-time Order
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
          Cancel this approval-pending order?
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#8B7355]">
          {delivery?.qty || '-'} {delivery?.product || 'Milk'} for {deliveryDate} will be removed from your deliveries.
          If this order was already paid, the amount will be added back to your wallet.
        </p>

        <div className="mt-5 rounded-[18px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm text-[#5C3D1E]">
          <p className="font-semibold">{getDeliveryTypeLabel(delivery)} order</p>
          <p className="mt-1 text-xs text-[#8B7355]">
            Status: Approval pending
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            disabled={cancelling}
            className="rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="rounded-[14px] bg-[#C0392B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#A93226] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
          >
            {cancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

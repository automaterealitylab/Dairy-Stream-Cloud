# Agent Dashboard Remaining Tasks

## Intern Handoff Brief

### Objective
This document summarizes the remaining work for the agent side of the Dairy Stream project. The goal is to improve the agent dashboard so it is more reliable for daily delivery operations and easier for agents to use in real-world conditions.

The original pending note mentioned three main items:

1. Offline action sync
2. Dashboard should show only today's deliveries
3. Delivery sorting should follow real address hierarchy

Additional workflow requirements now added:

4. Agent should have `Out for Delivery` and `End of All Deliveries` actions
5. Agent should be able to bulk-complete deliveries for a specific building
6. Bulk completion must not incorrectly update undelivered orders

This brief keeps the original items, adds these workflow requirements, includes implementation details based on the current codebase, and lists the files that should be reviewed before starting development.

---

## Current Project Status

The agent side already has these pages/components:

- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/pages/agent/AgentHistory.jsx`
- `Frontend/src/components/agent/DeliveryCard.jsx`
- `Frontend/src/components/agent/AgentLayout.jsx`
- `Frontend/src/components/common/ConnectivityIndicator.jsx`

Relevant API and utility files:

- `Frontend/src/api/agent/agent.api.js`
- `Frontend/src/utils/routeOptimization.js`
- `Frontend/src/utils/offlineSyncManager.js`
- `Frontend/src/offline/deliveryQueue.js`
- `Frontend/src/offline/syncManager.js`
- `Backend/controllers/agent/delivery.controller.js`
- `Backend/services/agent/delivery.service.js`

Important notes from the current implementation:

- The dashboard currently fetches assigned deliveries directly and calculates stats on the frontend.
- The backend already supports `GET /agent/deliveries/assigned?today=true`.
- The backend also already has a dedicated dashboard service that returns today's stats and deliveries.
- A connectivity indicator is already visible in the agent layout.
- Offline sync utilities exist, but they are incomplete and not fully wired into the agent workflow.
- Current route sorting is still based on parsing the display address string, which is not reliable enough for production use.
- There is already a backend `startDelivery` flow for per-delivery location/ETA updates, but there is no proper dashboard-level daily workflow for starting the route and ending the day.
- There is already a bulk action for `Complete All Subscription`, but it is not building-specific and is too limited for a real delivery workflow.

---

## Priority 1: Offline Action Sync

### Problem
If an agent marks a delivery as `COMPLETED` or `FAILED` while offline, the action is not reliably synced once internet returns. This creates a risk of missing updates, duplicate actions, and confusion on the dashboard.

### Current Status

- `Frontend/src/utils/offlineSyncManager.js` contains a basic localStorage-based queue, but the actual sync methods are placeholders.
- `Frontend/src/offline/deliveryQueue.js` uses IndexedDB, which is better for queued offline data.
- `Frontend/src/offline/syncManager.js` also exists, but it is a separate unfinished flow.
- The agent pages currently call `updateAssignedAgentDeliveryStatus(...)` directly, so the offline helper is not the main path yet.

### Recommended Implementation

Use a single offline queue system instead of keeping multiple partial approaches.

Recommended direction:

- Keep one source of truth for queued actions.
- Prefer IndexedDB for queued agent actions, especially if proof images are stored.
- Use localStorage only for lightweight UI counters or sync summary if needed.

Suggested queue item shape:

- `actionId`
- `deliveryId`
- `status`
- `reason`
- `proofType`
- `proofOtp`
- `proofImage`
- `collectionMethod`
- `createdAt`
- `retryCount`
- `syncState` (`pending`, `syncing`, `failed`)

Suggested workflow:

1. Agent updates delivery while online:
   - call API immediately
   - update local UI after success or use optimistic update with rollback handling

2. Agent updates delivery while offline:
   - save action in offline queue
   - update local dashboard state immediately so the agent can continue working
   - mark item visually as `Pending Sync`

3. When internet returns:
   - listen to the `online` event
   - start queue sync automatically
   - send queued actions one by one
   - remove only the successfully synced items
   - keep failed items with retry state

4. Manual recovery:
   - allow a retry button for failed syncs
   - show pending/failed sync count in the header or dashboard

### UI Improvements Recommended For Dashboard

- Show a `Pending Sync` badge for locally saved offline updates.
- Show `Syncing...` state when the queue is being processed.
- Show `Retry Failed Sync` action if any sync requests fail.
- Add a small `Last synced at` label in the dashboard header.

### Files To Update

Frontend:

- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/components/common/ConnectivityIndicator.jsx`
- `Frontend/src/utils/offlineSyncManager.js`
- `Frontend/src/offline/deliveryQueue.js`
- `Frontend/src/offline/syncManager.js`
- `Frontend/src/api/agent/agent.api.js`

Backend:

- `Backend/controllers/agent/delivery.controller.js`
- `Backend/services/agent/delivery.service.js`

Backend changes may be minimal if the existing status update endpoint remains unchanged. The main work is on the frontend sync flow.

### Acceptance Criteria

- If the agent marks a delivery `COMPLETED` or `FAILED` while offline, the action is stored locally.
- The dashboard updates immediately even when offline.
- When connectivity returns, queued actions sync automatically.
- Successfully synced items are removed from the local queue.
- Failed sync items remain visible with retry state.
- No duplicate status updates are sent for the same queued action.
- The agent can clearly understand whether an action is synced or pending.

### Edge Cases To Handle

- Same delivery updated multiple times before internet returns
- App refresh while queued actions still exist
- API failure after reconnect
- Image proof storage size limits
- Duplicate sync attempts after page reload

---

## Priority 2: Dashboard Should Show Only Today's Deliveries

### Problem
The dashboard should be focused on the current working day. Older deliveries should not appear in the main dashboard because they belong in the history screen.

### Current Status

- `fetchAssignedAgentDeliveries` already supports `{ today: true }` in `Frontend/src/api/agent/agent.api.js`.
- Backend controller `fetchAssignedDeliveries` already supports `req.query.today`.
- `getAgentDashboard(...)` in the backend already returns only today's deliveries and stats.
- The current dashboard page still loads assigned deliveries without passing `today: true`.

### Recommended Implementation

Recommended approach for `agentDashboard.jsx`:

- Use the dedicated dashboard endpoint if possible:
  - `fetchAgentDashboard()`
- This reduces duplicated stat calculation logic in the frontend.

Recommended approach for `AgentWorkingPage.jsx`:

- If the working page is meant for current-day operations, also fetch with `{ today: true }`.
- If product wants all assigned deliveries on the working page, keep that page separate from the dashboard behavior.

### Functional Expectations

- Dashboard shows only today's assigned deliveries.
- Dashboard stats are calculated only from today's deliveries.
- Older deliveries remain available in history.
- The dashboard and history screens should not overlap in purpose.

### Files To Update

Frontend:

- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/api/agent/agent.api.js`

Backend:

- likely no major change needed because support already exists

### Acceptance Criteria

- Dashboard fetch uses only today's deliveries.
- Only current-date deliveries appear on the dashboard.
- Dashboard stats match only today's workload.
- Historical deliveries stay in `AgentHistory.jsx`.
- No regression in the existing history screen.

### Extra Recommendation

Add a small label in the dashboard header:

- `Showing today's deliveries only`

This avoids confusion for the agent.

---

## Priority 3: Delivery Sorting Should Follow Real Address Hierarchy

### Problem
The current route sorting logic is based on splitting the display address string by commas. This is fragile and does not reflect a true operational route hierarchy.

### Current Status

- `Frontend/src/utils/routeOptimization.js` currently extracts building info from the address string.
- Backend delivery mapping currently returns:
  - `address`
  - `customerName`
  - `quantity`
  - `status`
  - other delivery fields
- The customer lookup in the backend already reads:
  - `building_name`
  - `wing`
  - `room_no`

### Important Technical Observation

The current payload does not clearly expose structured fields like:

- `area`
- `buildingName`
- `wing`
- `floor`

So the full sort order requested in the original note cannot be implemented cleanly on the frontend until structured fields are passed through the API.

### Recommended Implementation

Step 1: Extend backend delivery mapping to expose structured address fields:

- `buildingName`
- `wing`
- `roomNo`
- `area` only if the data is actually available
- `floor` only if there is a reliable source or agreed derivation rule

Step 2: Replace string-based route logic with a structured comparator.

Suggested sort priority:

1. delivery status priority
   - `PENDING`
   - `COMPLETED`
   - `FAILED`
2. area
3. building name
4. wing
5. floor
6. room/flat number

### Practical Recommendation For Current Schema

Based on the current codebase, the reliable sortable fields already available are:

- `building_name`
- `wing`
- `room_no`

There is no confirmed dedicated `area` field in the current customer schema, and `floor` may need to be derived from `room_no`, which is risky unless the numbering format is standardized.

So the safest first implementation is:

1. `PENDING` before `COMPLETED` before `FAILED`
2. `buildingName`
3. `wing`
4. `roomNo`

Then later extend to `area` and `floor` if the backend schema is updated.

### Files To Update

Frontend:

- `Frontend/src/utils/routeOptimization.js`
- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/components/agent/DeliveryCard.jsx`

Backend:

- `Backend/services/agent/delivery.service.js`

### Acceptance Criteria

- Deliveries are no longer sorted using raw address comma parsing as the primary logic.
- Sorting uses structured fields wherever available.
- Pending deliveries still stay above completed/failed deliveries.
- Missing fields do not break sorting.
- UI still shows route grouping information clearly.

### UI Improvements Recommended For Dashboard

- Show route metadata in the card:
  - building
  - wing
  - room/flat
- Replace vague `Route Group` text with a more meaningful route label if structured fields are added.

---

## Priority 4: Agent Day Workflow Controls

### Problem
The agent dashboard should support the actual daily work cycle, not just individual delivery status updates. The agent should be able to mark when the route has started and when the day's work has ended.

The requested workflow is:

- `Out for Delivery`
- `End of All Deliveries`

### Why This Matters

- It gives a clear operational start point for the agent's workday.
- It helps admin understand whether the agent has started today's route.
- It can support future tracking, ETA, attendance, and daily performance reporting.
- It prevents the dashboard from feeling like a loose list of deliveries without route state.

### Current Status

- There is a per-delivery `startDelivery` backend flow tied to location tracking and ETA updates.
- There is no dashboard-level "start day" or "end day" state.
- There is no visible route session status in the agent dashboard.
- There is no clear audit trail for when the agent started or finished today's work.

### Recommended Implementation

Introduce a daily route state for the agent.

Suggested route states:

- `NOT_STARTED`
- `OUT_FOR_DELIVERY`
- `ENDED`

Suggested behavior:

1. `Out for Delivery`
   - available when the agent has today's deliveries
   - marks the agent's daily route as started
   - stores `startedAt`
   - can enable location tracking or make it available from the dashboard
   - can optionally notify admin that the agent has started the route

2. `End of All Deliveries`
   - should not be a blind action
   - before ending, system should check how many deliveries are still unresolved
   - if unresolved deliveries remain, show a confirmation modal with counts:
     - pending
     - failed
     - completed
   - if business wants strict closure, disable ending until no pending deliveries remain
   - if business wants flexible closure, allow ending with confirmation and store a summary
   - stores `endedAt`

### Strong Recommendation

`End of All Deliveries` should not auto-complete pending orders.

It should only end the route/session for the day. Any still-pending deliveries should remain pending or require explicit resolution. This avoids bad data and protects billing, proof collection, and customer trust.

### UI Recommendations

In dashboard header, add:

- `Out for Delivery` primary button before route starts
- `End of All Deliveries` button after route has started
- route status badge:
  - `Not Started`
  - `Out for Delivery`
  - `Day Ended`
- optional labels:
  - `Started at`
  - `Ended at`
  - `Pending deliveries remaining`

### Backend Recommendation

Best long-term option:

- create a route session or daily work table such as `agent_daily_sessions`

Suggested fields:

- `id`
- `agent_id`
- `date`
- `status`
- `started_at`
- `ended_at`
- `total_assigned`
- `completed_count`
- `failed_count`
- `pending_count`
- `notes`

If schema changes are not possible immediately, a temporary frontend-only state can be used for UI testing, but production behavior should be stored in the backend.

### Files To Update

Frontend:

- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/components/agent/AgentLayout.jsx`
- `Frontend/src/components/agent/AgentLocationTracker.jsx`
- `Frontend/src/api/agent/location.js`
- `Frontend/src/api/agent/agent.api.js`

Backend:

- `Backend/controllers/agent/delivery.controller.js`
- `Backend/controllers/agent/location.controller.js`
- `Backend/services/agent/delivery.service.js`

### Acceptance Criteria

- Agent can mark the day as `Out for Delivery`
- Dashboard shows route/session status clearly
- Agent can mark `End of All Deliveries`
- Ending the day does not auto-complete unresolved deliveries
- If unresolved deliveries remain, system warns the agent before day-end
- Start and end timestamps are stored or at least exposed in the UI flow

---

## Priority 5: Building-Level Bulk Completion With Safety Rules

### Problem
The agent should be able to complete multiple deliveries for a specific building more efficiently, but the system must not incorrectly mark undelivered orders as complete.

This is especially important when:

- multiple deliveries belong to the same building
- some customers received delivery
- some customers did not receive delivery
- some orders need OTP, photo proof, or payment collection

### Current Status

- The dashboard currently has a global `Complete All Subscription` action.
- That action is not grouped by building.
- It is not suitable for mixed cases where one building has both delivered and undelivered orders.
- The current building grouping in UI is also weak because sorting still depends on the address string.

### Recommended Implementation

Do not use a blind `Complete Building` button.

Instead, implement a safer building-level bulk flow.

Recommended UI flow:

1. Group deliveries by building
2. Show a building-level action such as:
   - `Review Building Deliveries`
   - or `Bulk Complete Building`
3. Open a review modal that lists only that building's deliveries
4. Let the agent select which deliveries were actually completed
5. Show which deliveries will be skipped
6. Confirm the bulk action with a summary

### Deliveries That Should Be Eligible For Bulk Completion

- status is currently `PENDING`
- delivery belongs to the selected building
- delivery does not require unresolved payment collection
- delivery does not require missing proof that must be collected per customer

### Deliveries That Should Be Skipped Automatically

- already `COMPLETED`
- already `FAILED`
- marked as customer unavailable or not delivered
- still awaiting OTP
- still awaiting photo proof
- COD delivery where payment is not yet collected
- any delivery manually unchecked by the agent in the bulk modal

### Most Important Rule

If an order was not delivered, bulk mark must not update it.

That means the system should support partial building completion:

- completed customers get updated
- undelivered customers stay `PENDING` or are explicitly marked `FAILED`
- nothing should be auto-completed just because it belongs to the same building

### Strong Recommendation

Bulk completion should be allowed mainly for low-risk delivery types.

Safer default:

- allow building bulk completion for subscription deliveries first
- keep buy-once / COD / proof-heavy flows as per-delivery actions unless product clearly approves bulk logic for them

This reduces the chance of false completion for orders that need proof or payment handling.

### Suggested Bulk Modal Information

For each delivery in the selected building, show:

- customer name
- room/flat
- status
- delivery type
- proof requirement
- payment requirement
- checkbox: `Mark as completed`
- skip reason if not eligible

At the bottom, show:

- total deliveries in building
- selected for completion
- skipped
- not delivered

### Recommended API Behavior

Preferred backend flow:

- send a list of selected delivery IDs for that building
- backend validates each delivery independently
- backend updates only valid deliveries
- backend returns:
  - updated IDs
  - skipped IDs
  - failed validations

This is safer than trusting the frontend alone.

### Files To Update

Frontend:

- `Frontend/src/pages/agent/agentDashboard.jsx`
- `Frontend/src/pages/agent/AgentWorkingPage.jsx`
- `Frontend/src/components/agent/DeliveryCard.jsx`
- `Frontend/src/components/agent/DeliveryDetailsModal.jsx`
- `Frontend/src/components/agent/DeliveryProofModal.jsx`
- `Frontend/src/utils/routeOptimization.js`

Backend:

- `Backend/controllers/agent/delivery.controller.js`
- `Backend/services/agent/delivery.service.js`

### Acceptance Criteria

- Agent can trigger a building-level bulk flow
- Only deliveries from the selected building are considered
- Bulk action supports partial completion
- Undelivered orders are not marked complete
- Orders requiring proof/payment are skipped or handled safely
- Result summary clearly shows updated vs skipped deliveries

---

## Recommended Order Of Work

1. Fix today-only dashboard fetching
2. Refactor route sorting to use structured fields
3. Add building grouping UI
4. Implement building-level bulk completion with safeguards
5. Add `Out for Delivery` and `End of All Deliveries` workflow
6. Complete offline queue and auto-sync flow

Reason:

- Today-only filtering is the smallest and lowest-risk improvement.
- Better sorting and grouping improve daily usability immediately.
- Building bulk completion depends on reliable building grouping.
- Route/day workflow is important, but it should not be implemented as a shortcut that hides unresolved deliveries.
- Offline sync is still critical, but it has the most edge cases and should be done carefully after the main workflow is clear.

---

## Suggested Development Checklist

### Before Coding

- Review current agent dashboard and working page data flow
- Decide whether dashboard should use `fetchAgentDashboard()` directly
- Decide whether the working page should also be limited to today's deliveries
- Confirm if `area` and `floor` exist anywhere in backend data model
- Define whether `Out for Delivery` is only a UI workflow state or a persisted backend route session
- Define which delivery types are safe for building-level bulk completion

### During Implementation

- Avoid creating a third offline sync system
- Reuse and consolidate existing queue utilities
- Keep optimistic UI updates consistent between dashboard and working page
- Make sync status visible to the agent
- Do not let bulk completion bypass proof/payment rules
- Do not let `End of All Deliveries` auto-complete pending orders

### Before Final QA

- Test online status update
- Test offline status update
- Test reconnect auto-sync
- Test duplicate action prevention
- Test page refresh with queued offline actions
- Test dashboard filtering for only today's deliveries
- Test route ordering with missing building/wing/room data
- Test building-level bulk completion with mixed delivered/undelivered customers
- Test COD/proof-required deliveries during bulk flow
- Test day-start and day-end flow with pending deliveries still remaining

---

## Open Questions

These should be clarified before full implementation of sorting:

1. Should `AgentWorkingPage` also show only today's deliveries, or only the dashboard?
2. Is there a real `area` field in the database, or was that requested conceptually?
3. Should `floor` be stored explicitly, or derived from room number?
4. For offline proof images, do we want full image retention offline or only status queueing at first?
5. Should `End of All Deliveries` be blocked if even one delivery is still pending?
6. Should building-level bulk completion be allowed for all delivery types or only subscription deliveries at first?
7. Should `Out for Delivery` also start live location tracking, or just change the dashboard state?

---

## Final Recommendation

If this work is assigned to an intern, the best implementation path is:

1. Complete the today-only dashboard cleanup first
2. Improve sorting using fields already available now
3. Build proper building grouping in the UI
4. Add safe building-level bulk completion
5. Add route start/end workflow
6. Finish offline sync as a separate reliability-focused task

This keeps the work manageable, reduces regression risk, and gives visible dashboard improvement early while the more complex route workflow and offline sync behavior are built carefully.

The most important business rule is:

- bulk actions must help the agent move faster
- bulk actions must never create false delivery completion records

So every bulk feature should be built with review, validation, and skip logic rather than a blind one-click update.

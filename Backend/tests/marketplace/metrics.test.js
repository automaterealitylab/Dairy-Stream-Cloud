import test from "node:test";
import assert from "node:assert/strict";
import { metrics } from "../../utils/metrics.js";

test("exports Prometheus-compatible metric lines", () => {
  metrics.increment("payment_events", { event: "captured" });
  metrics.gauge("queue_jobs", { queue: "webhooks", status: "waiting" }, 2);
  metrics.observe("settlement_latency_ms", { route: "route" }, 125);

  const output = metrics.prometheus();
  assert.match(output, /payment_events_total\{event="captured"\} 1/);
  assert.match(output, /queue_jobs\{queue="webhooks",status="waiting"\} 2/);
  assert.match(output, /settlement_latency_ms_count\{route="route"\} 1/);
});

const baseUrl = process.env.LOAD_TEST_BASE_URL || "http://localhost:4000";
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20);
const requests = Number(process.env.LOAD_TEST_REQUESTS || 200);

const runOne = async (index) => {
  const started = Date.now();
  const response = await fetch(`${baseUrl}/healthz`, {
    headers: { "x-load-test-id": String(index) },
  });
  return { status: response.status, durationMs: Date.now() - started };
};

const results = [];
for (let cursor = 0; cursor < requests; cursor += concurrency) {
  const batch = Array.from({ length: Math.min(concurrency, requests - cursor) }, (_, offset) =>
    runOne(cursor + offset)
  );
  results.push(...(await Promise.all(batch)));
}

const ok = results.filter((item) => item.status < 500).length;
const sorted = results.map((item) => item.durationMs).sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

console.log(JSON.stringify({ requests, ok, failed: requests - ok, p95 }, null, 2));
if (ok !== requests) process.exitCode = 1;

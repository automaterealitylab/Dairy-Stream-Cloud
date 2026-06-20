const counters = new Map();
const gauges = new Map();
const histograms = new Map();

const keyFor = (name, labels = {}) =>
  `${name}:${JSON.stringify(Object.fromEntries(Object.entries(labels).sort()))}`;

const labelText = (labels = {}) => {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return "";
  return `{${entries.map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`).join(",")}}`;
};

export const metrics = {
  increment(name, labels = {}, value = 1) {
    const key = keyFor(name, labels);
    const current = counters.get(key) || { name, labels, value: 0 };
    current.value += value;
    counters.set(key, current);
  },
  gauge(name, labels = {}, value = 0) {
    gauges.set(keyFor(name, labels), { name, labels, value });
  },
  observe(name, labels = {}, value = 0) {
    const key = keyFor(name, labels);
    const current = histograms.get(key) || { name, labels, count: 0, sum: 0, max: 0 };
    current.count += 1;
    current.sum += value;
    current.max = Math.max(current.max, value);
    histograms.set(key, current);
  },
  snapshot() {
    return {
      counters: Array.from(counters.values()),
      gauges: Array.from(gauges.values()),
      histograms: Array.from(histograms.values()),
    };
  },
  prometheus() {
    const lines = [];
    for (const item of counters.values()) lines.push(`${item.name}_total${labelText(item.labels)} ${item.value}`);
    for (const item of gauges.values()) lines.push(`${item.name}${labelText(item.labels)} ${item.value}`);
    for (const item of histograms.values()) {
      lines.push(`${item.name}_count${labelText(item.labels)} ${item.count}`);
      lines.push(`${item.name}_sum${labelText(item.labels)} ${item.sum}`);
      lines.push(`${item.name}_max${labelText(item.labels)} ${item.max}`);
    }
    return `${lines.join("\n")}\n`;
  },
};

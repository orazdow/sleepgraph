import uPlot from './lib/uPlot.esm.js';
import sleepBarPlugin from './plugins.js';
import { generateSleepLog, ingestSleepLogWithFields } from './datautil.js';

const HOUR = 60 * 60 * 1000;
const container = document.getElementById("graph-container");

// Generate 30 days of sample data and ingest selected fields.
const log = generateSleepLog(30, "2025-10-12");
const fieldSwitch = {
  sleep_time: true,
  wake_time: true,
  hypnotic_time: true,
};

const { data: ingested, fields } = ingestSleepLogWithFields(log, fieldSwitch); // [x, ...ys] + ordered field names
const sleepData = normalizeToHours(ingested);      // hours since midnight for y values
const fieldIndexByName = buildFieldIndexMap(fields);

// Build chart options with configurable y-axis label/grid intervals and capped x labels.
const opts = createSleepChartOptions({
  container,
  xValues: sleepData[0],
  fields,
  yLabelInterval: 3, // hours between y-axis labels; set <= 0 to hide labels
  yLineInterval: 1,  // hours between horizontal grid lines; set <= 0 to hide grid
  maxXLabels: 12,    // maximum x labels (further limited by width/spacing)
  yAxisGap: 0,       // px padding between y labels and chart area
  alignBarsToTicks: false, // set true to align bar left edges to x ticks
  barWidthFactor: 0.8,     // 1.0 = full width; lower narrows bars (e.g., 0.8 = -20%)
  barColor: "rgba(0, 128, 255, 0.4)",
  outlineColor: "#004080",
  overlays: [
    {
      fieldName: "sleep_time",
      color: "#5DADE2", // customize overlay color here
      lineWidth: 2,
      spline: true,
      disabled: false,
    },
  ],
  indicators: [
    {
      fieldName: "hypnotic_time",
      color: "#FFC300", // customize indicator color here
      thickness: 2,
      widthFactor: 0.6,
      disabled: false,
    },
  ],
  fieldIndexByName,
});

const plot = new uPlot(opts, sleepData, container);

// Keep the chart sized to its container for responsiveness.
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    plot.setSize({ width, height });
  }
});

resizeObserver.observe(container);

function normalizeToHours(data) {
  const [x, ...ys] = data;
  const yHours = ys.map((arr) =>
    arr.map((val, idx) => (val == null ? null : (val - x[idx]) / HOUR))
  );
  return [x, ...yHours];
}

function buildFieldIndexMap(fields) {
  const map = {};
  fields.forEach((field, idx) => {
    // +1 because data[0] is x; y arrays start at index 1.
    map[field] = idx + 1;
  });
  return map;
}

function createSleepChartOptions({
  container,
  title = "Sleep Blocks",
  width = container?.clientWidth || 800,
  height = container?.clientHeight || 600,
  xValues = [],
  yMin = 0,
  yMax = 24,
  yLabelInterval = null,
  yLineInterval = null,
  maxXLabels = null,
  yAxisGap = 6,
  alignBarsToTicks = false,
  barWidthFactor = 1.0,
  fields = [],
  overlays = [],
  indicators = [],
  fieldIndexByName = {},
  barColor = "rgba(0, 128, 255, 0.4)",
  outlineColor = "#004080",
  barGap = 4,
} = {}) {
  const gridSplits = buildIntervalSplits(yMin, yMax, yLineInterval);
  const labelStep = yLabelInterval ?? yLineInterval;
  const series = buildSeries(fields);
  const normalizedOverlays = (overlays || []).map((o) => ({
    ...o,
    disabled: o?.disabled ?? false,
  }));
  const normalizedIndicators = (indicators || []).map((i) => ({
    ...i,
    disabled: i?.disabled ?? false,
  }));

  const plugins = [
    sleepBarPlugin({
      barColor,
      outlineColor,
      barGap,
      alignBarsToTicks,
      barWidthFactor,
      overlays: normalizedOverlays,
      indicators: normalizedIndicators,
      fieldIndexByName,
    }),
  ];

  return {
    title,
    width,
    height,
    plugins,
    scales: {
      y: {
        auto: false,
        min: yMin,
        max: yMax,
      },
    },
    axes: [
      {
        splits: buildXLabelSplits(xValues, { maxXLabels }),
        values: (u, splits) =>
          splits.map((v) => new Date(v).toLocaleDateString()),
      },
      {
        splits: gridSplits ? () => gridSplits : undefined,
        grid: { show: yLineInterval !== 0 },
        values: (u, splits) => formatYLabels(splits, { yMin, labelStep }),
        gap: yAxisGap,
      },
    ],
    series,
  };
}

function buildIntervalSplits(min, max, interval) {
  if (interval == null || interval <= 0) return null;

  const splits = [];
  for (let v = min; v <= max + 1e-6; v += interval) {
    splits.push(Number(v.toFixed(6))); // trim float noise
  }
  return splits;
}

function formatYLabels(splits, { yMin, labelStep }) {
  if (labelStep == null || labelStep <= 0) {
    // Default: label every split using uPlot-generated ticks.
    return splits.map((v) => `${formatHour(v)}`);
  }

  return splits.map((v) => {
    const multiple =
      Math.abs(((v - yMin) / labelStep) - Math.round((v - yMin) / labelStep)) <
      1e-6;
    return multiple ? `${formatHour(v)}` : "";
  });
}

function formatHour(value) {
  return Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-6
    ? value.toFixed(0)
    : value.toFixed(1);
}

function buildXLabelSplits(xValues, { maxXLabels = null, minLabelSpacingPx = 72 }) {
  return (u) => {
    if (!Array.isArray(xValues) || xValues.length === 0) return [];

    // Estimate how many labels fit based on available plot width.
    const plotWidth = u?.bbox?.width ?? 800;
    const maxByWidth = Math.max(1, Math.floor(plotWidth / minLabelSpacingPx));
    const target = maxXLabels ? Math.min(maxXLabels, maxByWidth) : maxByWidth;
    const step = Math.max(1, Math.ceil(xValues.length / target));

    const splits = [];
    for (let i = 0; i < xValues.length; i += step) {
      splits.push(xValues[i]);
    }

    const last = xValues[xValues.length - 1];
    if (splits[splits.length - 1] !== last) {
      splits.push(last);
    }

    return splits;
  };
}

function buildSeries(fields) {
  const dateSeries = {
    label: "Date",
    value: (self, value) => new Date(value).toLocaleDateString(),
  };

  if (!fields || fields.length === 0) {
    return [
      dateSeries,
      { label: "Y1" },
      { label: "Y2" },
    ];
  }

  return [
    dateSeries,
    ...fields.map((f) => ({
      label: toTitle(f),
    })),
  ];
}

function toTitle(str) {
  return str
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1));
}

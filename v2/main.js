import uPlot from './lib/uPlot.esm.js';
import sleepBarPlugin from './plugins.js';

const sleepData = [[], [], []];

generateSleepData(sleepData[0], sleepData[1], sleepData[2], 22);

const container = document.getElementById("graph-container");

const opts = {
  title: "Sleep Blocks",
  width: container.clientWidth || 800,
  height: container.clientHeight || 600,
  plugins: [
    sleepBarPlugin({
      barColor: "rgba(0, 128, 255, 0.4)",
      outlineColor: "#004080",
      barGap: 4,
    }),
  ],
  series: [
    {
      label: "Date",
      value: (self, value) => new Date(value).toLocaleDateString(),
    },
    {
      label: "Sleep Start",
    },
    {
      label: "Wake Time",
    },
  ],
};

const plot = new uPlot(opts, sleepData, container);

// Keep the chart sized to its container for responsiveness.
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    plot.setSize({ width, height });
  }
});

resizeObserver.observe(container);

function generateSleepData(x, sleepStart, wakeTime, n) {
  for (let i = 0; i < n; i++) {
    const day = new Date(2025, 10, i).valueOf();
    const startHour = 6 + Math.round(Math.random() * 6) - 3;
    const endHour = Math.max(startHour + 2, 15 + Math.round(Math.random() * 4) - 2);

    x.push(day);
    sleepStart.push(startHour);
    wakeTime.push(endHour);
  }
}

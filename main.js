const sleepData = [[], [], []];

generateSleepData(sleepData[0], sleepData[1], sleepData[2], 12);

const opts = {
  title: "Sleep Blocks",
  width: 800,
  height: 600,
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

new uPlot(opts, sleepData, document.body);

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

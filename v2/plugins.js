function sleepBarPlugin({
    barGap = 2,
    barColor = "rgba(0, 128, 255, 0.4)",
    outlineColor = "#000000",
    outlineWidth = 1,
} = {}) {
    function drawBars(u) {
        const xVals = u.data[0] || [];
        const startVals = u.data[1] || [];
        const endVals = u.data[2] || [];

        if (xVals.length === 0)
            return;

        const ctx = u.ctx;
        ctx.save();

        for (let i = 0; i < xVals.length; i++) {
            const start = startVals[i];
            const end = endVals[i];

            if (start == null || end == null)
                continue;

            const xPos = u.valToPos(xVals[i], "x", true);
            let neighborOffset = 20;

            if (xVals.length > 1) {
                const prevX = i > 0 ? u.valToPos(xVals[i - 1], "x", true) : null;
                const nextX = i < xVals.length - 1 ? u.valToPos(xVals[i + 1], "x", true) : null;
                const spacing = [
                    prevX != null ? Math.abs(xPos - prevX) : null,
                    nextX != null ? Math.abs(nextX - xPos) : null,
                ].filter(v => v != null);

                if (spacing.length) {
                    neighborOffset = Math.min(...spacing);
                } else {
                    neighborOffset = u.bbox.width / xVals.length;
                }
            } else {
                neighborOffset = u.bbox.width - barGap * 2;
            }

            const barWidth = Math.max(1, neighborOffset - barGap);
            const startPos = u.valToPos(start, "y", true);
            const endPos = u.valToPos(end, "y", true);
            const top = Math.min(startPos, endPos);
            const height = Math.abs(startPos - endPos);
            const left = xPos - barWidth / 2;

            ctx.fillStyle = barColor;
            ctx.fillRect(
                Math.round(left),
                Math.round(top),
                Math.round(barWidth),
                Math.round(height),
            );

            if (outlineWidth > 0) {
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = outlineWidth;
                ctx.strokeRect(
                    Math.round(left) + outlineWidth / 2,
                    Math.round(top) + outlineWidth / 2,
                    Math.round(barWidth) - outlineWidth,
                    Math.round(height) - outlineWidth,
                );
            }
        }

        ctx.restore();
    }

    return {
        opts: (u, opts) => {
            opts.series.forEach((series, idx) => {
                if (idx === 0)
                    return;
                series.paths = () => null;
                series.points = {show: false};
            });
        },
        hooks: {
            draw: drawBars,
        }
    };
}

export {sleepBarPlugin as default}
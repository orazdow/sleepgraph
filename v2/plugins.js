function sleepBarPlugin({
    barGap = 2,
    barColor = "rgba(0, 128, 255, 0.4)",
    outlineColor = "#000000",
    outlineWidth = 1,
    alignBarsToTicks = false, // if true, left edge sits on x tick; otherwise centered
    barWidthFactor = 1.0,     // 1.0 = full slot; <1 narrows bars
    overlays = [],
    indicators = [],
    fieldIndexByName = {},
} = {}) {
    function computeBarGeometry(u, xVals, i) {
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

        const barWidth = Math.max(1, (neighborOffset - barGap) * barWidthFactor);
        const left = alignBarsToTicks ? xPos : xPos - barWidth / 2;
        return { barWidth, left, center: left + barWidth / 2 };
    }

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

            const { barWidth, left } = computeBarGeometry(u, xVals, i);
            const startPos = u.valToPos(start, "y", true);
            const endPos = u.valToPos(end, "y", true);
            const top = Math.min(startPos, endPos);
            const height = Math.abs(startPos - endPos);

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

    function drawOverlays(u) {
        const xVals = u.data[0] || [];
        if (!xVals.length || !overlays.length) return;

        const ctx = u.ctx;

        overlays.forEach((spec) => {
            if (!spec || spec.disabled) return;
            const idx = fieldIndexByName[spec.fieldName];
            if (idx == null) return;

            const yVals = u.data[idx] || [];
            const points = [];
            for (let i = 0; i < xVals.length; i++) {
                const yVal = yVals[i];
                if (yVal == null) continue;
                points.push([
                    u.valToPos(xVals[i], "x", true),
                    u.valToPos(yVal, "y", true),
                ]);
            }

            if (points.length < 2) return;

            ctx.save();
            ctx.strokeStyle = spec.color || "#ffffff";
            ctx.lineWidth = spec.lineWidth != null ? spec.lineWidth : 2;
            ctx.beginPath();
            if (spec.spline) {
                drawMonotoneSpline(ctx, points);
            } else {
                ctx.moveTo(points[0][0], points[0][1]);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i][0], points[i][1]);
                }
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawIndicators(u) {
        const xVals = u.data[0] || [];
        if (!xVals.length || !indicators.length) return;

        const ctx = u.ctx;

        indicators.forEach((spec) => {
            if (!spec || spec.disabled) return;
            const idx = fieldIndexByName[spec.fieldName];
            if (idx == null) return;

            const yVals = u.data[idx] || [];
            const widthFactor = spec.widthFactor != null ? spec.widthFactor : 0.6;
            const thickness = spec.thickness != null ? spec.thickness : 2;

            ctx.save();
            ctx.strokeStyle = spec.color || "#ffffff";
            ctx.lineWidth = thickness;
            ctx.lineCap = "round";

            for (let i = 0; i < xVals.length; i++) {
                const yVal = yVals[i];
                if (yVal == null) continue;

                const { barWidth, left, center } = computeBarGeometry(u, xVals, i);
                const half = (barWidth * widthFactor) / 2;
                const yPos = u.valToPos(yVal, "y", true);
                const xCenter = alignBarsToTicks ? left + barWidth / 2 : center;

                ctx.beginPath();
                ctx.moveTo(xCenter - half, yPos);
                ctx.lineTo(xCenter + half, yPos);
                ctx.stroke();
            }

            ctx.restore();
        });
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
            draw: (u) => {
                drawBars(u);
                drawOverlays(u);
                drawIndicators(u);
            },
        }
    };
}

// Monotone cubic spline adapted for canvas paths.
function drawMonotoneSpline(ctx, points) {
    const n = points.length;
    if (n < 2) return;

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const ms = new Array(n - 1);
    const ts = new Array(n);

    for (let i = 0; i < n - 1; i++) {
        const dx = xs[i + 1] - xs[i];
        const dy = ys[i + 1] - ys[i];
        ms[i] = dx !== 0 ? dy / dx : 0;
    }

    ts[0] = ms[0];
    for (let i = 1; i < n - 1; i++) {
        ts[i] = (ms[i - 1] + ms[i]) / 2;
    }
    ts[n - 1] = ms[n - 2];

    for (let i = 0; i < n - 1; i++) {
        if (ms[i] === 0) {
            ts[i] = 0;
            ts[i + 1] = 0;
            continue;
        }
        const a = ts[i] / ms[i];
        const b = ts[i + 1] / ms[i];
        const h = Math.hypot(a, b);
        if (h > 3) {
            const t = 3 / h;
            ts[i] = a * t * ms[i];
            ts[i + 1] = b * t * ms[i];
        }
    }

    ctx.moveTo(xs[0], ys[0]);
    for (let i = 0; i < n - 1; i++) {
        const x0 = xs[i];
        const y0 = ys[i];
        const x1 = xs[i + 1];
        const y1 = ys[i + 1];
        const dx = x1 - x0;
        const cp1x = x0 + dx / 3;
        const cp1y = y0 + ts[i] * dx / 3;
        const cp2x = x1 - dx / 3;
        const cp2y = y1 - ts[i + 1] * dx / 3;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
    }
}

export {sleepBarPlugin as default}


function boxesPlugin({
    gap = 2,
    shadowColor = "#000000",
    bearishColor = "#e54245",
    bullishColor = "#4ab650",
    bodyWidthFactor = 0.7,
    shadowWidth = 2,
    bodyOutline = 1,
    showMedian = true,
    showOutliers = true,
} = {}) {

    function drawBoxes(u) {
        u.ctx.save();

        const offset = (shadowWidth % 2) / 2;

        u.ctx.translate(offset, offset);

        for (let i = u.scales.x.min; i <= u.scales.x.max; i++) {
            let med          = u.data[1][i];
            let q1           = u.data[2][i];
            let q3           = u.data[3][i];
            let min          = u.data[4][i];
            let max          = u.data[5][i];
            let outs         = (u.data[6] && u.data[6][i]) || [];

            let timeAsX      = u.valToPos(i,     "x", true);
            let lowAsY       = u.valToPos(min,   "y", true);
            let highAsY      = u.valToPos(max,   "y", true);
            let openAsY      = u.valToPos(q1,    "y", true);
            let closeAsY     = u.valToPos(q3,    "y", true);
            let medAsY       = u.valToPos(med,   "y", true);

            // shadow rect
            let shadowHeight = Math.max(highAsY, lowAsY) - Math.min(highAsY, lowAsY);
            let shadowX      = timeAsX;
            let shadowY      = Math.min(highAsY, lowAsY);

            u.ctx.beginPath();
            u.ctx.setLineDash([4, 4]);
            u.ctx.lineWidth = shadowWidth;
            u.ctx.strokeStyle = shadowColor;
            u.ctx.moveTo(
                Math.round(shadowX),
                Math.round(shadowY),
            );
            u.ctx.lineTo(
                Math.round(shadowX),
                Math.round(shadowY + shadowHeight),
            );
            u.ctx.stroke();

            // body rect
            let columnWidth  = u.bbox.width / (u.scales.x.max - u.scales.x.min);
            let bodyWidth    = Math.round(bodyWidthFactor * (columnWidth - gap));
            let bodyHeight   = Math.max(closeAsY, openAsY) - Math.min(closeAsY, openAsY);
            let bodyX        = timeAsX - (bodyWidth / 2);
            let bodyY        = Math.min(closeAsY, openAsY);
            let bodyColor    = "#eee";

            u.ctx.fillStyle = shadowColor;
            u.ctx.fillRect(
                Math.round(bodyX),
                Math.round(bodyY),
                Math.round(bodyWidth),
                Math.round(bodyHeight),
            );

            u.ctx.fillStyle = bodyColor;
            u.ctx.fillRect(
                Math.round(bodyX + bodyOutline),
                Math.round(bodyY + bodyOutline),
                Math.round(bodyWidth - bodyOutline * 2),
                Math.round(bodyHeight - bodyOutline * 2),
            );

            if (showMedian && med != null) {
                u.ctx.fillStyle = "#000";
                u.ctx.fillRect(
                    Math.round(bodyX),
                    Math.round(medAsY - 1),
                    Math.round(bodyWidth),
                    Math.round(2),
                );
            }

            // hz min/max whiskers
            u.ctx.beginPath();
            u.ctx.setLineDash([]);
            u.ctx.lineWidth = shadowWidth;
            u.ctx.strokeStyle = shadowColor;
            u.ctx.moveTo(
                Math.round(bodyX),
                Math.round(highAsY),
            );
            u.ctx.lineTo(
                Math.round(bodyX + bodyWidth),
                Math.round(highAsY),
            );
            u.ctx.moveTo(
                Math.round(bodyX),
                Math.round(lowAsY),
            );
            u.ctx.lineTo(
                Math.round(bodyX + bodyWidth),
                Math.round(lowAsY),
            );
            u.ctx.stroke();


            if (showOutliers) {
                for (let j = 0; j < outs.length; j++) {
                    let cy = u.valToPos(outs[j], "y", true);
                    u.ctx.fillRect(timeAsX - 4, cy - 4, 8, 8);
                }
            }
        }

        u.ctx.translate(-offset, -offset);

        u.ctx.restore();
    }

    return {
        opts: (u, opts) => {
            const assigned = {
                cursor: {
                    points: {
                        show: false,
                    }
                },
            };

            if (showOutliers) {
                assigned.scales = {
                    y: {
                        range: (u, dataMin, dataMax) => {
                            // TODO: only scan values in x idx0...idx1 range
                            let outsMin = Math.min(...u.data[6].map(outs => outs.at(0) ?? Infinity));
                            let outsMax = Math.max(...u.data[6].map(outs => outs.at(-1) ?? -Infinity));

                            return uPlot.rangeNum(Math.min(dataMin, outsMin), Math.max(dataMax, outsMax), 0.1, true);
                        }
                    }
                };
            }

            uPlot.assign(opts, assigned);

            opts.series.forEach(series => {
                series.paths = () => null;
                series.points = {show: false};
            });
        },
        hooks: {
            draw: drawBoxes,
        }
    };
}

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

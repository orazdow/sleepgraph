import 'dart:math';

import 'package:flutter/material.dart';

/// Generic chart point: x is timestamp (ms since epoch), y1/y2 used for bar start/end,
/// y3–y6 reserved for overlays/indicators.
class ChartPoint {
  final int x;
  final double? y1;
  final double? y2;
  final double? y3;
  final double? y4;
  final double? y5;
  final double? y6;

  const ChartPoint({
    required this.x,
    this.y1,
    this.y2,
    this.y3,
    this.y4,
    this.y5,
    this.y6,
  });
}

class OverlaySpec {
  final String fieldName; // e.g. 'y1', 'y2', 'y3', etc.
  final Color color;
  final bool disabled;
  final String legendName;

  const OverlaySpec({
    required this.fieldName,
    required this.color,
    this.disabled = false,
    this.legendName = '',
  });
}

class IndicatorSpec {
  final String fieldName; // e.g. 'y3'
  final Color color;
  final double thickness;

  /// Width of the indicator line as a fraction of slot width.
  final double widthFactor;
  final bool disabled;
  final String legendName;

  const IndicatorSpec({
    required this.fieldName,
    required this.color,
    this.thickness = 2,
    this.widthFactor = 0.6,
    this.disabled = false,
    this.legendName = '',
  });
}

class SleepChartSettings {
  final List<ChartPoint> data;
  final double minHour;
  final double maxHour;

  /// Label spacing in hours. 0 disables y labels. 1 = every hour, 3 = every 3 hours, etc.
  final double yLabelInterval;

  /// Grid line spacing in hours. 0 disables grid lines. 1 = every hour, 3 = every 3 hours, etc.
  final double yLineInterval;

  /// Maximum number of x-axis labels to render. Labels will be spaced to not exceed this count.
  final int maxXLabels;

  /// Whether to draw vertical indicator lines aligned to each x-axis label.
  final bool showXIndicatorLines;

  /// Whether to render overlay lines as a smoothed path.
  final bool useBezierForStartLine;

  /// If true, use cubic Beziers for overlay lines; otherwise quadratic.
  final bool cubicDegree;

  /// Overlay specs: each defines which y-field to plot and its color.
  final List<OverlaySpec> overlays;

  /// Indicator specs: per-bar ticks when values are present.
  final List<IndicatorSpec> indicators;

  /// Whether to draw the legend when legend entries are present.
  final bool showLegend;

  final Color barColor;
  final Color backgroundColor;
  final Color gridLineColor;
  final TextStyle axisLabelStyle;
  final double leftAxisWidth;
  final double bottomAxisHeight;
  final double topPadding;
  final double rightPadding;

  const SleepChartSettings({
    required this.data,
    this.minHour = 0,
    this.maxHour = 24,
    this.yLabelInterval = 3,
    this.yLineInterval = 1,
    this.maxXLabels = 6,
    this.showXIndicatorLines = false,
    this.useBezierForStartLine = false,
    this.cubicDegree = false,
    this.overlays = const [],
    this.indicators = const [],
    this.showLegend = false,
    this.barColor = const Color(0xFF2ECC71),
    this.backgroundColor = const Color(0xFF202125),
    this.gridLineColor = const Color(0xFF2E2F33),
    this.axisLabelStyle = const TextStyle(color: Colors.grey, fontSize: 12),
    this.leftAxisWidth = 52,
    this.bottomAxisHeight = 32,
    this.topPadding = 12,
    this.rightPadding = 12,
  });
}

class SleepBoxChart extends StatelessWidget {
  const SleepBoxChart({super.key, required this.settings});

  final SleepChartSettings settings;

  @override
  Widget build(BuildContext context) {
    final legendItems = [
      ...settings.overlays
          .where((o) => o.legendName.isNotEmpty && !o.disabled)
          .map((o) => _LegendEntry(color: o.color, label: o.legendName)),
      ...settings.indicators
          .where((i) => i.legendName.isNotEmpty && !i.disabled)
          .map((i) => _LegendEntry(color: i.color, label: i.legendName)),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final hasLegend = settings.showLegend && legendItems.isNotEmpty;
        final legendHeight = hasLegend ? 28.0 : 0.0;
        final legendSpacing = hasLegend ? 8.0 : 0.0;
        final chartHeight =
            (constraints.maxHeight - legendHeight - legendSpacing).clamp(
              0.0,
              double.infinity,
            );

        return SizedBox(
          width: constraints.maxWidth,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: chartHeight,
                width: constraints.maxWidth,
                child: CustomPaint(
                  size: Size(constraints.maxWidth, chartHeight),
                  painter: SleepChartPainter(settings: settings),
                ),
              ),
              if (hasLegend) SizedBox(height: legendSpacing),
              if (hasLegend)
                Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  children: legendItems
                      .map(
                        (item) => Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: item.color,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(item.label, style: settings.axisLabelStyle),
                          ],
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        );
      },
    );
  }
}

class SleepChartPainter extends CustomPainter {
  SleepChartPainter({required this.settings});

  final SleepChartSettings settings;
  static const double _cubicTension = 0.4;
  static const double _quadraticTension = 0.5;

  @override
  void paint(Canvas canvas, Size size) {
    final chartWidth =
        size.width - settings.leftAxisWidth - settings.rightPadding;
    final chartHeight =
        size.height - settings.bottomAxisHeight - settings.topPadding;
    if (chartWidth <= 0 || chartHeight <= 0) return;

    final chartRect = Rect.fromLTWH(
      settings.leftAxisWidth,
      settings.topPadding,
      chartWidth,
      chartHeight,
    );

    _drawBackground(canvas, chartRect);
    _drawGridAndYAxis(canvas, chartRect);
    _drawBars(canvas, chartRect);
    _drawTimeLabels(canvas, chartRect);
    _drawOverlays(canvas, chartRect);
    _drawIndicators(canvas, chartRect);
  }

  void _drawBackground(Canvas canvas, Rect rect) {
    final bgPaint = Paint()..color = settings.backgroundColor;
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(8)),
      bgPaint,
    );
  }

  void _drawGridAndYAxis(Canvas canvas, Rect chartRect) {
    final gridPaint = Paint()
      ..color = settings.gridLineColor
      ..strokeWidth = 1;

    final Set<double> gridHours = {};
    if (settings.yLineInterval > 0) {
      for (
        double h = settings.minHour;
        h <= settings.maxHour + 1e-6;
        h += settings.yLineInterval
      ) {
        gridHours.add(double.parse(h.toStringAsFixed(6)));
      }
      gridHours.add(settings.minHour);
      gridHours.add(settings.maxHour);
    }
    final double labelStep = settings.yLabelInterval;
    final Set<double> labeledHours = {};
    if (labelStep > 0) {
      for (
        double h = settings.minHour;
        h <= settings.maxHour + 1e-6;
        h += labelStep
      ) {
        labeledHours.add(double.parse(h.toStringAsFixed(6)));
      }
      labeledHours.add(settings.minHour);
      labeledHours.add(settings.maxHour);
    }

    final Iterable<double> hoursToDraw = gridHours.isNotEmpty
        ? gridHours
        : [settings.minHour, settings.maxHour];

    for (final hour in hoursToDraw) {
      final y = _hourToY(chartRect, hour);
      if (gridHours.isNotEmpty) {
        canvas.drawLine(
          Offset(chartRect.left, y),
          Offset(chartRect.right, y),
          gridPaint,
        );
      }
      final shouldLabel =
          labelStep > 0 && labeledHours.any((h) => (h - hour).abs() < 1e-6);
      if (shouldLabel) {
        final tp = _textPainter(
          hour.toStringAsFixed(hour == hour.roundToDouble() ? 0 : 1),
          settings.axisLabelStyle,
        );
        tp.paint(
          canvas,
          Offset(settings.leftAxisWidth - tp.width - 6, y - tp.height / 2),
        );
      }
    }
  }

  void _drawBars(Canvas canvas, Rect chartRect) {
    if (settings.data.isEmpty) return;
    final slotWidth = chartRect.width / settings.data.length;
    final barWidth = (slotWidth * 0.65).clamp(4.0, 18.0);
    final barPaint = Paint()..color = settings.barColor;

    for (int i = 0; i < settings.data.length; i++) {
      final bar = settings.data[i];
      if (bar.y1 == null || bar.y2 == null) continue;
      final centerX = chartRect.left + (i + 0.5) * slotWidth;
      final left = centerX - barWidth / 2;
      final top = _hourToY(chartRect, bar.y2!);
      final bottom = _hourToY(chartRect, bar.y1!);
      final rect = Rect.fromLTRB(
        left,
        min(top, bottom),
        left + barWidth,
        max(top, bottom),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(3)),
        barPaint,
      );
    }
  }

  void _drawOverlays(Canvas canvas, Rect chartRect) {
    if (settings.overlays.isEmpty || settings.data.isEmpty) return;
    final slotWidth = chartRect.width / settings.data.length;

    for (final spec in settings.overlays) {
      if (spec.disabled) continue;
      final points = _collectOverlayPoints(
        chartRect,
        slotWidth,
        spec.fieldName,
      );
      if (points.length < 2) continue;

      if (settings.useBezierForStartLine) {
        if (settings.cubicDegree) {
          _drawStartLineCubic(canvas, points, spec.color);
        } else {
          _drawStartLineQuadratic(canvas, points, spec.color);
        }
      } else {
        _drawStartLineLinear(canvas, points, spec.color);
      }
    }
  }

  void _drawIndicators(Canvas canvas, Rect chartRect) {
    if (settings.indicators.isEmpty || settings.data.isEmpty) return;
    final slotWidth = chartRect.width / settings.data.length;

    for (final spec in settings.indicators) {
      if (spec.disabled) continue;
      for (int i = 0; i < settings.data.length; i++) {
        final pt = settings.data[i];
        final value = _getFieldValue(pt, spec.fieldName);
        if (value == null) continue;
        final centerX = chartRect.left + (i + 0.5) * slotWidth;
        final y = _hourToY(chartRect, value);
        final halfWidth = slotWidth * spec.widthFactor / 2;
        final paint = Paint()
          ..color = spec.color
          ..strokeWidth = spec.thickness
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(
          Offset(centerX - halfWidth, y),
          Offset(centerX + halfWidth, y),
          paint,
        );
      }
    }
  }

  void _drawTimeLabels(Canvas canvas, Rect chartRect) {
    if (settings.data.isEmpty) return;
    final slotWidth = chartRect.width / settings.data.length;
    final labelStyle = settings.axisLabelStyle;
    final maxLabels = settings.maxXLabels.clamp(1, settings.data.length);
    final step = max(1, (settings.data.length / maxLabels).floor());
    final barWidth = (slotWidth * 0.65).clamp(4.0, 18.0);

    for (int i = 0; i < settings.data.length; i += step) {
      final bar = settings.data[i];
      final xCenter = chartRect.left + (i + 0.5) * slotWidth;
      final monthDay = DateTime.fromMillisecondsSinceEpoch(bar.x);
      final month = monthDay.month.toString().padLeft(2, '0');
      final day = monthDay.day.toString().padLeft(2, '0');
      final label = "$month-$day";
      final tp = _textPainter(label, labelStyle);
      if (settings.showXIndicatorLines) {
        final linePaint = Paint()
          ..color = settings.gridLineColor
          ..strokeWidth = 1;
        final xLeftEdge = xCenter - barWidth / 2;
        canvas.drawLine(
          Offset(xLeftEdge, chartRect.top),
          Offset(xLeftEdge, chartRect.bottom),
          linePaint,
        );
        tp.paint(canvas, Offset(xLeftEdge, chartRect.bottom + 6));
      } else {
        tp.paint(canvas, Offset(xCenter - tp.width / 2, chartRect.bottom + 6));
      }
    }
  }

  List<Offset> _collectOverlayPoints(
    Rect chartRect,
    double slotWidth,
    String field,
  ) {
    final pts = <Offset>[];
    for (int i = 0; i < settings.data.length; i++) {
      final pt = settings.data[i];
      final value = _getFieldValue(pt, field);
      if (value == null) continue;
      final x = chartRect.left + (i + 0.5) * slotWidth;
      final y = _hourToY(chartRect, value);
      pts.add(Offset(x, y));
    }
    return pts;
  }

  double? _getFieldValue(ChartPoint pt, String field) {
    switch (field) {
      case 'y1':
        return pt.y1;
      case 'y2':
        return pt.y2;
      case 'y3':
        return pt.y3;
      case 'y4':
        return pt.y4;
      case 'y5':
        return pt.y5;
      case 'y6':
        return pt.y6;
      default:
        return null;
    }
  }

  void _drawStartLineLinear(Canvas canvas, List<Offset> points, Color color) {
    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, linePaint);
  }

  void _drawStartLineCubic(Canvas canvas, List<Offset> points, Color color) {
    if (points.length < 2) return;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 0; i < points.length - 1; i++) {
      final p0 = points[i];
      final p1 = points[i + 1];
      final dx = (p1.dx - p0.dx);
      final c1 = Offset(p0.dx + dx * _cubicTension, p0.dy);
      final c2 = Offset(p1.dx - dx * _cubicTension, p1.dy);
      path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p1.dx, p1.dy);
    }
    canvas.drawPath(path, paint);
  }

  void _drawStartLineQuadratic(
    Canvas canvas,
    List<Offset> points,
    Color color,
  ) {
    if (points.length < 2) return;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 0; i < points.length - 1; i++) {
      final p0 = points[i];
      final p1 = points[i + 1];
      final midX = p0.dx + (p1.dx - p0.dx) * _quadraticTension;
      final midY = p0.dy + (p1.dy - p0.dy) * _quadraticTension;
      path.quadraticBezierTo(p0.dx, p0.dy, midX, midY);
    }
    path.lineTo(points.last.dx, points.last.dy);
    canvas.drawPath(path, paint);
  }

  double _hourToY(Rect chartRect, double hour) {
    final clamped = hour.clamp(settings.minHour, settings.maxHour);
    final t =
        (clamped - settings.minHour) / (settings.maxHour - settings.minHour);
    return chartRect.bottom - t * chartRect.height;
  }

  TextPainter _textPainter(String text, TextStyle style) {
    return TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
    )..layout();
  }

  @override
  bool shouldRepaint(covariant SleepChartPainter oldDelegate) {
    return oldDelegate.settings != settings;
  }
}

class _LegendEntry {
  final Color color;
  final String label;

  _LegendEntry({required this.color, required this.label});
}

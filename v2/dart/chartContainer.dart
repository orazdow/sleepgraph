import 'package:flutter/material.dart';

import 'boxchart/dataUtil.dart';
import 'boxchart/boxChart.dart';
import 'boxchart/test_data_static.dart';

class ChartContainer extends StatefulWidget {
  const ChartContainer({super.key});

  @override
  State<ChartContainer> createState() => _ChartContainerState();
}

class _ChartContainerState extends State<ChartContainer> {
  late final SleepChartSettings _settings;

  @override
  void initState() {
    super.initState();
    _settings = SleepChartSettings(
      data: ingestSleepLogJson(embeddedJson),
      yLabelInterval: 3,
      yLineInterval: 3,
      maxXLabels: 12,
      showXIndicatorLines: true,
      useBezierForStartLine: true,
      cubicDegree: true,
      overlays: const [
        OverlaySpec(
          fieldName: 'y1',
          color: Color(0xFF5DADE2),
          legendName: 'Sleep start',
        ),
      ],
      indicators: const [
        IndicatorSpec(
          fieldName: 'y3',
          color: Color(0xFFFFC300),
          thickness: 2,
          legendName: 'Coffee time',
        ),
      ],
      showLegend: false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sleep Chart (demo)',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SleepBoxChart(settings: _settings),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

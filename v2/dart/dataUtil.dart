import 'dart:convert';
import 'dart:math';

import 'boxChart.dart';

/// Generates mock ChartPoint data for quick demos.
List<ChartPoint> generateSamplePoints({
  int days = 30,
  DateTime? startDate,
  Random? random,
  int startHourMean = 6,
  int startHourJitter = 3,
  int endHourBase = 15,
  int endHourJitter = 2,
  int minDurationHours = 2,
  int coffeeBaseHour = 17,
  int coffeeJitter = 2,
  int coffeeEvery = 4, // 1 in `coffeeEvery` days gets coffee
}) {
  final rng = random ?? Random();
  final base = startDate ?? DateTime(2025, 11, 1);

  return List.generate(days, (i) {
    final day = base.add(Duration(days: i));

    final start =
        startHourMean + rng.nextInt(startHourJitter * 2 + 1) - startHourJitter;
    final end = max(
      start + minDurationHours,
      endHourBase + rng.nextInt(endHourJitter * 2 + 1) - endHourJitter,
    );

    // Occasionally add a coffee-time indicator
    final hasCoffee = coffeeEvery > 0 && rng.nextInt(coffeeEvery) == 0;
    final coffeeTime = hasCoffee
        ? coffeeBaseHour + rng.nextInt(coffeeJitter * 2 + 1) - coffeeJitter
        : null;

    return ChartPoint(
      x: day.millisecondsSinceEpoch,
      y1: start.toDouble(),
      y2: end.toDouble(),
      y3: coffeeTime?.toDouble(),
    );
  });
}

/// Ingests a JSON string into a list of [ChartPoint]s.
///
/// Accepts either:
/// - a top-level array of objects with keys: x (int, ms since epoch), y1..y6 (num or null)
/// - a map with key "entries" whose value is such an array
/// Unknown/missing fields are treated as null. Invalid entries are skipped.
List<ChartPoint> ingestJsonToChartPoints(String jsonStr) {
  final decoded = jsonDecode(jsonStr);
  dynamic data = decoded;
  if (decoded is Map && decoded['entries'] is List) {
    data = decoded['entries'];
  }
  if (data is! List) return [];

  double? _numToDouble(dynamic v) => v is num ? v.toDouble() : null;

  return data
      .whereType<Map>()
      .map((e) => ChartPoint(
            x: e['x'] is int ? e['x'] as int : (e['x'] as num?)?.toInt() ?? 0,
            y1: _numToDouble(e['y1']),
            y2: _numToDouble(e['y2']),
            y3: _numToDouble(e['y3']),
            y4: _numToDouble(e['y4']),
            y5: _numToDouble(e['y5']),
            y6: _numToDouble(e['y6']),
          ))
      .where((pt) => pt.x != 0)
      .toList();
}

/// Ingests sleep-log JSON into ChartPoints using known field names.
///
/// Accepts either:
/// - a map with key "entries" containing the data array, or
/// - a top-level array of entries.
///
/// Expected keys per entry:
/// - date_millis: int (ms since epoch) -> x
/// - sleep_time: int (ms since epoch) -> y1 (start)
/// - wake_time: int (ms since epoch) -> y2 (end)
/// - coffee_time: int? -> y3
/// - melatonin: int? -> y4
/// - lightbox_ambient: int? -> y5
/// - lightbox_direct: int? -> y6
List<ChartPoint> ingestSleepLogJson(
  String jsonStr, {
  bool interpretTimesAsUtc = true,
}) {
  final decoded = jsonDecode(jsonStr);
  dynamic data = decoded;
  if (decoded is Map && decoded['entries'] is List) {
    data = decoded['entries'];
  }
  if (data is! List) return [];

  int? _toMillis(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return null;
  }

  double? _millisToHour(int? millis) {
    if (millis == null) return null;
    final dt = DateTime.fromMillisecondsSinceEpoch(
      millis,
      isUtc: interpretTimesAsUtc,
    );
    return dt.hour + dt.minute / 60.0 + dt.second / 3600.0;
  }

  return data.whereType<Map>().map((e) {
    final x = _toMillis(e['date_millis']) ?? 0;
    final sleepHour = _millisToHour(_toMillis(e['sleep_time']));
    final wakeHour = _millisToHour(_toMillis(e['wake_time']));
    final coffeeHour = _millisToHour(_toMillis(e['coffee_time']));
    final melatoninHour = _millisToHour(_toMillis(e['melatonin']));
    final lightAmbient = _millisToHour(_toMillis(e['lightbox_ambient']));
    final lightDirect = _millisToHour(_toMillis(e['lightbox_direct']));

    return ChartPoint(
      x: x,
      y1: sleepHour,
      y2: wakeHour,
      y3: coffeeHour,
      y4: melatoninHour,
      y5: lightAmbient,
      y6: lightDirect,
    );
  }).where((pt) => pt.x != 0).toList();
}

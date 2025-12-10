// Sleep data generation utilities for local testing (in-memory only).

const HOUR = 60 * 60 * 1000;

const DEFAULT_MEANS = {
    inBed: 5,       // 5 AM
    sleep: 7,       // 7 AM
    wake: 16,       // 4 PM
    up: 17,         // 5 PM
    hypnotic: 7,    // 7 AM
};

const DEFAULT_JITTER_HOURS = 3;

function randomHour(meanHour, jitterHours) {
    const delta = (Math.random() * 2 - 1) * jitterHours;
    return meanHour + delta;
}

function timeOnDate(dateMillis, hourFloat) {
    const clamped = Math.max(0, Math.min(23.999, hourFloat));
    return dateMillis + clamped * HOUR;
}

function ensureAfter(candidateMillis, minMillis, paddingMinutes = 15) {
    const paddingMs = paddingMinutes * 60 * 1000;
    return Math.max(candidateMillis, minMillis + paddingMs);
}

/**
 * Generate sleep log entries resembling sleeplogv2.json.
 * Only key timing fields are populated; other fields can be added later.
 *
 * @param {number} days - Number of sequential days to generate.
 * @param {Date|string|number} startDate - Starting date (midnight UTC), e.g., "2025-10-12".
 * @param {object} means - Override default mean hours (keys: inBed, sleep, wake, up, hypnotic).
 * @param {number} jitterHours - +/- hour deviation applied uniformly.
 * @returns {{generated_at: string, entries: Array<object>}}
 */
export function generateSleepLog(
    days = 14,
    startDate = "2025-10-12",
    means = {},
    jitterHours = DEFAULT_JITTER_HOURS
) {
    const resolvedMeans = { ...DEFAULT_MEANS, ...means };
    const entries = [];

    const baseDate = new Date(startDate);
    if (Number.isNaN(baseDate.valueOf())) {
        throw new Error("Invalid startDate supplied to generateSleepLog");
    }

    for (let i = 0; i < days; i++) {
        const dateMillis = baseDate.valueOf() + i * 24 * HOUR;
        const isoDate = new Date(dateMillis).toISOString();

        const inBed = timeOnDate(dateMillis, randomHour(resolvedMeans.inBed, jitterHours));
        const sleep = ensureAfter(
            timeOnDate(dateMillis, randomHour(resolvedMeans.sleep, jitterHours)),
            inBed,
            15
        );
        const wake = ensureAfter(
            timeOnDate(dateMillis, randomHour(resolvedMeans.wake, jitterHours)),
            sleep,
            30
        );
        const up = ensureAfter(
            timeOnDate(dateMillis, randomHour(resolvedMeans.up, jitterHours)),
            wake,
            15
        );
        const hypnotic = timeOnDate(
            dateMillis,
            randomHour(resolvedMeans.hypnotic, jitterHours)
        );

        entries.push({
            date: isoDate,
            date_millis: dateMillis,
            in_bed_time: inBed,
            sleep_time: sleep,
            wake_time: wake,
            up_time: up,
            hypnotic_time: hypnotic,
            // Other fields can be added/ingested later as needed.
        });
    }

    return {
        generated_at: new Date().toISOString(),
        entries,
    };
}

function resolveDateMillis(entry) {
    if (typeof entry.date_millis === "number") return entry.date_millis;
    if (entry.date) {
        const parsed = Date.parse(entry.date);
        if (!Number.isNaN(parsed)) return parsed;
    }
    throw new Error("Entry missing valid date/date_millis");
}

function normalizeTimeValue(value) {
    if (value == null) return null;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Ingest a sleep log JSON object and produce uPlot-friendly data arrays.
 * X is always date_millis; Y arrays are selected by the switch object.
 *
 * @param {object} sleepLog - Object shaped like sleeplogv2.json (with entries array).
 * @param {object} fieldSwitch - Map of fieldName -> boolean indicating inclusion.
 * @returns {Array<Array<number|null>>} uPlot data array [[x], [y1], [y2], ...]
 */
export function ingestSleepLog(sleepLog, fieldSwitch = {}) {
    return ingestSleepLogWithFields(sleepLog, fieldSwitch).data;
}

/**
 * Variant that also returns the ordered field names for downstream mapping.
 *
 * @param {object} sleepLog
 * @param {object} fieldSwitch
 * @returns {{data: Array<Array<number|null>>, fields: Array<string>}}
 */
export function ingestSleepLogWithFields(sleepLog, fieldSwitch = {}) {
    if (!sleepLog || !Array.isArray(sleepLog.entries)) {
        throw new Error("ingestSleepLog requires a sleepLog with an entries array");
    }

    const enabledFields = Object.keys(fieldSwitch).filter(
        (field) => field !== "date" && field !== "date_millis" && fieldSwitch[field]
    );

    // Clone + sort entries by date_millis to ensure chronological order.
    const entries = [...sleepLog.entries].sort(
        (a, b) => resolveDateMillis(a) - resolveDateMillis(b)
    );

    const x = [];
    const yMap = {};
    enabledFields.forEach((field) => {
        yMap[field] = [];
    });

    for (const entry of entries) {
        const dateMs = resolveDateMillis(entry);
        x.push(dateMs);

        for (const field of enabledFields) {
            yMap[field].push(normalizeTimeValue(entry[field]));
        }
    }

    const yArrays = enabledFields.map((field) => yMap[field]);
    return {
        data: [x, ...yArrays],
        fields: enabledFields,
    };
}

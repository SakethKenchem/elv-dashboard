/* Module: Shared metric utilities for month/quarter normalization and sales manager KPI computations. */
export const MONTHS = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
] as const

export type MonthName = (typeof MONTHS)[number]
export type MonthMap = Record<MonthName, number>

const quarterMonthMap: Record<number, MonthName[]> = {
    1: ["JANUARY", "FEBRUARY", "MARCH"],
    2: ["APRIL", "MAY", "JUNE"],
    3: ["JULY", "AUGUST", "SEPTEMBER"],
    4: ["OCTOBER", "NOVEMBER", "DECEMBER"],
}

export function normalizeQuarter(value: unknown): 1 | 2 | 3 | 4 {
    // Accept unknown input from API/UI and coerce to a safe quarter value.
    const parsed = Number(value)
    if (parsed === 2 || parsed === 3 || parsed === 4) {
        return parsed
    }
    return 1
}

export function normalizeMonth(value: unknown): MonthName {
    // Import files may use short or long month labels; normalize both forms.
    const normalized = String(value ?? "").trim().toUpperCase()
    const aliases: Record<string, MonthName> = {
        JAN: "JANUARY",
        JANUARY: "JANUARY",
        FEB: "FEBRUARY",
        FEBRUARY: "FEBRUARY",
        MAR: "MARCH",
        MARCH: "MARCH",
        APR: "APRIL",
        APRIL: "APRIL",
        MAY: "MAY",
        JUN: "JUNE",
        JUNE: "JUNE",
        JUL: "JULY",
        JULY: "JULY",
        AUG: "AUGUST",
        AUGUST: "AUGUST",
        SEP: "SEPTEMBER",
        SEPT: "SEPTEMBER",
        SEPTEMBER: "SEPTEMBER",
        OCT: "OCTOBER",
        OCTOBER: "OCTOBER",
        NOV: "NOVEMBER",
        NOVEMBER: "NOVEMBER",
        DEC: "DECEMBER",
        DECEMBER: "DECEMBER",
    }

    return aliases[normalized] ?? "JANUARY"
}

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

export function toMonthMap(value: unknown): MonthMap {
    // Always return a full 12-month map so downstream math never sees missing keys.
    const base = Object.fromEntries(MONTHS.map((month) => [month, 0])) as MonthMap

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return base
    }

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const normalizedKey = key.trim().toUpperCase()
        if (MONTHS.includes(normalizedKey as MonthName)) {
            base[normalizedKey as MonthName] = toNumber(raw)
        }
    }

    return base
}

export function quarterMonths(quarter: number): MonthName[] {
    return quarterMonthMap[normalizeQuarter(quarter)]
}

export function sumMonthMap(values: MonthMap): number {
    return MONTHS.reduce((sum, month) => sum + toNumber(values[month]), 0)
}

export function computeSalesManagerMetrics(input: {
    selectedQuarter: number
    quarterTarget: number
    monthlyAchieved: MonthMap
}) {
    // Quarter KPIs are derived from month-wise achieved values, not from legacy flat columns.
    const selectedQuarter = normalizeQuarter(input.selectedQuarter)
    const quarterTarget = toNumber(input.quarterTarget)
    const totalAchieved = sumMonthMap(input.monthlyAchieved)
    const quarterAchieved = quarterMonths(selectedQuarter).reduce(
        (sum, month) => sum + toNumber(input.monthlyAchieved[month]),
        0
    )

    const percentageAchieved = quarterTarget > 0 ? (quarterAchieved / quarterTarget) * 100 : 0
    const balanceToQuarterTarget = Math.max(quarterTarget - quarterAchieved, 0)

    return {
        selectedQuarter,
        quarterAchieved,
        totalAchieved,
        percentageAchieved,
        balanceToQuarterTarget,
    }
}

export function sanitizeName(value: unknown): string {
    return String(value ?? "").trim()
}

export function sanitizeNumber(value: unknown): number {
    return toNumber(value)
}


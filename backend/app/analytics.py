"""Forecasting for bed occupancy and emergency load.

Matches the plan's staged approach: statistical (Holt-Winters style double
exponential smoothing with a weekly seasonal profile) now, ML-ready later.
Implemented in pure Python so the API image stays small.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import fmean, pstdev


@dataclass
class ForecastPoint:
    day: date
    value: float
    lower: float
    upper: float


def _weekly_profile(series: list[float], days: list[date]) -> list[float]:
    """Average multiplicative deviation per weekday (0=Monday)."""
    overall = fmean(series) or 1.0
    buckets: dict[int, list[float]] = {i: [] for i in range(7)}
    for value, day in zip(series, days, strict=True):
        buckets[day.weekday()].append(value / overall)
    return [fmean(buckets[i]) if buckets[i] else 1.0 for i in range(7)]


def holt_forecast(
    series: list[float],
    days: list[date],
    horizon: int = 14,
    alpha: float = 0.35,
    beta: float = 0.08,
    seasonal: bool = True,
) -> list[ForecastPoint]:
    """Double exponential smoothing plus an optional weekly seasonal index."""
    if len(series) < 8:
        last = series[-1] if series else 0.0
        start = (days[-1] if days else date.today()) + timedelta(days=1)
        return [ForecastPoint(start + timedelta(days=i), last, last * 0.9, last * 1.1) for i in range(horizon)]

    profile = _weekly_profile(series, days) if seasonal else [1.0] * 7
    deseasonalised = [v / profile[d.weekday()] for v, d in zip(series, days, strict=True)]

    level = deseasonalised[0]
    trend = deseasonalised[1] - deseasonalised[0]
    residuals: list[float] = []
    for value in deseasonalised[1:]:
        previous_level = level
        fitted = level + trend
        residuals.append(value - fitted)
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - previous_level) + (1 - beta) * trend

    # Damp the trend so long horizons do not run away.
    phi = 0.85
    sigma = pstdev(residuals) if len(residuals) > 1 else max(fmean(series) * 0.05, 1.0)
    last_day = days[-1]
    points: list[ForecastPoint] = []
    cumulative_phi = 0.0
    for step in range(1, horizon + 1):
        cumulative_phi += phi**step
        day = last_day + timedelta(days=step)
        base = (level + cumulative_phi * trend) * profile[day.weekday()]
        # A damped-trend model does not accumulate variance like a random walk,
        # so the interval widens slowly and is capped - an interval spanning the
        # whole axis is arithmetically defensible but tells an operations manager
        # nothing.
        growth = (1 + (step - 1) * 0.3) ** 0.5
        spread = min(1.96 * sigma * growth, base * 0.22)
        points.append(
            ForecastPoint(
                day=day,
                value=max(base, 0.0),
                lower=max(base - spread, 0.0),
                upper=max(base + spread, 0.0),
            )
        )
    return points


def trend_pct(series: list[float], window: int = 7) -> float:
    """Percent change of the last window versus the window before it."""
    if len(series) < window * 2:
        return 0.0
    recent = fmean(series[-window:])
    previous = fmean(series[-window * 2 : -window])
    if previous == 0:
        return 0.0
    return round((recent - previous) / previous * 100, 1)

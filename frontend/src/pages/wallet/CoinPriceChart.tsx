import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type ChartLinePoint = { time: number; value: number };
export type ChartCandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartScrubPoint = {
  time: number;
  price: number;
};

type Props = {
  style: "line" | "candle";
  points: ChartLinePoint[] | ChartCandlePoint[];
  /** Up = green, down = red (matches period change). */
  tone: "up" | "down" | "flat";
  onScrub?: (point: ChartScrubPoint | null) => void;
};

const UP = "#0d9488";
const DOWN = "#dc4446";
const FLAT = "#94a3b8";

function toneColor(tone: Props["tone"]): string {
  if (tone === "up") return readCssVar("--accent", UP);
  if (tone === "down") return DOWN;
  return FLAT;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toSeriesData(style: Props["style"], points: Props["points"]) {
  if (style === "candle") {
    return (points as ChartCandlePoint[]).map((p) => ({
      time: p.time as UTCTimestamp,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));
  }
  return (points as ChartLinePoint[]).map((p) => ({
    time: p.time as UTCTimestamp,
    value: p.value,
  }));
}

export function CoinPriceChart({ style, points, tone, onScrub }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> | null>(null);
  const styleRef = useRef(style);
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  // Create chart once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const textMuted = readCssVar("--text-muted", "rgba(148,163,184,0.75)");
    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight || 240,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: textMuted,
        attributionLogo: false,
        fontFamily: "inherit",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        visible: false,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          visible: true,
          labelVisible: false,
          width: 1,
          color: "rgba(148,163,184,0.65)",
          style: LineStyle.Dotted,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    const emitScrub = (param: {
      time?: Time;
      seriesData: Map<unknown, unknown>;
    }) => {
      const series = seriesRef.current;
      if (!series || param.time == null) {
        onScrubRef.current?.(null);
        return;
      }
      const raw = param.seriesData.get(series) as
        | { value?: number; close?: number; open?: number }
        | undefined;
      if (!raw) {
        onScrubRef.current?.(null);
        return;
      }
      const price =
        typeof raw.value === "number"
          ? raw.value
          : typeof raw.close === "number"
            ? raw.close
            : null;
      const time =
        typeof param.time === "number"
          ? param.time
          : typeof param.time === "string"
            ? Math.floor(Date.parse(param.time) / 1000)
            : null;
      if (price == null || time == null) {
        onScrubRef.current?.(null);
        return;
      }
      onScrubRef.current?.({ time, price });
    };

    chart.subscribeCrosshairMove(emitScrub);

    const clearScrub = () => {
      chart.clearCrosshairPosition();
      onScrubRef.current?.(null);
    };

    host.addEventListener("pointerup", clearScrub);
    host.addEventListener("pointercancel", clearScrub);
    host.addEventListener("pointerleave", clearScrub);
    host.addEventListener("touchend", clearScrub);
    host.addEventListener("touchcancel", clearScrub);

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight || 240,
      });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      host.removeEventListener("pointerup", clearScrub);
      host.removeEventListener("pointercancel", clearScrub);
      host.removeEventListener("pointerleave", clearScrub);
      host.removeEventListener("touchend", clearScrub);
      host.removeEventListener("touchcancel", clearScrub);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Sync series type + data + color without remounting the chart.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || points.length === 0) return;

    const color = toneColor(tone);
    const needsNewSeries = !seriesRef.current || styleRef.current !== style;

    if (needsNewSeries) {
      if (seriesRef.current) {
        chart.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
      styleRef.current = style;

      if (style === "candle") {
        const up = toneColor("up");
        seriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: up,
          downColor: DOWN,
          borderUpColor: up,
          borderDownColor: DOWN,
          wickUpColor: up,
          wickDownColor: DOWN,
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else {
        seriesRef.current = chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: `${color}47`,
          bottomColor: `${color}00`,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
      }
    } else if (style === "line" && seriesRef.current) {
      seriesRef.current.applyOptions({
        lineColor: color,
        topColor: `${color}47`,
        bottomColor: `${color}00`,
      });
    }

    const series = seriesRef.current;
    const data = toSeriesData(style, points);
    const frame = window.requestAnimationFrame(() => {
      series?.setData(data as never);
      chart.timeScale().fitContent();
      chart.clearCrosshairPosition();
      onScrubRef.current?.(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [points, style, tone]);

  return (
    <div
      ref={hostRef}
      className="coin-page__chart-canvas"
      dir="ltr"
    />
  );
}

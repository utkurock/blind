"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type CandlestickData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartStyleId } from "@/lib/palettes";

export type CandleInput = { time: number; open: number; high: number; low: number; close: number };

export type ChartHandle = {
  push: (candle: CandleInput) => void;
  pushBatch: (candles: CandleInput[]) => void;
  /** Replace ALL chart data with the provided candles (used when switching real-asset chart). */
  setSeed: (candles: CandleInput[]) => void;
  reset: () => void;
};

const MAX_CANDLES = 120;

type Theme = {
  bg: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  upRgba: (a: number) => string;
  downRgba: (a: number) => string;
  crosshair: string;
  crosshairLabel: string;
};

function tripletToRgb(triplet: string): string {
  return `rgb(${triplet.trim().replace(/\s+/g, ",")})`;
}
function tripletToRgba(triplet: string, alpha: number): string {
  return `rgba(${triplet.trim().replace(/\s+/g, ",")},${alpha})`;
}

function readPaletteColors(): Theme {
  const root = getComputedStyle(document.documentElement);
  const get = (n: string) => root.getPropertyValue(`--c-${n}`);
  const ink = get("ink");
  const dim = get("dim");
  const panel = get("panel");
  const long = get("long");
  const short = get("short");
  return {
    bg: tripletToRgb(panel),
    text: tripletToRgb(dim),
    grid: tripletToRgba(ink, 0.04),
    border: tripletToRgba(ink, 0.10),
    up: tripletToRgb(long),
    down: tripletToRgb(short),
    upRgba: (a: number) => tripletToRgba(long, a),
    downRgba: (a: number) => tripletToRgba(short, a),
    crosshair: tripletToRgba(ink, 0.25),
    crosshairLabel: tripletToRgb(dim),
  };
}

function makeSeries(chart: IChartApi, style: ChartStyleId, t: Theme): ISeriesApi<SeriesType> {
  switch (style) {
    case "bar":
      return chart.addBarSeries({
        upColor: t.up,
        downColor: t.down,
        thinBars: false,
      }) as ISeriesApi<SeriesType>;
    case "line":
      return chart.addLineSeries({
        color: t.up,
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      }) as ISeriesApi<SeriesType>;
    case "area":
      return chart.addAreaSeries({
        lineColor: t.up,
        topColor: t.upRgba(0.35),
        bottomColor: t.upRgba(0.0),
        lineWidth: 2,
      }) as ISeriesApi<SeriesType>;
    case "candle":
    default:
      return chart.addCandlestickSeries({
        upColor: t.up,
        downColor: t.down,
        borderUpColor: t.up,
        borderDownColor: t.down,
        wickUpColor: t.up,
        wickDownColor: t.down,
      }) as ISeriesApi<SeriesType>;
  }
}

function formatForStyle(ohlc: CandlestickData[], style: ChartStyleId): CandlestickData[] | LineData[] {
  if (style === "candle" || style === "bar") return ohlc;
  return ohlc.map((d) => ({ time: d.time, value: d.close })) as LineData[];
}

function applySeriesPaletteColors(
  series: ISeriesApi<SeriesType>,
  style: ChartStyleId,
  t: Theme,
) {
  if (style === "candle") {
    series.applyOptions({
      upColor: t.up,
      downColor: t.down,
      borderUpColor: t.up,
      borderDownColor: t.down,
      wickUpColor: t.up,
      wickDownColor: t.down,
    });
  } else if (style === "bar") {
    series.applyOptions({ upColor: t.up, downColor: t.down });
  } else if (style === "line") {
    series.applyOptions({ color: t.up });
  } else if (style === "area") {
    series.applyOptions({
      lineColor: t.up,
      topColor: t.upRgba(0.35),
      bottomColor: t.upRgba(0.0),
    });
  }
}

export const Chart = forwardRef<ChartHandle, { paletteId?: string; chartStyle?: ChartStyleId }>(
  function Chart({ paletteId = "noir", chartStyle = "candle" }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
    const dataRef = useRef<CandlestickData[]>([]);
    const styleRef = useRef<ChartStyleId>(chartStyle);

    // mount-only: create chart with initial theme; never recreated
    useEffect(() => {
      if (!containerRef.current) return;
      const t = readPaletteColors();
      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: t.bg },
          textColor: t.text,
          fontFamily: "JetBrains Mono, monospace",
        },
        grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
        rightPriceScale: { borderColor: t.border },
        timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: true },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
          horzLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    }, []);

    // palette change: just update options in place — no flicker, no resize jitter
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const t = readPaletteColors();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: t.bg },
          textColor: t.text,
          fontFamily: "JetBrains Mono, monospace",
        },
        grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
        rightPriceScale: { borderColor: t.border },
        timeScale: { borderColor: t.border },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
          horzLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
        },
      });
      if (seriesRef.current) {
        applySeriesPaletteColors(seriesRef.current, styleRef.current, t);
      }
    }, [paletteId]);

    // chart style change: swap the series, re-feed data in the right shape
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      if (seriesRef.current) {
        try { chart.removeSeries(seriesRef.current); } catch {}
        seriesRef.current = null;
      }
      const t = readPaletteColors();
      const series = makeSeries(chart, chartStyle, t);
      seriesRef.current = series;
      styleRef.current = chartStyle;
      if (dataRef.current.length > 0) {
        series.setData(formatForStyle(dataRef.current, chartStyle) as any);
        chart.timeScale().fitContent();
      }
    }, [chartStyle]);

    useImperativeHandle(ref, () => ({
      push(c) {
        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart) return;
        const arr = dataRef.current;
        const last = arr[arr.length - 1];
        let time = c.time;
        if (last && time <= (last.time as number)) time = (last.time as number) + 1;
        arr.push({
          time: time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
        if (arr.length > MAX_CANDLES) arr.shift();
        series.setData(formatForStyle(arr, styleRef.current) as any);
        chart.timeScale().fitContent();
      },
      pushBatch(candles) {
        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart) return;
        let lastT = dataRef.current[dataRef.current.length - 1]?.time as number | undefined;
        for (const c of candles) {
          let time = c.time;
          if (lastT != null && time <= lastT) time = lastT + 1;
          dataRef.current.push({
            time: time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          });
          lastT = time;
        }
        while (dataRef.current.length > MAX_CANDLES) dataRef.current.shift();
        series.setData(formatForStyle(dataRef.current, styleRef.current) as any);
        chart.timeScale().fitContent();
      },
      setSeed(candles) {
        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart) return;
        // sort + de-dup by time to satisfy lightweight-charts strict ordering
        const sorted = [...candles].sort((a, b) => a.time - b.time);
        const out: CandlestickData[] = [];
        let lastT = -Infinity;
        for (const c of sorted) {
          let time = c.time;
          if (time <= lastT) time = lastT + 1;
          out.push({
            time: time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          });
          lastT = time;
        }
        dataRef.current = out;
        while (dataRef.current.length > MAX_CANDLES) dataRef.current.shift();
        series.setData(formatForStyle(dataRef.current, styleRef.current) as any);
        chart.timeScale().fitContent();
      },
      reset() {
        dataRef.current = [];
        if (seriesRef.current) seriesRef.current.setData([] as any);
        chartRef.current?.timeScale().fitContent();
      },
    }));

    return <div ref={containerRef} className="h-full w-full" />;
  },
);

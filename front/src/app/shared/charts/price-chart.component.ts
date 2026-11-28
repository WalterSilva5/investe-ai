import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  input,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

/**
 * Gráfico de cotação: modo linha ou velas (candlestick, quando o provedor
 * entrega OHLC), com suportes/resistências marcados e médias móveis.
 */
@Component({
  selector: 'app-price-chart',
  imports: [NgxEchartsDirective],
  template: `
    <div
      #chartRef
      echarts
      [options]="options()"
      [autoResize]="true"
      class="echart"
      role="img"
      aria-label="Cotação"
    ></div>
  `,
})
export class PriceChartComponent implements AfterViewInit, OnDestroy {
  readonly labels = input<string[]>([]);
  readonly values = input<number[]>([]);
  readonly opens = input<number[]>([]);
  readonly highs = input<number[]>([]);
  readonly lows = input<number[]>([]);
  readonly supports = input<number[]>([]);
  readonly resistances = input<number[]>([]);
  readonly title = input('');
  /** 'line' (padrão) ou 'candle' — candle cai para linha sem OHLC. */
  readonly mode = input<'line' | 'candle'>('line');

  @ViewChild('chartRef', { static: true }) private chartRef?: ElementRef<HTMLElement>;
  @ViewChild(NgxEchartsDirective) private chart?: NgxEchartsDirective;
  private observer?: ResizeObserver;

  ngAfterViewInit() {
    const element = this.chartRef?.nativeElement;
    if (!element || typeof ResizeObserver === 'undefined') return;
    // O card costuma medir a largura depois do init; redesenha quando o layout assenta.
    this.observer = new ResizeObserver(() => {
      // resize dentro do próprio callback do observer gera loop: adia um frame
      requestAnimationFrame(() => this.chart?.resize());
    });
    this.observer.observe(element);
    requestAnimationFrame(() => this.chart?.resize());
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private ma(values: number[], n: number): Array<number | null> {
    return values.map((_, i) => {
      if (i < n - 1) return null;
      const slice = values.slice(i - n + 1, i + 1);
      return Math.round((slice.reduce((a, b) => a + b, 0) / n) * 100) / 100;
    });
  }

  readonly candleAvailable = computed<boolean>(() => {
    const values = this.values();
    return (
      this.mode() === 'candle' &&
      this.opens().length === values.length &&
      this.highs().length === values.length &&
      this.lows().length === values.length
    );
  });

  readonly options = computed<EChartsCoreOption>(() => {
    const values = this.values();
    const labels = this.labels();
    const candle = this.candleAvailable();
    // Velas no ECharts: cada ponto é [abertura, fechamento, mínimo, máximo].
    const candleData = candle
      ? values.map((_, i) => [
          this.opens()[i],
          values[i],
          this.lows()[i],
          this.highs()[i],
        ])
      : [];

    const priceSeries: Record<string, unknown> = {
      name: 'Preço',
      ...(candle
        ? {
            type: 'candlestick',
            data: candleData,
            itemStyle: {
              color: '#0f7b4f', // fechamento acima da abertura (alta)
              color0: '#b42318', // fechamento abaixo (queda)
              borderColor: '#0f7b4f',
              borderColor0: '#b42318',
            },
          }
        : { type: 'line', data: values, smooth: false, showSymbol: false }),
      // Suportes e resistências marcados por linhas tracejadas (nos dois modos).
      markLine: {
        symbol: 'none',
        data: [
          ...this.supports().map((v, i) => ({
            yAxis: v,
            lineStyle: { type: 'dashed' as const, color: '#0f7b4f' },
            label: { formatter: `S${i + 1} ${v}`, fontSize: 10 },
          })),
          ...this.resistances().map((v, i) => ({
            yAxis: v,
            lineStyle: { type: 'dashed' as const, color: '#b42318' },
            label: { formatter: `R${i + 1} ${v}`, fontSize: 10 },
          })),
        ],
      },
    };

    return {
      title: { text: this.title(), left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['Preço', 'MM20', 'MM50'] },
      grid: { left: 56, right: 20, top: 36, bottom: 52 },
      xAxis: { type: 'category', data: labels, boundaryGap: candle },
      yAxis: { type: 'value', scale: true },
      series: [
        priceSeries,
        {
          name: 'MM20',
          type: 'line',
          data: this.ma(values, 20),
          smooth: true,
          showSymbol: false,
          lineStyle: { type: 'dashed' as const, width: 1 },
        },
        {
          name: 'MM50',
          type: 'line',
          data: this.ma(values, 50),
          smooth: true,
          showSymbol: false,
          lineStyle: { type: 'dotted' as const, width: 1 },
        },
      ],
    };
  });
}

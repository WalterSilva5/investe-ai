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

/** Gráfico de cotação com suportes, resistências e médias móveis. */
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
  readonly supports = input<number[]>([]);
  readonly resistances = input<number[]>([]);
  readonly title = input('');

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

  readonly options = computed<EChartsCoreOption>(() => {
    const values = this.values();
    return {
      title: { text: this.title(), left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['Preço', 'MM20', 'MM50'] },
      grid: { left: 56, right: 20, top: 36, bottom: 52 },
      xAxis: { type: 'category', data: this.labels(), boundaryGap: false },
      yAxis: { type: 'value', scale: true },
      series: [
        {
          name: 'Preço',
          type: 'line',
          data: values,
          smooth: false,
          showSymbol: false,
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
        },
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

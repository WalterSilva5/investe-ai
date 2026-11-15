import { Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

/** Linha de evolução/projeção (ECharts). */
@Component({
  selector: 'app-trend-line',
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="options()" class="echart" role="img" aria-label="Evolução"></div>`,
})
export class TrendLineComponent {
  readonly labels = input<string[]>([]);
  readonly values = input<number[]>([]);
  readonly title = input('Evolução');

  readonly options = computed<EChartsCoreOption>(() => ({
    title: { text: this.title(), left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 44, bottom: 30 },
    xAxis: { type: 'category', data: this.labels(), boundaryGap: false },
    yAxis: { type: 'value', scale: true },
    series: [
      {
        type: 'line',
        data: this.values(),
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.15 },
      },
    ],
  }));
}

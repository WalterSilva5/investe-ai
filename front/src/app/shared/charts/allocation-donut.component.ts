import { Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

export interface DonutSlice {
  name: string;
  value: number;
}

/** Donut de alocação (ECharts) — sem dependência pesada no template. */
@Component({
  selector: 'app-allocation-donut',
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="options()" class="echart" role="img" aria-label="Alocação"></div>`,
})
export class AllocationDonutComponent {
  readonly data = input<DonutSlice[]>([]);
  readonly title = input('Alocação');

  readonly options = computed<EChartsCoreOption>(() => ({
    title: { text: this.title(), left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'item', valueFormatter: (v: unknown) => `${Number(v).toFixed(1)}%` },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{d}%', fontSize: 11 },
        data: this.data().map((d) => ({ name: d.name, value: Number(d.value.toFixed(2)) })),
      },
    ],
  }));
}

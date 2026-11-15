import { Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

export interface BarItem {
  name: string;
  current: number;
  target: number;
}

/** Barras atual × meta (rebalanceamento). */
@Component({
  selector: 'app-target-bars',
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="options()" class="echart" role="img" aria-label="Atual versus meta"></div>`,
})
export class TargetBarsComponent {
  readonly data = input<BarItem[]>([]);

  readonly options = computed<EChartsCoreOption>(() => {
    const items = this.data();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, data: ['Atual', 'Meta'] },
      grid: { left: 40, right: 16, top: 16, bottom: 48 },
      xAxis: { type: 'category', data: items.map((i) => i.name) },
      yAxis: { type: 'value' },
      series: [
        { name: 'Atual', type: 'bar', data: items.map((i) => i.current) },
        { name: 'Meta', type: 'bar', data: items.map((i) => i.target) },
      ],
    };
  });
}

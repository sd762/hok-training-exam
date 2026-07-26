import type { BarSeries } from './BarChart'

export const LANG_LABELS: Record<string, string> = { 'zh-TW': '繁體中文', vi: '越南文', id: '印尼文' }

// 固定順序，對應 index.css 的 --color-chart-1/2/3（驗證過的色盲安全順序，不可循環替換）
export const LANG_SERIES: BarSeries[] = [
  { key: 'zh-TW', label: '繁體中文', color: 'var(--color-chart-1)' },
  { key: 'vi', label: '越南文', color: 'var(--color-chart-2)' },
  { key: 'id', label: '印尼文', color: 'var(--color-chart-3)' },
]

import type { BarSeries } from './BarChart'

// 這裡的 lang_code（zh-TW/vi/id）在分析報表裡代表的是「國籍」，不是「使用語言」：
// 繁體中文＝台籍、越南文＝越南籍、印尼文＝印尼籍——三者一一對應，報表一律用國籍稱呼與框架呈現。
export const LANG_LABELS: Record<string, string> = { 'zh-TW': '台籍', vi: '越南籍', id: '印尼籍' }

// 固定順序，對應 index.css 的 --color-chart-1/2/3（驗證過的色盲安全順序，不可循環替換）
export const LANG_SERIES: BarSeries[] = [
  { key: 'zh-TW', label: '台籍', color: 'var(--color-chart-1)' },
  { key: 'vi', label: '越南籍', color: 'var(--color-chart-2)' },
  { key: 'id', label: '印尼籍', color: 'var(--color-chart-3)' },
]

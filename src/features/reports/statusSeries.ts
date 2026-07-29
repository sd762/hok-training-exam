import type { BarSeries } from './BarChart'

// 這裡用的是「狀態色」而不是國籍色——分析的是及格/不及格的組成，顏色代表結果狀態，
// 跟其他分頁用國籍上色的圖表是不同的語意，不能混用同一組色票。
// 「不及格」拆成「測驗未達標」跟「考試紀律違規」（監考機制自動中止），
// 狀態種類共6種，超過甜甜圈圖安全的3色上限（見 dataviz 技能 palette.md 的
// all-pairs 規則），凡是用到這組色票的圖表一律用堆疊柱狀圖，不用甜甜圈圖。
export const STATUS_SERIES: BarSeries[] = [
  { key: 'confirmed_passed', label: '已確認通過', color: 'var(--color-status-pass)' },
  { key: 'failed_score', label: '測驗未達標', color: 'var(--color-status-fail)' },
  { key: 'failed_violation', label: '考試紀律違規', color: 'var(--color-status-violation)' },
  { key: 'pending_review', label: '待核對', color: 'var(--color-status-pending)' },
  { key: 'flagged', label: '存疑保留', color: 'var(--color-status-flagged)' },
  { key: 'voided', label: '已作廢', color: 'var(--color-ink-muted)' },
]

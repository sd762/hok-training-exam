// 受訓階段共用常數。
//
// ⚠️ 目前透過 Supabase Dashboard「Via Editor」逐一貼上單一檔案部署，這種方式
// 沒辦法連同這個 `_shared` 資料夾一起上傳，所以 take-exam 與 check-notifications
// 目前都是「各自在自己的 index.ts 內重複定義同一份常數」，並未實際從這裡匯入。
// 這個檔案先留著當作單一事實來源的參考／之後改用 Supabase CLI 部署時的匯入來源；
// 若修改這裡的階段規則，記得同步更新兩支函式各自內嵌的那份常數，否則會漂移不一致。

export const STAGE_ORDER = ['1m', '3m', '1y'] as const
export type Stage = (typeof STAGE_ORDER)[number]
export const STAGE_MONTHS: Record<Stage, number> = { '1m': 1, '3m': 3, '1y': 12 }
export const STAGE_LABELS: Record<Stage, string> = {
  '1m': '到職滿1個月',
  '3m': '到職滿3個月',
  '1y': '到職滿1年',
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

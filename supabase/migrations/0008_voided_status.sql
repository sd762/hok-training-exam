-- 0008: 新增 voided 狀態
-- 對應工單 07 留下的缺口與工單 10 的審查流程：存疑保留最終被判定不合格時，
-- 不能算成 'failed'（那會被 getCycleStatus 誤算進連續失敗次數，違反 ADR 0006
-- 「不追溯扣考試機會、視為作廢重新計算」的規則），需要一個獨立狀態。

alter type attempt_status add value 'voided';

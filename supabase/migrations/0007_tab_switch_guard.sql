-- 0007: 監考事件類型新增「切換視窗/離開頁面」
-- 對應 ADR 0005 進一步修訂：切換視窗、最小化、開啟其他分頁/App 視為違規，
-- 第 1 次警告、第 2 次直接中止（門檻比人臉偵測的 3 次更嚴格）。

alter type proctoring_event_type add value 'tab_switch';

-- 切換視窗事件發生時分頁可能已被隱藏，鏡頭畫面不一定拍得到，允許沒有快照也能記錄事件
alter table proctoring_event alter column storage_path drop not null;

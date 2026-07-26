-- 0013: 修正機構分類——1/2/3館歸類到法人館，清系列歸類到養護機構
--
-- 使用者發現資料匯入時機構的類別分錯了：「1館/2館/3館」目前不是掛在
-- 「法人館」類別底下、「清X」系列不是掛在「養護機構」類別底下。這是資料本身
-- 的問題（institution.category_id 指錯類別），不是程式邏輯錯誤，用 UPDATE 修正。

update institution
set category_id = (select id from institution_category where name = '法人館')
where name in ('1館', '2館', '3館');

update institution
set category_id = (select id from institution_category where name = '養護機構')
where name like '清%';

-- 執行完後可用這段確認每個機構現在掛在哪個類別下
select c.name as category, i.name as institution, i.sort_order
from institution i
join institution_category c on c.id = i.category_id
order by c.sort_order, c.id, i.sort_order, i.id;

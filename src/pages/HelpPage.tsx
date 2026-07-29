import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/auth/useAuth'
import { canViewReports, canWrite } from '@/lib/roles'

/**
 * 使用說明頁——依角色只顯示相關的段落，用原生 <details> 折疊，不用額外狀態管理。
 * 內容要跟著功能異動更新，不要讓這裡變成另一份過時的文件。
 */
export default function HelpPage() {
  const { profile } = useAuth()
  if (!profile) return null

  const isStaff = profile.role === 'staff'
  const writable = canWrite(profile.role)
  const canReport = canViewReports(profile.role)
  const isSuperAdmin = profile.role === 'super_admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">使用說明</h1>
        <p className="mt-1 text-sm text-ink-muted">依你目前的角色只顯示相關的段落。</p>
      </div>

      <Section title="帳號與登入" defaultOpen>
        <ul className="list-disc space-y-1 pl-5">
          <li>登入一律用「帳號代碼」（學員是工號），不是 email。</li>
          <li>
            忘記密碼要請管理者在對應的管理頁面點「重設密碼」，會恢復成預設密碼
            <code className="mx-1 rounded bg-surface-muted px-1.5 py-0.5">000000</code>
            。目前系統沒有自己修改密碼的功能，重設後密碼就是這組，如果需要保密性更高的做法，之後可以再請開發加上「登入後自行改密碼」。
          </li>
          <li>新建立的帳號（不管是學員還是管理者），預設密碼也是 000000，建立成功時畫面會直接顯示一次。</li>
        </ul>
      </Section>

      {isStaff && (
        <Section title="學員：如何應考" defaultOpen>
          <StudentGuide />
        </Section>
      )}
      {!isStaff && (
        <Section title="學員應考流程（供協助排除問題參考）">
          <StudentGuide />
        </Section>
      )}

      {writable && (
        <Section title="學員管理">
          <ul className="list-disc space-y-1 pl-5">
            <li>學員依「機構類別 → 機構」分資料夾呈現，點機構名稱展開/收合，標題旁顯示人數。</li>
            <li>上方搜尋框可以用工號／姓名／母語姓名找人，搜尋時會自動展開有符合結果的機構。</li>
            <li>新增/編輯學員時：「國籍」是台籍／越南籍／印尼籍（不是語言）；「部門」固定四選項（生福課／行政一課／行政二課／人事課）；「出生年月日」務必填寫，沒填的話該學員不會被計入國籍與年齡分布報表。</li>
            <li>
              批次匯入：先按「下載範本」，範本裡有第二個分頁「可用選項對照表」，列出目前系統實際有效的機構/國籍/部門/階段選項，照抄可以減少打錯字造成匯入失敗。
            </li>
            <li>在職學員只能停用不能刪除；已停用的學員才能刪除，避免誤刪還有歷史紀錄關聯的帳號。</li>
          </ul>
        </Section>
      )}

      {writable && (
        <Section title="機構管理">
          <ul className="list-disc space-y-1 pl-5">
            <li>機構分兩層：機構類別（護理之家／法人館／養護機構）底下各自有機構名稱。</li>
            <li>停用機構後，不會再出現在「指派學員機構」等下拉選單，但既有指向該機構的歷史資料不受影響、不會消失或報錯。</li>
          </ul>
        </Section>
      )}

      {writable && (
        <Section title="題庫管理">
          <ul className="list-disc space-y-1 pl-5">
            <li>繁體中文／越南文／印尼文是三份完全獨立的題庫，題目內容、題數都不需要對應，互不影響。</li>
            <li>
              <strong>音訊題（聽力題）</strong>：只有越南文／印尼文能加，台籍不考。播放一段情境音效，問「這是什麼情境」；可以無限重聽。新增題目時可以上傳新音檔，或選一個已經上傳過的音檔重複使用（同一段情境音效不用因為語言不同重錄）。25題裡音訊題庫滿5題時，固定抽5題音訊+20題一般題；音訊題還沒建滿5題以前，維持全部從一般題庫抽25題。
            </li>
            <li>
              <strong>圖片題</strong>：三語言都能用。題目本身可以配一張圖，每個選項也可以各自配一張圖片（例如「在幾張圖片中選出正確的」這種題型）。跟音訊題一樣可以上傳新圖或重複使用已上傳過的圖片。圖片題不保證固定題數，隨機出現即可。
            </li>
            <li>Excel 批次匯入僅支援純文字題，音訊/圖片目前只能透過單題新增表單建立。</li>
            <li>停用某一題後不會再出現在後續抽題結果中，但既有考試紀錄的歷史快照不受影響。</li>
          </ul>
        </Section>
      )}

      {writable && (
        <Section title="管理者帳號">
          <ul className="list-disc space-y-1 pl-5">
            <li>用來建立系統管理者／平台管理者／管理者／機構管理者這四種帳號（學員帳號在「學員管理」建立）。</li>
            {isSuperAdmin ? (
              <li>你是系統管理者，四種角色都可以建立/編輯。</li>
            ) : (
              <li>平台管理者只能建立/編輯機構管理者帳號；系統管理者、平台管理者、管理者這三種帳號只有系統管理者能異動。</li>
            )}
          </ul>
        </Section>
      )}

      {writable && (
        <Section title="及格審查">
          <ul className="list-disc space-y-1 pl-5">
            <li>學員及格後，作答狀態先進入「待核對」，會出現在審查佇列，可以查看監考快照與疑似違規事件。</li>
            <li>「核對無誤」→ 狀態變「已確認通過」，正式納入及格紀錄，該學員可以推進到下一受訓階段。</li>
            <li>「存疑保留」→ 保留證據待進一步調查，該學員無法推進到下一階段；最終被判定不合格時視為作廢重算，不會追溯扣掉考試機會。</li>
          </ul>
        </Section>
      )}

      {writable && (
        <Section title="通知設定">
          <ul className="list-disc space-y-1 pl-5">
            <li>學員到職滿1個月/3個月/1年前3天，系統會通知該學員所屬機構的機構管理者（收件地址是機構管理者帳號上的聯絡信箱）。</li>
            <li>要先在這頁填好 SMTP 寄信設定（主機/連接埠/帳號/密碼/寄件人/TLS）才能真正寄出信，沒設定的話系統仍會照常檢查、只是標示「未設定SMTP」不會整批失敗。</li>
            <li>「立即檢查一次」可以手動觸發，不用等每天固定的排程時間。</li>
            <li>同一位學員同一階段只會通知一次，不會重複寄信。</li>
          </ul>
        </Section>
      )}

      {canReport && (
        <Section title="分析報表">
          <ul className="list-disc space-y-1 pl-5">
            <li>每個分頁都有「機構」「國籍」兩個篩選：都不篩＝全院總況；篩一個＝跨機構或跨國籍比較；篩兩個都選＝單一機構+單一國籍的細節。</li>
            <li>圖表形式會自動切換：選定單一機構時看到的是甜甜圈圖（一眼看佔比）；沒選機構、要比較多個機構時看到的是長條/柱狀圖。</li>
            <li>右上角「列印報表」會隱藏篩選列跟導覽列，只印圖表跟表格，方便印出來或存成 PDF。</li>
            <li>機構管理者登入只會看到自己機構的資料；「管理者」角色看得到全部機構，但沒有任何新增/修改的操作權限。</li>
          </ul>
        </Section>
      )}
    </div>
  )
}

function StudentGuide() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>登入後首頁會顯示「目前應考測驗」提醒（如果有應考義務）。</li>
      <li>開考前會先看到鏡頭監考同意書，需要明確同意才能進入測驗畫面。</li>
      <li>
        測驗全程鏡頭持續開啟：人臉在畫面中消失超過3秒會出現警示，累積3次自動中止並計入一次失敗；切換視窗、最小化、離開頁面第1次會警告，第2次直接中止並計入一次失敗。
      </li>
      <li>依序作答25題，題型有單選/複選；有些題目會附音訊（可以無限重聽）或圖片（題目配圖，或選項本身就是圖片）。</li>
      <li>送出後立即看到分數與及格/不及格；不及格的話會顯示剩餘重考次數，同一輪3次都沒過要鎖定7天才能再考。</li>
      <li>及格後狀態會先變成「待核對」，要等管理者審查確認「已確認通過」，才會正式算及格、才能進到下一個受訓階段。</li>
      <li>作答畫面的語言（繁中/越南文/印尼文）是系統依你帳號設定的國籍自動顯示，不用自己切換。</li>
      <li>作答到一半重新整理頁面或關閉瀏覽器，重新登入可以繼續同一次未完成的測驗。</li>
    </ul>
  )
}

function Section({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <details open={defaultOpen}>
        <summary className="cursor-pointer list-none px-5 py-3 font-medium hover:bg-surface-muted">
          {title}
        </summary>
        <div className="border-t border-line px-5 py-4 text-sm leading-relaxed text-ink">{children}</div>
      </details>
    </Card>
  )
}

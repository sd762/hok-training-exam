import { Card } from '@/components/ui/Card'
import { useAuth } from '@/auth/useAuth'
import { ROLE_LABELS, canWrite } from '@/lib/roles'

/**
 * 登入後的落地頁。各角色的功能入口在頂部導覽列，
 * 此頁顯示身分摘要與後續會陸續補上的提示。
 */
export default function HomePage() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">後台首頁</h1>
        <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-sm text-ink-muted">帳號</dt>
          <dd className="font-medium">{profile.account_code}</dd>
          <dt className="text-sm text-ink-muted">姓名</dt>
          <dd className="font-medium">{profile.display_name}</dd>
          <dt className="text-sm text-ink-muted">角色</dt>
          <dd className="font-medium">{ROLE_LABELS[profile.role]}</dd>
        </dl>
      </Card>

      {canWrite(profile.role) && (
        <Card className="p-6">
          <h2 className="font-medium">開始使用</h2>
          <p className="mt-1 text-sm text-ink-muted">
            可從上方「學員管理」維護學員名單、「機構管理」維護機構清單。題庫管理等功能將陸續上線。
          </p>
        </Card>
      )}
    </div>
  )
}

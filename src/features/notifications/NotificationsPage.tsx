import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  fetchNotificationLog,
  fetchSmtpSettings,
  saveSmtpSettings,
  triggerNotificationCheck,
  type NotificationLogRow,
  type SmtpSettings,
  type TriggerCheckResult,
} from './api'

const STAGE_LABELS: Record<string, string> = { '1m': '到職滿1個月', '3m': '到職滿3個月', '1y': '到職滿1年' }

const STATUS_LABELS: Record<string, string> = {
  sent: '已寄出',
  smtp_not_configured: '未設定SMTP',
  no_managers: '無機構管理者',
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<SmtpSettings | null>(null)
  const [log, setLog] = useState<NotificationLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<TriggerCheckResult | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [s, l] = await Promise.all([fetchSmtpSettings(), fetchNotificationLog()])
      setSettings(s)
      setLog(l)
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await saveSmtpSettings(settings)
      setNotice('SMTP 設定已儲存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleTrigger() {
    setChecking(true)
    setError(null)
    setCheckResult(null)
    try {
      const res = await triggerNotificationCheck()
      setCheckResult(res)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '觸發檢查失敗')
    } finally {
      setChecking(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        載入中…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">到期通知設定</h1>
        <p className="mt-1 text-sm text-ink-muted">
          里程碑前 3 天進入通知窗口，寄信給該學員所屬機構的機構管理者；同一學員同一階段只通知一次。
        </p>
      </div>

      {error && (
        <Card className="border-status-fail/30 bg-status-fail/5 p-4 text-sm text-status-fail">{error}</Card>
      )}
      {notice && (
        <Card className="border-status-pass/30 bg-status-pass/5 p-4 text-sm text-status-pass">{notice}</Card>
      )}

      <Card className="space-y-4 p-5">
        <h2 className="font-medium">SMTP 寄信設定</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="主機">
            <Input value={settings.smtp_host} onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })} />
          </Field>
          <Field label="連接埠">
            <Input value={settings.smtp_port} onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })} />
          </Field>
          <Field label="帳號">
            <Input
              value={settings.smtp_username}
              onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
            />
          </Field>
          <Field label="密碼">
            <Input
              type="password"
              value={settings.smtp_password}
              onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
            />
          </Field>
          <Field label="寄件人 Email">
            <Input
              value={settings.smtp_sender}
              onChange={(e) => setSettings({ ...settings, smtp_sender: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={settings.smtp_use_tls}
              onChange={(e) => setSettings({ ...settings, smtp_use_tls: e.target.checked })}
            />
            使用 TLS
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            儲存設定
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">手動觸發檢查</h2>
          <Button variant="outline" onClick={handleTrigger} loading={checking}>
            立即檢查一次
          </Button>
        </div>
        {checkResult && (
          <div className="mt-4 text-sm">
            <p className="text-ink-muted">本次檢查共處理 {checkResult.checked} 筆</p>
            {checkResult.results.length > 0 && (
              <ul className="mt-2 space-y-1">
                {checkResult.results.map((r, i) => (
                  <li key={i}>
                    {r.account_code} · {r.stage} · {STATUS_LABELS[r.status] ?? r.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-muted text-left text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-medium">工號</th>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">階段</th>
              <th className="px-4 py-2 font-medium">里程碑日</th>
              <th className="px-4 py-2 font-medium">寄送時間</th>
              <th className="px-4 py-2 font-medium">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {log.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  尚無通知紀錄
                </td>
              </tr>
            )}
            {log.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2">{row.staff_account_code}</td>
                <td className="px-4 py-2">{row.staff_name}</td>
                <td className="px-4 py-2">{STAGE_LABELS[row.stage_code] ?? row.stage_code}</td>
                <td className="px-4 py-2">{row.milestone_date}</td>
                <td className="px-4 py-2">{new Date(row.sent_at).toLocaleString()}</td>
                <td className="px-4 py-2">{STATUS_LABELS[row.status] ?? row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

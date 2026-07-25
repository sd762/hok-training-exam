import { supabase } from '@/lib/supabase'
import { callCheckNotifications } from '@/lib/edge-functions'

export interface SmtpSettings {
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  smtp_sender: string
  smtp_use_tls: boolean
}

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_sender', 'smtp_use_tls'] as const

export async function fetchSmtpSettings(): Promise<SmtpSettings> {
  const { data, error } = await supabase.from('system_setting').select('key, value').in('key', SMTP_KEYS)
  if (error) throw error
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']))
  return {
    smtp_host: map.smtp_host ?? '',
    smtp_port: map.smtp_port ?? '587',
    smtp_username: map.smtp_username ?? '',
    smtp_password: map.smtp_password ?? '',
    smtp_sender: map.smtp_sender ?? '',
    smtp_use_tls: (map.smtp_use_tls ?? '1') === '1',
  }
}

export async function saveSmtpSettings(settings: SmtpSettings): Promise<void> {
  const rows = [
    { key: 'smtp_host', value: settings.smtp_host },
    { key: 'smtp_port', value: settings.smtp_port },
    { key: 'smtp_username', value: settings.smtp_username },
    { key: 'smtp_password', value: settings.smtp_password },
    { key: 'smtp_sender', value: settings.smtp_sender },
    { key: 'smtp_use_tls', value: settings.smtp_use_tls ? '1' : '0' },
  ]
  const { error } = await supabase.from('system_setting').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

export interface NotificationLogRow {
  id: number
  staff_account_code: string
  staff_name: string
  stage_code: string
  milestone_date: string
  sent_at: string
  recipients: string | null
  status: string
}

interface RawLogRow {
  id: number
  stage_code: string
  milestone_date: string
  sent_at: string
  recipients: string | null
  status: string
  profiles: { account_code: string; display_name: string } | null
}

export async function fetchNotificationLog(): Promise<NotificationLogRow[]> {
  const { data, error } = await supabase
    .from('notification_log')
    .select(
      `id, stage_code, milestone_date, sent_at, recipients, status,
       profiles:staff_id ( account_code, display_name )`,
    )
    .order('sent_at', { ascending: false })
    .limit(200)
  if (error) throw error

  return (data as unknown as RawLogRow[]).map((row) => ({
    id: row.id,
    staff_account_code: row.profiles?.account_code ?? '-',
    staff_name: row.profiles?.display_name ?? '(未知)',
    stage_code: row.stage_code,
    milestone_date: row.milestone_date,
    sent_at: row.sent_at,
    recipients: row.recipients,
    status: row.status,
  }))
}

export interface TriggerCheckResult {
  ok: boolean
  checked: number
  results: { account_code: string; stage: string; status: string }[]
}

export async function triggerNotificationCheck(): Promise<TriggerCheckResult> {
  return callCheckNotifications<TriggerCheckResult>()
}

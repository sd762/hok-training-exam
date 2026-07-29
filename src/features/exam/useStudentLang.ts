import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import type { LangCode } from '@/lib/i18n'
import { translate, type TranslationKey } from '@/lib/i18n'
import { fetchOwnLangCode } from './api'

/** 學員本人的語言別 + 對應的翻譯函式，載入完成前先以繁中顯示 */
export function useStudentLang() {
  const { profile } = useAuth()
  const [lang, setLang] = useState<LangCode>('zh-TW')

  useEffect(() => {
    // 只有學員在 staff_detail 有語言別紀錄；其他角色沒有這張表的資料列，
    // 硬查會因為 .single() 找不到剛好一筆而丟例外，直接跳過、維持預設繁中
    if (!profile || profile.role !== 'staff') return
    let active = true
    fetchOwnLangCode(profile.id).then((code) => {
      if (active) setLang(code)
    })
    return () => {
      active = false
    }
  }, [profile])

  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  return { lang, t }
}

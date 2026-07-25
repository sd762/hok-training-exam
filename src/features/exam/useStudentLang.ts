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
    if (!profile) return
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

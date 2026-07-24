import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { accountCodeToEmail } from '@/lib/account-code'
import type { Profile } from '@/lib/roles'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (accountCode: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

/** 登入失敗一律回報同一段訊息，避免洩漏帳號代碼是否存在 */
const SIGN_IN_ERROR = '帳號或密碼錯誤，請重新輸入'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, account_code, display_name, role, institution_id, contact_email, is_active')
      .eq('id', userId)
      .maybeSingle()
    return data as Profile | null
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      setProfile(data.session ? await loadProfile(data.session.user.id) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return
      setSession(next)
      setProfile(next ? await loadProfile(next.user.id) : null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (accountCode: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: accountCodeToEmail(accountCode),
        password,
      })
      if (error || !data.user) throw new Error(SIGN_IN_ERROR)

      // 帳號存在但已停用（離職等）時，不讓其停留在登入狀態
      const loaded = await loadProfile(data.user.id)
      if (!loaded || !loaded.is_active) {
        await supabase.auth.signOut()
        throw new Error(SIGN_IN_ERROR)
      }
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ session, profile, loading, signIn, signOut }),
    [session, profile, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

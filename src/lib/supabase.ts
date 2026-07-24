import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    '缺少 Supabase 連線設定，請確認 .env 已填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY',
  )
}

export const supabase = createClient(url, publishableKey)

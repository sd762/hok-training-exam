import { useEffect } from 'react'
import type { RefObject } from 'react'
import { reportProctoringEvent } from './api'
import { captureFrameAsJpegBase64 } from './proctoring'

/**
 * 切換分頁、最小化視窗、切到其他 App 都視為離開測驗畫面（ADR 0005 進一步修訂）：
 * 第 1 次警告，第 2 次直接中止——比人臉偵測的 3 次緩衝更嚴格，因為誤判風險較低
 * （沒有光線、姿勢這類環境因素會誤觸發）。中止判定同樣交給伺服器端權威處理。
 */
export function useTabSwitchGuard(
  attemptId: number | null,
  videoRef: RefObject<HTMLVideoElement | null>,
  onWarning: () => void,
  onAborted: () => void,
) {
  useEffect(() => {
    if (!attemptId) return

    // visibilitychange 與 blur 常常會為同一次切換動作同時觸發，
    // 用短暫的防抖避免同一次離開被回報成兩次事件
    let reporting = false

    async function handleLeave() {
      if (reporting) return
      reporting = true
      try {
        const video = videoRef.current
        const image = video && video.readyState >= 2 ? captureFrameAsJpegBase64(video) : undefined
        const res = await reportProctoringEvent(attemptId!, 'tab_switch', image)
        if (res.aborted) onAborted()
        else onWarning()
      } catch (err) {
        console.error('回報切換視窗事件失敗：', err)
      } finally {
        setTimeout(() => {
          reporting = false
        }, 2000)
      }
    }

    function onVisibilityChange() {
      if (document.hidden) void handleLeave()
    }
    function onBlur() {
      void handleLeave()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])
}

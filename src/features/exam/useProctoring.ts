import { useEffect, useRef, useState } from 'react'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { reportProctoringEvent } from './api'
import {
  captureFrameAsJpegBase64,
  createFaceDetector,
  DETECTION_INTERVAL_MS,
  FACE_MISSING_WARNING_MS,
  SCHEDULED_SNAPSHOT_SECONDS,
} from './proctoring'

/**
 * 監考主迴圈：持續偵測畫面中有沒有人臉、定期擷取存證快照，
 * 判定邏輯（累積滿3次警告即中止）交給伺服器端（Edge Function），
 * 這裡只負責偵測、拍照、回報，不自己決定「中止」。
 */
export function useProctoring(
  stream: MediaStream | null,
  attemptId: number | null,
  onAborted: () => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showFaceWarning, setShowFaceWarning] = useState(false)

  useEffect(() => {
    if (!stream || !attemptId) return

    let stopped = false
    let detector: FaceDetector | null = null
    let intervalId: number | undefined
    let missingSince: number | null = null
    const startedAt = Date.now()
    const firedCheckpoints = new Set<number>()

    async function setup() {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {
          /* 某些瀏覽器的自動播放限制，靜音影片通常沒問題，失敗就忽略 */
        })
      }

      detector = await createFaceDetector()
      if (stopped) {
        detector.close()
        return
      }

      intervalId = window.setInterval(() => {
        tick().catch((err) => console.error('人臉偵測迴圈發生錯誤：', err))
      }, DETECTION_INTERVAL_MS)
    }

    async function tick() {
      const video = videoRef.current
      if (stopped || !video || !detector || video.readyState < 2 || !attemptId) return

      const result = detector.detectForVideo(video, performance.now())
      const hasFace = result.detections.length > 0

      if (hasFace) {
        missingSince = null
        setShowFaceWarning(false)
      } else {
        if (missingSince === null) missingSince = Date.now()
        if (Date.now() - missingSince >= FACE_MISSING_WARNING_MS) {
          setShowFaceWarning(true)
          missingSince = Date.now() // 重新計時，避免每個 tick 都連續回報警告
          const image = captureFrameAsJpegBase64(video)
          try {
            const res = await reportProctoringEvent(attemptId, 'warning', image)
            if (res.aborted) {
              stopped = true
              onAborted()
            }
          } catch (err) {
            console.error('回報監考警告失敗：', err)
          }
        }
      }

      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000)
      for (const checkpoint of SCHEDULED_SNAPSHOT_SECONDS) {
        if (elapsedSec >= checkpoint && !firedCheckpoints.has(checkpoint)) {
          firedCheckpoints.add(checkpoint)
          const image = captureFrameAsJpegBase64(video)
          reportProctoringEvent(attemptId, 'scheduled', image).catch((err) =>
            console.error('回報定期快照失敗：', err),
          )
        }
      }
    }

    setup().catch((err) => console.error('監考鏡頭初始化失敗：', err))

    return () => {
      stopped = true
      if (intervalId) window.clearInterval(intervalId)
      detector?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, attemptId])

  return { videoRef, showFaceWarning }
}

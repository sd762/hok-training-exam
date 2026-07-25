// 鏡頭監考的底層工具（人臉偵測、擷取畫面）。
// 模型與 WASM 執行環境從 Google/CDN 載入，不打包進本專案的 bundle（避免拖慢一般頁面載入）。
// 只做「畫面中有沒有偵測到人臉」，不做身分比對（見 ADR 0005 的範圍限制說明）。

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite'

export async function createFaceDetector(): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: 'VIDEO',
  })
}

/** 擷取目前影格為壓縮過的 JPEG，回傳不含 data URL 前綴的 base64（依使用者要求：檔案不要過大） */
export function captureFrameAsJpegBase64(video: HTMLVideoElement, maxWidth = 320, quality = 0.6): string {
  const scale = Math.min(1, maxWidth / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality).split(',')[1]
}

/** 作答開始後第 60/120/240/480/960 秒各拍一張存證（ADR 0005 2026-07-25 修訂） */
export const SCHEDULED_SNAPSHOT_SECONDS = [60, 120, 240, 480, 960]

export const FACE_MISSING_WARNING_MS = 3000
export const DETECTION_INTERVAL_MS = 1000

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 沒有這層防護時，畫面任何一處未被接住的例外都會讓 React 整棵樹卸載，
 * 使用者只會看到一片空白（工單09實測時發生過一次），連錯誤訊息都看不到。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('未預期的畫面錯誤：', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <Card className="max-w-md p-6 text-center">
            <h1 className="text-lg font-semibold text-status-fail">發生錯誤</h1>
            <p className="mt-2 text-sm text-ink-muted">畫面發生未預期的錯誤，請重新整理頁面再試一次。</p>
            <p className="mt-2 break-all text-xs text-ink-muted">{this.state.error.message}</p>
            <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
              重新整理
            </Button>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}

import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 요리비서',
  description: '냉장고 속 재료로 만드는 맞춤 레시피',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-2xl p-4">
          <header className="py-4 mb-6 border-b">
            <h1 className="text-2xl font-bold">AI 요리비서</h1>
            <p className="text-sm text-neutral-600">재료 또는 요리명으로 레시피를 찾아보세요</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}


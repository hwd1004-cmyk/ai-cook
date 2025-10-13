import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 요리비서',
  description: '냉장고 속 재료로 만드는 맞춤 레시피',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white text-neutral-900 antialiased">
        <div className="mx-auto max-w-3xl px-4">
          {/* Topbar */}
          <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
            <div className="max-w-3xl mx-auto px-1 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white grid place-content-center font-bold">Ai</div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">AI 요리비서</h1>
                  <p className="text-xs text-neutral-600">재료 또는 요리명으로 레시피를 찾아보세요</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-600">
                <span className="px-2 py-1 rounded-full border bg-white">베타</span>
              </div>
            </div>
          </header>

          {/* Page container */}
          <main className="py-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="py-8 text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} AI-Cook · 집밥을 더 쉽고 즐겁게
          </footer>
        </div>
      </body>
    </html>
  )
}

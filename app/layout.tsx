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
        <div className="mx-auto max-w-4xl px-4">
          {/* Topbar */}
          <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-neutral-200/60 shadow-sm">
            <div className="max-w-4xl mx-auto flex items-center justify-between px-3 py-4 md:py-5 gap-y-2 flex-wrap">
              <div className="flex items-center gap-4">
                {/* 로고 */}
                <div className="h-14 w-14 md:h-16 md:w-16 rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center">
                  <img
                    src="/chefbot.jpeg"
                    alt="AI 요리비서 로고"
                    className="object-contain h-full w-full"
                  />
                </div>

                {/* 타이틀 & 서브텍스트 */}
                <div className="leading-tight">
                  <h1 className="text-xl md:text-2xl font-bold text-emerald-800">AI 요리비서</h1>
                  <p className="text-sm md:text-base text-neutral-600">
                    재료 또는 요리명으로 레시피를 찾아보세요
                  </p>

                  {/* ✅ 모바일 전용 배지 (sm 미만에서 표시) */}
                  <div className="sm:hidden mt-2">
                    <span className="inline-block px-2.5 py-1 rounded-full border bg-white shadow-sm text-[11px] text-neutral-700">
                      생성형AI기반 비즈니스 - <span className="text-emerald-700 font-semibold">Group 1</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ✅ 데스크톱 전용 배지 (sm 이상에서 표시) */}
              <div className="hidden sm:flex items-center gap-2 text-[11px] md:text-xs text-neutral-600 font-medium tracking-tight">
                <span className="px-3 py-1 rounded-full border bg-white shadow-sm whitespace-nowrap">
                  생성형AI기반 비즈니스 - <span className="text-emerald-700 font-semibold">Group 1</span>
                </span>
              </div>
            </div>
          </header>

          {/* Page */}
          <main className="py-8 md:py-10">
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

import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 요리비서',
  description: '냉장고 속 재료로 만드는 맞춤 레시피',
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-amber-50/30 text-neutral-900 antialiased">
        <div className="mx-auto max-w-4xl px-4 flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-neutral-200/70 shadow-sm">
            <div className="max-w-4xl mx-auto flex items-center justify-between px-3 py-3 md:py-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 md:h-16 md:w-16 rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                  <img
                    src="/chefbot.jpeg"
                    alt="AI 요리비서 로고"
                    className="object-contain h-full w-full"
                  />
                </div>
                <div className="leading-tight">
                  <h1 className="text-xl md:text-2xl font-bold text-emerald-800 tracking-tight">
                    AI 요리비서
                  </h1>
                  <p className="text-sm md:text-base text-neutral-600">
                    재료 또는 요리명으로 레시피를 찾아보세요
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center text-xs text-neutral-600 font-medium tracking-tight">
                <span className="px-3 py-1 rounded-full border border-neutral-200 bg-white shadow-sm">
                  생성형AI기반 비즈니스 - <span className="text-emerald-700 font-semibold">Group 1</span>
                </span>
              </div>
            </div>
          </header>

          {/* Main */}
          <main className="flex-grow py-10 md:py-12 relative">
            {/* ✨ 메인 배경 영역 */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 via-white to-amber-50/40" />
              <div className="absolute top-[20%] left-[15%] h-64 w-64 bg-emerald-200/20 blur-3xl rounded-full" />
              <div className="absolute bottom-[15%] right-[10%] h-72 w-72 bg-amber-200/30 blur-3xl rounded-full" />
            </div>

            {/* 콘텐츠 */}
            <div className="relative z-10">{children}</div>
          </main>

          {/* Footer */}
          <footer className="relative mt-10 text-center">
            <div className="h-[3px] bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 rounded-full mb-4 opacity-70" />
            <div className="text-xs text-neutral-500 space-y-1">
              <p>© {new Date().getFullYear()} <span className="font-medium text-neutral-600">AI-Cook</span> · 집밥을 더 쉽고 즐겁게</p>
              <p className="text-[11px] text-neutral-400">
                Developed by Group 1 · Yonsei AMBA “Generative AI 기반 비즈니스”
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}

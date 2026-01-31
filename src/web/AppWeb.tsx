import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { BookOpen, ListMusic, Globe } from 'lucide-react'
import NcePlayerPage from './pages/NcePlayerPage'
import OnlineEmbedPage from './pages/OnlineEmbedPage'

function TopNav() {
  const location = useLocation()
  const items = [
    { to: '/online', label: '视频', icon: Globe },
    { to: '/lessons', label: '听课', icon: BookOpen },
    { to: '/queue', label: '队列', icon: ListMusic },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-pink-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-pink-100 text-pink-700">
              ♡
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-gray-900">磨耳朵</div>
              <div className="text-xs font-medium text-pink-600">新概念小播放器</div>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {items.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'kid-focus kid-btn kid-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-extrabold transition-colors',
                  active ? 'bg-pink-100 text-pink-700' : 'bg-white/70 text-gray-700 hover:bg-white',
                ].join(' ')}
              >
                <item.icon size={18} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default function AppWeb() {
  return (
    <Router>
      <div className="kid-app min-h-dvh kid-bg flex flex-col">
        <TopNav />
        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/online" replace />} />
            <Route path="/queue" element={<NcePlayerPage initialTab="queue" />} />
            <Route path="/lessons" element={<NcePlayerPage />} />
            <Route path="/online" element={<OnlineEmbedPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

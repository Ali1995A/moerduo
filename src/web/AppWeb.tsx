import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { BookOpen, ListMusic, Globe } from 'lucide-react'
import NcePlayerPage from './pages/NcePlayerPage'
import OnlineEmbedPage from './pages/OnlineEmbedPage'

function TopNav() {
  const location = useLocation()
  const items = [
    { to: '/', label: '新概念', icon: BookOpen },
    { to: '/queue', label: '播放队列', icon: ListMusic },
    { to: '/online', label: '在线视频', icon: Globe },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">磨耳朵 Web</div>
          <div className="text-xs text-gray-500">新概念播放器</div>
        </div>

        <nav className="flex items-center gap-1">
          {items.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100',
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
      <div className="min-h-dvh bg-gray-50">
        <TopNav />
        <Routes>
          <Route path="/" element={<NcePlayerPage />} />
          <Route path="/queue" element={<NcePlayerPage initialTab="queue" />} />
          <Route path="/online" element={<OnlineEmbedPage />} />
        </Routes>
      </div>
    </Router>
  )
}


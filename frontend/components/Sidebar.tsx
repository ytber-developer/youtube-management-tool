'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PlayCircle,
  List,
  Video,
  Upload,
  FileText,
  Settings
} from 'lucide-react'

const navigation = [
  { name: 'Danh sách kênh', href: '/channels', icon: List },
  { name: 'Upload Video', href: '/upload-video', icon: Upload },
  { name: 'Check AdSense', href: '/check-adsense', icon: FileText },
  { name: 'Tăng lượt xem', href: '/boost-views', icon: PlayCircle },
  { name: 'Video đã tải', href: '/videos', icon: Video },
  { name: 'Setup & DB', href: '/setup', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white border-r">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4 mb-6">
            <PlayCircle className="w-8 h-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Quản lý YT</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon
                    className={`
                      mr-3 flex-shrink-0 h-5 w-5
                      ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 border-t">
            <div className="text-xs text-gray-500">
              <p className="font-medium">Quản lý YouTube</p>
              <p>Phiên bản 2.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

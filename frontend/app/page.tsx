import { PlayCircle, Users, MessageSquare, TrendingUp } from 'lucide-react'
import { StatsCard } from '@/components/StatsCard'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">YouTube Account Manager & View Booster</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Views"
          value="12,543"
          icon={<PlayCircle className="w-6 h-6" />}
          trend="+12.5%"
          trendUp={true}
        />
        <StatsCard
          title="Subscribers"
          value="1,234"
          icon={<Users className="w-6 h-6" />}
          trend="+8.2%"
          trendUp={true}
        />
        <StatsCard
          title="Comments"
          value="456"
          icon={<MessageSquare className="w-6 h-6" />}
          trend="+15.3%"
          trendUp={true}
        />
        <StatsCard
          title="Engagement"
          value="23.4%"
          icon={<TrendingUp className="w-6 h-6" />}
          trend="+3.1%"
          trendUp={true}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/watch" className="block">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <PlayCircle className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Boost Views</h3>
                <p className="text-sm text-gray-600">Generate views, likes & comments</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/accounts" className="block">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Accounts</h3>
                <p className="text-sm text-gray-600">Upload & manage YouTube accounts</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/settings" className="block">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                <p className="text-sm text-gray-600">Configure proxies & comments</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded">
                <PlayCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Campaign completed</p>
                <p className="text-xs text-gray-500">100 views generated</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Accounts uploaded</p>
                <p className="text-xs text-gray-500">50 new accounts added</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">5 hours ago</span>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Comments posted</p>
                <p className="text-xs text-gray-500">25 comments on 5 videos</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}

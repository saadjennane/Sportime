import { useState } from 'react';

function App() {
  const [hoveredCard, setHoveredCard] = useState<'mobile' | 'admin' | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Logo/Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-hot-red via-electric-blue to-lime-glow bg-clip-text text-transparent">
            SPORTIME
          </h1>
          <p className="text-xl text-gray-400">Fantasy Sports Platform</p>
        </div>

        {/* Access Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Mobile App Card */}
          <a
            href="/mobile"
            rel="noopener noreferrer"
            className="group relative overflow-hidden bg-gradient-to-br from-surface to-background-dark border border-border-subtle rounded-2xl p-8 transition-all duration-300 hover:border-electric-blue hover:shadow-2xl hover:shadow-electric-blue/20 hover:-translate-y-2"
            onMouseEnter={() => setHoveredCard('mobile')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="relative z-10">
              <div className="w-16 h-16 mb-6 bg-electric-blue/10 rounded-xl flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-electric-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-electric-blue">Mobile App</h2>
              <p className="text-gray-400 mb-6">
                Access the full Sportime experience on mobile. Play fantasy games, join challenges, and compete with friends.
              </p>
              <div className="flex items-center text-electric-blue font-semibold group-hover:gap-3 transition-all">
                <span>Open Mobile App</span>
                <svg
                  className={`w-5 h-5 transition-transform ${hoveredCard === 'mobile' ? 'translate-x-2' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br from-electric-blue/5 to-transparent transition-opacity ${hoveredCard === 'mobile' ? 'opacity-100' : 'opacity-0'}`} />
          </a>

          {/* Admin Dashboard Card */}
          <a
            href="/admin"
            rel="noopener noreferrer"
            className="group relative overflow-hidden bg-gradient-to-br from-surface to-background-dark border border-border-subtle rounded-2xl p-8 transition-all duration-300 hover:border-purple-spark hover:shadow-2xl hover:shadow-purple-spark/20 hover:-translate-y-2"
            onMouseEnter={() => setHoveredCard('admin')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="relative z-10">
              <div className="w-16 h-16 mb-6 bg-purple-spark/10 rounded-xl flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-purple-spark"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-purple-spark">Admin Dashboard</h2>
              <p className="text-gray-400 mb-6">
                Manage users, games, data sync, and platform configuration. Desktop-optimized admin interface.
              </p>
              <div className="flex items-center text-purple-spark font-semibold group-hover:gap-3 transition-all">
                <span>Open Admin Dashboard</span>
                <svg
                  className={`w-5 h-5 transition-transform ${hoveredCard === 'admin' ? 'translate-x-2' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br from-purple-spark/5 to-transparent transition-opacity ${hoveredCard === 'admin' ? 'opacity-100' : 'opacity-0'}`} />
          </a>
        </div>

        {/* Info Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Development Mode - Temporary gateway for testing
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Production: Mobile (app.sportime.com) | Admin (admin.sportime.com)
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

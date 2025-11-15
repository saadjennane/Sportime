import { Link } from 'react-router-dom';
import { Zap, Star, DatabaseZap, Trophy } from 'lucide-react';

export function Dashboard() {
  const cards = [
    {
      title: 'Swipe Games',
      description: 'Manage swipe prediction games and leaderboards',
      icon: Zap,
      link: '/swipe',
      color: 'lime-glow'
    },
    {
      title: 'Progression System',
      description: 'Configure levels, badges, and user progression',
      icon: Star,
      link: '/progression',
      color: 'purple-spark'
    },
    {
      title: 'Data Sync',
      description: 'Synchronize leagues, teams, and matches from API-Football',
      icon: DatabaseZap,
      link: '/data-sync',
      color: 'electric-blue'
    },
    {
      title: 'Celebrations',
      description: 'View and manage winner celebrations and rewards',
      icon: Trophy,
      link: '/celebrations',
      color: 'hot-red'
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-text-secondary text-lg">
          Manage Sportime platform features and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.link}
              to={card.link}
              className="group relative overflow-hidden bg-surface border border-border-subtle rounded-xl p-6 hover:border-electric-blue transition-all duration-300 hover:shadow-lg hover:shadow-electric-blue/10"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-${card.color}/10`}>
                  <Icon className={`w-6 h-6 text-${card.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-electric-blue transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Stats Overview */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border-subtle rounded-lg p-6">
            <p className="text-sm text-text-secondary mb-1">Active Challenges</p>
            <p className="text-3xl font-bold text-electric-blue">-</p>
          </div>
          <div className="bg-surface border border-border-subtle rounded-lg p-6">
            <p className="text-sm text-text-secondary mb-1">Total Users</p>
            <p className="text-3xl font-bold text-lime-glow">-</p>
          </div>
          <div className="bg-surface border border-border-subtle rounded-lg p-6">
            <p className="text-sm text-text-secondary mb-1">Swipe Games</p>
            <p className="text-3xl font-bold text-purple-spark">-</p>
          </div>
          <div className="bg-surface border border-border-subtle rounded-lg p-6">
            <p className="text-sm text-text-secondary mb-1">Synced Matches</p>
            <p className="text-3xl font-bold text-hot-red">-</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Star,
  DatabaseZap,
  Trophy,
  Globe,
  Shield,
  Users,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leagues', icon: Globe, label: 'Leagues' },
    { to: '/teams', icon: Shield, label: 'Teams' },
    { to: '/players', icon: Users, label: 'Players' },
    { to: '/swipe', icon: Zap, label: 'Swipe Games' },
    { to: '/progression', icon: Star, label: 'Progression' },
    { to: '/data-sync', icon: DatabaseZap, label: 'Data Sync' },
    { to: '/config', icon: Settings, label: 'Game Config' },
    { to: '/celebrations', icon: Trophy, label: 'Celebrations' },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface rounded-lg border border-border-subtle"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          ${className}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:sticky top-0 left-0 h-screen
          w-64 bg-surface border-r border-border-subtle
          transition-transform duration-300 ease-in-out
          z-40
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-border-subtle">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-hot-red via-electric-blue to-lime-glow bg-clip-text text-transparent">
              SPORTIME
            </h1>
            <p className="text-sm text-text-secondary mt-1">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle">
            <div className="px-4 py-3 rounded-lg bg-background-dark">
              <p className="text-xs text-text-secondary">Version 1.0.0</p>
              <p className="text-xs text-text-disabled mt-1">Monorepo Setup</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

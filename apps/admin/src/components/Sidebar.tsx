import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Star,
  DatabaseZap,
  Trophy,
  Globe,
  Shield,
  Users,
  Settings,
  Flag,
  Gauge,
  Menu,
  X,
  Calendar,
  DollarSign,
  Radio,
  Disc3,
  Puzzle
} from 'lucide-react';
import { useState } from 'react';
import packageJson from '../../package.json';

const APP_VERSION = packageJson.version;
const BUILD_DATE = __BUILD_DATE__;

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  const navSections: { label: string | null; items: { to: string; icon: any; label: string }[] }[] = [
    { label: null, items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ] },
    { label: 'Football Data', items: [
      { to: '/leagues', icon: Globe, label: 'Leagues' },
      { to: '/teams', icon: Shield, label: 'Teams' },
      { to: '/players', icon: Users, label: 'Players' },
      { to: '/fixtures', icon: Calendar, label: 'Fixtures' },
      { to: '/data-sync', icon: DatabaseZap, label: 'Data Sync' },
    ] },
    { label: 'Formula 1', items: [
      { to: '/f1-data', icon: Gauge, label: 'F1 Data' },
      { to: '/f1', icon: Flag, label: 'F1 Markets' },
    ] },
    { label: 'Games', items: [
      { to: '/tournament', icon: Trophy, label: 'Games' },
      { to: '/live-games', icon: Radio, label: 'Live Games' },
      { to: '/spinwheel', icon: Disc3, label: 'Spinwheel' },
      { to: '/puzzles', icon: Puzzle, label: 'Daily Puzzles' },
    ] },
    { label: 'Economy & Config', items: [
      { to: '/progression', icon: Star, label: 'Progression' },
      { to: '/bookmaker', icon: DollarSign, label: 'Bookmakers' },
      { to: '/celebrations', icon: Trophy, label: 'Celebrations' },
      { to: '/config', icon: Settings, label: 'Game Config' },
    ] },
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
          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            {navSections.map((section, si) => (
              <div key={si} className="space-y-1">
                {section.label && (
                  <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-disabled">{section.label}</div>
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
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
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle">
            <div className="px-4 py-3 rounded-lg bg-background-dark">
              <p className="text-xs text-text-secondary font-mono">v{APP_VERSION}</p>
              <p className="text-xs text-text-disabled mt-1">Build: {BUILD_DATE}</p>
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

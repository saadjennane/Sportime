import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Star, DatabaseZap, Trophy, Globe, Shield, Users, Settings,
  Flag, Gauge, ChevronDown, Menu, X, Calendar, DollarSign, Radio, Disc3,
  Zap, Gift, PartyPopper, Gamepad2, List, BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import packageJson from '../../package.json';

const APP_VERSION = packageJson.version;
const BUILD_DATE = __BUILD_DATE__;

interface SidebarProps { className?: string; }

type Item = { to: string; icon: any; label: string; disabled?: boolean; end?: boolean };
type Sub = { group: string; items: Item[] };
type Entry = Item | Sub;
type Section = { label: string; entries: Entry[] };
const isSub = (e: Entry): e is Sub => 'group' in e;

const DASHBOARD: Item = { to: '/', icon: LayoutDashboard, label: 'Dashboard' };
const ANALYTICS: Item = { to: '/analytics', icon: BarChart3, label: 'Analytics' };

const CELEBRATIONS: Item = { to: '/celebrations', icon: PartyPopper, label: 'Celebrations' };

const SECTIONS: Section[] = [
  { label: 'Football', entries: [
    { group: 'Data', items: [
      { to: '/leagues', icon: Globe, label: 'Leagues' },
      { to: '/teams', icon: Shield, label: 'Teams' },
      { to: '/players', icon: Users, label: 'Players' },
      { to: '/fixtures', icon: Calendar, label: 'Fixtures' },
      { to: '/data-sync', icon: DatabaseZap, label: 'Data Sync' },
    ] },
    { group: 'Games', items: [
      { to: '/tournament', icon: List, label: 'Games', end: true },
      { to: '/tournament/tq', icon: Trophy, label: 'Tournament Quest' },
      { to: '/tournament/betting', icon: Calendar, label: 'Match Day' },
      { to: '/swipe', icon: Zap, label: 'Swipe Prediction' },
      { to: '/fantasy', icon: Gamepad2, label: 'Fantasy' },
      { to: '/live-games', icon: Radio, label: 'Live Games' },
      CELEBRATIONS,
    ] },
    { group: 'Config', items: [
      { to: '/bookmaker', icon: DollarSign, label: 'Bookmakers' },
    ] },
  ] },
  { label: 'Formula 1', entries: [
    { group: 'Data', items: [
      { to: '/f1-data', icon: Gauge, label: 'F1 Data' },
      { to: '/f1', icon: Flag, label: 'Markets and Odds' },
    ] },
    { group: 'Games', items: [
      { to: '#', icon: Trophy, label: 'Coming soon', disabled: true },
      CELEBRATIONS,
    ] },
  ] },
  { label: 'General config', entries: [
    { to: '/spinwheel', icon: Disc3, label: 'Spinwheel' },
    { to: '/progression', icon: Star, label: 'Progression' },
    { group: 'Game config', items: [
      { to: '/config?tab=rewards', icon: Gift, label: 'Rewards' },
      { to: '/config', icon: Settings, label: 'Game config' },
    ] },
  ] },
];

export function Sidebar({ className = '' }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('admin.sidebar.collapsed') || '[]')); } catch { return new Set(); }
  });
  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem('admin.sidebar.collapsed', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const Link = ({ item, nested }: { item: Item; nested?: boolean }) => {
    const pad = nested ? 'pl-6 pr-3' : 'px-3';
    if (item.disabled) {
      return (
        <div className={`flex items-center gap-3 ${pad} py-2 rounded-lg text-text-disabled cursor-default`}>
          <item.icon className="w-5 h-5" /><span className="font-medium text-sm">{item.label}</span>
        </div>
      );
    }
    return (
      <NavLink to={item.to} end={item.end} onClick={() => setIsOpen(false)}
        className={({ isActive }) => `flex items-center gap-3 ${pad} py-2 rounded-lg transition-colors ${
          isActive ? 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20'
                   : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
        <item.icon className="w-5 h-5" /><span className="font-medium text-sm">{item.label}</span>
      </NavLink>
    );
  };

  const Subgroup = ({ sectionLabel, sub }: { sectionLabel: string; sub: Sub }) => {
    const key = `${sectionLabel}:${sub.group}`;
    const isC = collapsed.has(key);
    return (
      <div>
        <button onClick={() => toggle(key)}
          className="w-full flex items-center justify-between pl-3 pr-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-disabled hover:text-text-secondary">
          <span>{sub.group}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isC ? '-rotate-90' : ''}`} />
        </button>
        {!isC && <div className="space-y-0.5">{sub.items.map((it) => <Link key={it.to} item={it} nested />)}</div>}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface rounded-lg border border-border-subtle">
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside className={`${className} ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen w-64 bg-surface border-r border-border-subtle transition-transform duration-300 ease-in-out z-40`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-border-subtle">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-hot-red via-electric-blue to-lime-glow bg-clip-text text-transparent">SPORTIME</h1>
            <p className="text-sm text-text-secondary mt-1">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 overflow-y-auto space-y-1">
            <Link item={DASHBOARD} />
            <Link item={ANALYTICS} />
            {SECTIONS.map((section) => {
              const sKey = `section:${section.label}`;
              const sC = collapsed.has(sKey);
              return (
                <div key={section.label} className="pt-3">
                  <button onClick={() => toggle(sKey)}
                    className="w-full flex items-center justify-between px-3 pb-1 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary">
                    <span>{section.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${sC ? '-rotate-90' : ''}`} />
                  </button>
                  {!sC && (
                    <div className="space-y-0.5">
                      {section.entries.map((entry, i) =>
                        isSub(entry)
                          ? <Subgroup key={i} sectionLabel={section.label} sub={entry} />
                          : <Link key={entry.to} item={entry} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setIsOpen(false)} />}
    </>
  );
}

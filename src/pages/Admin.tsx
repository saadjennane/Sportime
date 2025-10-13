import React, { useState } from 'react';
import { Match, ChallengeStatus, LevelConfig, Badge, Profile, BettingChallenge } from '../../types';
import { MatchForm } from '../components/MatchForm';
import { ChevronDown, Edit2, ShieldCheck, Gamepad2, Settings, Star, DatabaseZap, Terminal, Trash2, Coins, Play } from 'lucide-react';
import { ProgressionAdmin } from '../components/ProgressionAdmin';
import { ChallengesAdmin } from '../components/ChallengesAdmin';
import { DataSyncAdmin } from '../components/DataSyncAdmin';
import { useToast } from '../hooks/useToast';
import { TestModeToggle } from '../components/TestModeToggle';

type AdminSection = 'challenges' | 'progression' | 'datasync' | 'general' | 'developer';

interface AdminPageProps {
  // These props are becoming obsolete but kept for now to avoid breaking single matches
  matches: Match[];
  onAddMatch: (match: Omit<Match, 'id' | 'status'>) => void;
  onUpdateMatch: (match: Match) => void;
  onResolveMatch: (matchId: string, result: 'teamA' | 'draw' | 'teamB', score: { teamA: number, teamB: number }) => void;
  
  // Progression props
  levels: LevelConfig[];
  badges: Badge[];
  onAddLevel: (level: Omit<LevelConfig, 'id'>) => void;
  onUpdateLevel: (level: LevelConfig) => void;
  onDeleteLevel: (levelId: string) => void;
  onAddBadge: (badge: Omit<Badge, 'id' | 'created_at'>) => void;
  onUpdateBadge: (badge: Badge) => void;
  onDeleteBadge: (badgeId: string) => void;

  // Challenge props
  challenges: BettingChallenge[];
  onAddChallenge: (challenge: Omit<BettingChallenge, 'id' | 'status' | 'totalPlayers' | 'gameType' | 'is_linkable'>) => void;

  // Developer props
  isTestMode: boolean;
  onSetTestMode: (enabled: boolean) => void;
  onResetTestUsers: () => void;
  profile: Profile | null;
  onSetCoinBalance: (newBalance: number) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onTestOnboarding: () => void;
}

const AdminPage: React.FC<AdminPageProps> = (props) => {
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('developer');
  const { addToast } = useToast();

  const handleEdit = (match: Match) => {
    setEditingMatch(match);
    setShowAddForm(false);
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
  };

  const handleToggleAddForm = () => {
    setShowAddForm(!showAddForm);
    setEditingMatch(null);
  };

  const AdminSectionButton: React.FC<{ section: AdminSection, icon: React.ReactNode, label: string }> = ({ section, icon, label }) => (
    <button
      onClick={() => setActiveSection(section)}
      className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === section ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-5 bg-navy-accent rounded-xl p-1 gap-1">
        <AdminSectionButton section="challenges" icon={<Gamepad2 size={16} />} label="Challenges" />
        <AdminSectionButton section="progression" icon={<Star size={16} />} label="Progression" />
        <AdminSectionButton section="datasync" icon={<DatabaseZap size={16} />} label="Data Sync" />
        <AdminSectionButton section="general" icon={<Settings size={16} />} label="General" />
        <AdminSectionButton section="developer" icon={<Terminal size={16} />} label="Dev" />
      </div>

      {activeSection === 'challenges' && (
        <div className="animate-scale-in">
          <ChallengesAdmin addToast={addToast} onAddChallenge={props.onAddChallenge} />
        </div>
      )}

      {activeSection === 'progression' && (
        <div className="animate-scale-in">
          <ProgressionAdmin 
            levels={props.levels}
            badges={props.badges}
            onAddLevel={props.onAddLevel}
            onUpdateLevel={props.onUpdateLevel}
            onDeleteLevel={props.onDeleteLevel}
            onAddBadge={props.onAddBadge}
            onUpdateBadge={props.onUpdateBadge}
            onDeleteBadge={props.onDeleteBadge}
          />
        </div>
      )}

      {activeSection === 'datasync' && (
        <div className="animate-scale-in">
          <DataSyncAdmin addToast={addToast} />
        </div>
      )}

      {activeSection === 'general' && (
        <div className="space-y-6 animate-scale-in">
          <div className="card-base p-5">
            <button onClick={handleToggleAddForm} className="w-full flex justify-between items-center font-bold text-lg text-electric-blue">
              <span>{showAddForm ? 'Close Form' : 'Add New (Legacy) Match'}</span>
              <ChevronDown className={`w-6 h-6 transition-transform ${showAddForm ? 'rotate-180' : ''}`} />
            </button>
            {showAddForm && (
              <div className="mt-4">
                <MatchForm
                  onSubmit={(data) => {
                    props.onAddMatch(data);
                    setShowAddForm(false);
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            )}
          </div>

          {editingMatch && (
            <div className="card-base p-5">
              <h2 className="font-bold text-lg text-electric-blue mb-4">Edit (Legacy) Match</h2>
              <MatchForm
                match={editingMatch}
                onSubmit={(data) => {
                  props.onUpdateMatch({ ...editingMatch, ...data });
                  setEditingMatch(null);
                }}
                onCancel={handleCancelEdit}
              />
            </div>
          )}

          <div className="space-y-4">
            <h2 className="font-bold text-xl text-text-secondary px-2">Manage (Legacy) Matches</h2>
            {props.matches.map(match => (
              <AdminMatchCard
                key={match.id}
                match={match}
                onEdit={handleEdit}
                onResolve={props.onResolveMatch}
              />
            ))}
          </div>
        </div>
      )}

      {activeSection === 'developer' && (
        <div className="animate-scale-in space-y-6">
          <div className="card-base p-5 space-y-4">
            <h3 className="font-bold text-lg text-text-primary">Developer Options</h3>
            <TestModeToggle
              label="Enable Test Mode (Skip Email Verification)"
              description="When active, the app bypasses the Magic Link verification step and goes straight to onboarding after entering an email."
              isTestMode={props.isTestMode}
              onToggle={props.onSetTestMode}
            />
            <button
              onClick={props.onTestOnboarding}
              className="w-full flex items-center justify-center gap-2 py-3 bg-electric-blue/20 text-electric-blue rounded-xl font-semibold hover:bg-electric-blue/30 transition-colors"
            >
              <Play size={16} /> Test Onboarding Flow
            </button>
            <button
              onClick={() => {
                if (props.profile) {
                  const newBalance = props.profile.coins_balance + 50000;
                  props.onSetCoinBalance(newBalance);
                  addToast('Added 50,000 coins!', 'success');
                } else {
                  addToast('No active profile to add coins to.', 'error');
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-lime-glow/20 text-lime-glow rounded-xl font-semibold hover:bg-lime-glow/30 transition-colors"
            >
              <Coins size={16} /> Add 50,000 Coins
            </button>
            <button
              onClick={props.onResetTestUsers}
              className="w-full flex items-center justify-center gap-2 py-3 bg-hot-red/20 text-hot-red rounded-xl font-semibold hover:bg-hot-red/30 transition-colors"
            >
              <Trash2 size={16} /> Reset All Test Users
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminMatchCard: React.FC<{
  match: Match;
  onEdit: (match: Match) => void;
  onResolve: (matchId: string, result: 'teamA' | 'draw' | 'teamB', score: { teamA: number, teamB: number }) => void;
}> = ({ match, onEdit, onResolve }) => {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const handleResolve = (result: 'teamA' | 'draw' | 'teamB') => {
    const finalScoreA = parseInt(scoreA);
    const finalScoreB = parseInt(scoreB);
    if (!isNaN(finalScoreA) && !isNaN(finalScoreB)) {
      onResolve(match.id, result, { teamA: finalScoreA, teamB: finalScoreB });
    } else {
      alert('Please enter a valid score for both teams.');
    }
  };

  return (
    <div className="card-base p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-text-primary">{match.teamA.name} vs {match.teamB.name}</p>
          <p className="text-sm text-text-secondary">{match.kickoffTime}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${match.status === 'upcoming' ? 'bg-lime-glow/20 text-lime-glow' : 'bg-disabled text-text-disabled'}`}>
          {match.status}
        </span>
      </div>

      {match.status === 'upcoming' && (
        <div>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Resolve Match</h3>
            <button onClick={() => onEdit(match)} className="p-2 hover:bg-white/10 rounded-full">
              <Edit2 className="w-4 h-4 text-electric-blue" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="number" placeholder={match.teamA.name.split(' ')[0]} value={scoreA} onChange={e => setScoreA(e.target.value)} className="input-base text-center" />
            <span className="font-bold text-text-disabled">-</span>
            <input type="number" placeholder={match.teamB.name.split(' ')[0]} value={scoreB} onChange={e => setScoreB(e.target.value)} className="input-base text-center" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleResolve('teamA')} className="flex items-center justify-center gap-1 text-sm p-2 bg-electric-blue/20 text-electric-blue rounded-lg hover:bg-electric-blue/30">
              <ShieldCheck size={14} /> {match.teamA.name.split(' ')[0]} Wins
            </button>
            <button onClick={() => handleResolve('draw')} className="flex items-center justify-center gap-1 text-sm p-2 bg-warm-yellow/20 text-warm-yellow rounded-lg hover:bg-warm-yellow/30">
              <ShieldCheck size={14} /> Draw
            </button>
            <button onClick={() => handleResolve('teamB')} className="flex items-center justify-center gap-1 text-sm p-2 bg-neon-cyan/20 text-neon-cyan rounded-lg hover:bg-neon-cyan/30">
              <ShieldCheck size={14} /> {match.teamB.name.split(' ')[0]} Wins
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

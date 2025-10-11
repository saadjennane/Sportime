import React, { useState } from 'react';
import { Match, ChallengeStatus, LevelConfig, Badge, Profile } from '../types';
import { MatchForm } from '../components/MatchForm';
import { ChevronDown, Edit2, ShieldCheck, Gamepad2, Settings, Star, DatabaseZap, Terminal, Trash2, Coins } from 'lucide-react';
import { ProgressionAdmin } from '../components/ProgressionAdmin';
import { ChallengesAdmin } from '../components/ChallengesAdmin';
import { DataSyncAdmin } from '../components/DataSyncAdmin';
import { useToast } from '../hooks/useToast';
import { TestModeToggle } from '../components/TestModeToggle';


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

  // Obsolete challenge props - will be removed once ChallengesAdmin is self-sufficient
  challenges: any[];
  challengeMatches: any[];
  swipeMatchDays: any[];
  onAddChallenge: (challenge: any) => void;
  onAddChallengeMatch: (challengeMatch: any) => void;
  onResolveChallengeMatch: (challengeMatchId: string, result: 'teamA' | 'draw' | 'teamB') => void;
  onUpdateChallengeStatus: (challengeId: string, status: ChallengeStatus) => void;
  onAddSwipeMatchDay: (matchDay: any) => void;
  onResolveSwipeMatch: (matchId: string, result: any) => void;
  onUpdateSwipeMatchDayStatus: (matchDayId: string, status: 'Ongoing' | 'Finished') => void;

  // Developer props
  isTestMode: boolean;
  onSetTestMode: (enabled: boolean) => void;
  onResetTestUsers: () => void;
  profile: Profile | null;
  onSetCoinBalance: (newBalance: number) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 bg-gray-200 rounded-xl p-1">
        <button
          onClick={() => setActiveSection('challenges')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === 'challenges' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          <Gamepad2 size={16} /> Challenges
        </button>
        <button
          onClick={() => setActiveSection('progression')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === 'progression' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          <Star size={16} /> Progression
        </button>
        <button
          onClick={() => setActiveSection('datasync')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === 'datasync' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          <DatabaseZap size={16} /> Data Sync
        </button>
        <button
          onClick={() => setActiveSection('general')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === 'general' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          <Settings size={16} /> General
        </button>
        <button
          onClick={() => setActiveSection('developer')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === 'developer' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}
        >
          <Terminal size={16} /> Developer
        </button>
      </div>

      {activeSection === 'challenges' && (
        <div className="animate-scale-in">
          <ChallengesAdmin addToast={addToast}/>
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
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <button onClick={handleToggleAddForm} className="w-full flex justify-between items-center font-bold text-lg text-purple-700">
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
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h2 className="font-bold text-lg text-purple-700 mb-4">Edit (Legacy) Match</h2>
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
            <h2 className="font-bold text-xl text-gray-700 px-2">Manage (Legacy) Matches</h2>
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
          <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
            <h3 className="font-bold text-lg text-gray-800">Developer Options</h3>
            <TestModeToggle
              label="Enable Test Mode (Skip Email Verification)"
              description="When active, the app bypasses the Magic Link verification step and goes straight to onboarding after entering an email."
              isTestMode={props.isTestMode}
              onToggle={props.onSetTestMode}
            />
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
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-100 text-green-700 rounded-xl font-semibold hover:bg-green-200 transition-colors"
            >
              <Coins size={16} /> Add 50,000 Coins
            </button>
            <button
              onClick={props.onResetTestUsers}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors"
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
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800">{match.teamA.name} vs {match.teamB.name}</p>
          <p className="text-sm text-gray-500">{match.kickoffTime}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${match.status === 'upcoming' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
          {match.status}
        </span>
      </div>

      {match.status === 'upcoming' && (
        <div>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Resolve Match</h3>
            <button onClick={() => onEdit(match)} className="p-2 hover:bg-gray-100 rounded-full">
              <Edit2 className="w-4 h-4 text-blue-600" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="number" placeholder={match.teamA.name.split(' ')[0]} value={scoreA} onChange={e => setScoreA(e.target.value)} className="w-full p-2 border rounded-lg text-center" />
            <span className="font-bold">-</span>
            <input type="number" placeholder={match.teamB.name.split(' ')[0]} value={scoreB} onChange={e => setScoreB(e.target.value)} className="w-full p-2 border rounded-lg text-center" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleResolve('teamA')} className="flex items-center justify-center gap-1 text-sm p-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200">
              <ShieldCheck size={14} /> {match.teamA.name.split(' ')[0]} Wins
            </button>
            <button onClick={() => handleResolve('draw')} className="flex items-center justify-center gap-1 text-sm p-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200">
              <ShieldCheck size={14} /> Draw
            </button>
            <button onClick={() => handleResolve('teamB')} className="flex items-center justify-center gap-1 text-sm p-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200">
              <ShieldCheck size={14} /> {match.teamB.name.split(' ')[0]} Wins
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

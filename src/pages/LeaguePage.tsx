import React, { useState } from 'react';
import { Profile, UserLeague, LeagueMember } from '../../types';
import { ArrowLeft, Users, Settings, Link, Trash2, LogOut } from 'lucide-react';
import { LeagueInviteModal } from '../components/leagues/LeagueInviteModal';
import { LeagueManageModal } from '../components/leagues/LeagueManageModal';

interface LeaguePageProps {
  league: UserLeague;
  members: Profile[];
  memberRoles: LeagueMember[];
  currentUserRole: 'admin' | 'member';
  currentUserId: string;
  onBack: () => void;
  onUpdateDetails: (leagueId: string, name: string, description: string, imageUrl: string | null) => void;
  onRemoveMember: (leagueId: string, userId: string) => void;
  onResetInviteCode: (leagueId: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}

const LeaguePage: React.FC<LeaguePageProps> = (props) => {
  const { league, members, memberRoles, currentUserRole, currentUserId, onBack, onUpdateDetails, onRemoveMember, onResetInviteCode, onLeave, onDelete } = props;
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const adminProfile = members.find(m => m.id === league.created_by);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
        <ArrowLeft size={20} /> Back to Leagues
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-5 text-center space-y-3">
        <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
          {league.image_url ? (
            <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <Users className="w-12 h-12 text-gray-400" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{league.name}</h2>
          {league.description && <p className="text-sm text-gray-500 mt-1">{league.description}</p>}
          <p className="text-xs text-gray-400 mt-2">Created by {adminProfile?.username || '...'} on {new Date(league.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex justify-center gap-2 pt-2 border-t border-gray-100">
          <button onClick={() => setIsInviteModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-purple-100 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-200">
            <Link size={16} /> Invite
          </button>
          {currentUserRole === 'admin' && (
            <button onClick={() => setIsManageModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
              <Settings size={16} /> Manage
            </button>
          )}
        </div>
      </div>

      {/* Member List */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="font-bold text-gray-800 mb-4">Members ({members.length})</h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
          {members.map(member => (
            <div key={member.id} className="flex flex-col items-center text-center">
              <img src={member.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${member.id}`} alt={member.username || 'user'} className="w-12 h-12 rounded-full object-cover bg-gray-200" />
              <p className="text-xs font-semibold text-gray-700 mt-1 truncate w-full">{member.username}</p>
              {memberRoles.find(m => m.user_id === member.id)?.role === 'admin' && (
                <p className="text-[10px] font-bold text-purple-600">Admin</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone for Members */}
      {currentUserRole === 'member' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h3 className="font-bold text-red-800 mb-3">Danger Zone</h3>
            <button onClick={onLeave} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200">
                <LogOut size={16} /> Leave League
            </button>
        </div>
      )}

      {/* Modals */}
      <LeagueInviteModal 
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        inviteCode={league.invite_code}
        isAdmin={currentUserRole === 'admin'}
        onReset={() => onResetInviteCode(league.id)}
      />
      {currentUserRole === 'admin' && (
        <LeagueManageModal
            isOpen={isManageModalOpen}
            onClose={() => setIsManageModalOpen(false)}
            league={league}
            members={members.filter(m => m.id !== currentUserId)} // Members other than admin
            onUpdateDetails={onUpdateDetails}
            onRemoveMember={onRemoveMember}
            onLeave={onLeave}
            onDelete={onDelete}
        />
      )}
    </div>
  );
};
export default LeaguePage;

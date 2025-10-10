import React, { useState } from 'react';
import { League, Profile } from '../../types';
import { ArrowLeft, Users, Settings, UserPlus, LogOut, Loader2 } from 'lucide-react';
import { InviteModal } from '../../components/leagues/InviteModal';
import { ManageLeagueModal } from '../../components/leagues/ManageLeagueModal';
import { LeaveLeagueModal } from '../../components/leagues/LeaveLeagueModal';
import { DeleteLeagueModal } from '../../components/leagues/DeleteLeagueModal';

interface LeagueDetailPageProps {
  league: League;
  profile: Profile;
  onBack: () => void;
  onUpdate: (leagueId: string, name: string, description: string | null) => void;
  onDelete: (leagueId: string) => void;
  onLeave: (leagueId: string) => void;
  onResetInvite: (leagueId: string) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const LeagueDetailPage: React.FC<LeagueDetailPageProps> = ({ league, profile, onBack, onUpdate, onDelete, onLeave, onResetInvite, addToast }) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isAdmin = league.created_by === profile.id;

  return (
    <div className="space-y-6 animate-scale-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
        <ArrowLeft size={20} /> Back to Leagues
      </button>

      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-xl" /> : <Users size={40} className="text-purple-500" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{league.name}</h2>
            <p className="text-sm text-gray-500">{league.description || 'No description'}</p>
          </div>
        </div>
        
        <div className="flex gap-2 border-t pt-4">
          {isAdmin ? (
            <>
              <button onClick={() => setIsInviteModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-sm hover:bg-purple-700">
                <UserPlus size={16} /> Invite
              </button>
              <button onClick={() => setIsManageModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                <Settings size={16} /> Manage
              </button>
            </>
          ) : (
            <button onClick={() => setIsLeaveModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200">
              <LogOut size={16} /> Leave League
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2 mb-4">
          <Users size={20} /> Members ({league.members?.length || 0})
        </h3>
        {!league.members ? (
            <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-purple-500" size={32} />
            </div>
        ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {league.members?.sort((a,b) => a.role === 'admin' ? -1 : 1).map(member => (
                <div key={member.user.id} className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg">
                <img src={member.user.profile_picture_url || `https://i.pravatar.cc/150?u=${member.user.id}`} alt={member.user.username || 'User'} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{member.user.username || 'Anonymous'}</p>
                    <p className="text-xs font-bold text-purple-600 capitalize">{member.role}</p>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
      
      {isAdmin && (
        <div className="text-center">
            <button onClick={() => setIsDeleteModalOpen(true)} className="text-sm text-red-500 hover:underline font-semibold">
                Delete League
            </button>
        </div>
      )}

      {/* Modals */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        inviteCode={league.invite_code}
        onReset={onResetInvite}
        leagueId={league.id}
        addToast={addToast}
      />
      <ManageLeagueModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        league={league}
        onUpdate={onUpdate}
      />
      <LeaveLeagueModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={() => onLeave(league.id)}
      />
      <DeleteLeagueModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => onDelete(league.id)}
      />
    </div>
  );
};

export default LeagueDetailPage;

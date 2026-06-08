import React, { useState } from 'react';
import { UserLeague, Profile } from '../../types';
import { X, Trash2, UserX, LogOut, Shield, ShieldOff, Ban, MoreVertical } from 'lucide-react';

interface MemberRole { user_id: string; role: 'admin' | 'member' }

interface LeagueManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: UserLeague;
  members: Profile[];
  memberRoles?: MemberRole[];
  currentUserId?: string;
  currentUserRole?: 'admin' | 'member';
  onUpdateDetails: (leagueId: string, name: string, description: string, imageUrl: string | null) => void;
  onRemoveMember: (leagueId: string, userId: string) => void;
  onSetMemberRole?: (userId: string, role: 'admin' | 'member') => void;
  onKickMember?: (userId: string) => void;
  onBlockMember?: (userId: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}

export const LeagueManageModal: React.FC<LeagueManageModalProps> = ({
  isOpen, onClose, league, members, memberRoles = [], currentUserId, currentUserRole,
  onUpdateDetails, onSetMemberRole, onKickMember, onBlockMember, onLeave, onDelete,
}) => {
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description || '');
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUserRole === 'admin';
  const creatorId = (league as any).created_by;
  const roleOf = (id: string) => memberRoles.find(r => r.user_id === id)?.role ?? 'member';

  const handleSave = () => { onUpdateDetails(league.id, name, description, league.image_url || null); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-navy-accent rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] flex flex-col border border-white/10">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-text-primary">Manage Squad</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Details (admin only) */}
          {isAdmin && (
            <div className="space-y-3">
              <h3 className="font-semibold text-text-secondary text-sm">Squad Details</h3>
              <div>
                <label className="block text-xs font-medium text-text-disabled mb-1">Squad Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-deep-navy border border-white/10 rounded-xl text-text-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-disabled mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-deep-navy border border-white/10 rounded-xl h-20 text-text-primary" />
              </div>
            </div>
          )}

          {/* Members */}
          <div className="space-y-2">
            <h3 className="font-semibold text-text-secondary text-sm">Members ({members.length})</h3>
            {members.map(member => {
              const role = roleOf(member.id);
              const isSelf = member.id === currentUserId;
              const isCreator = member.id === creatorId;
              const canManage = isAdmin && !isSelf && !isCreator;
              return (
                <div key={member.id} className="bg-deep-navy rounded-xl">
                  <div className="flex items-center p-2.5">
                    <img src={member.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${member.id}`} alt={member.username || 'user'} className="w-9 h-9 rounded-full object-cover bg-navy-accent" />
                    <div className="flex-1 ml-3 min-w-0">
                      <p className="font-semibold text-sm text-text-primary truncate">{member.username}{isSelf && ' (you)'}</p>
                      {(role === 'admin' || isCreator) && <p className="text-[10px] font-bold text-electric-blue">{isCreator ? 'Owner' : 'Admin'}</p>}
                    </div>
                    {canManage && (
                      <button onClick={() => setOpenMenuFor(openMenuFor === member.id ? null : member.id)} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
                        <MoreVertical size={18} />
                      </button>
                    )}
                  </div>
                  {canManage && openMenuFor === member.id && (
                    <div className="px-2.5 pb-2.5 grid grid-cols-1 gap-1.5 border-t border-white/5 pt-2">
                      {role === 'admin' ? (
                        <button onClick={() => { onSetMemberRole?.(member.id, 'member'); setOpenMenuFor(null); }} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg hover:bg-white/5">
                          <ShieldOff size={16} /> Remove Admin
                        </button>
                      ) : (
                        <button onClick={() => { onSetMemberRole?.(member.id, 'admin'); setOpenMenuFor(null); }} className="flex items-center gap-2 text-sm font-semibold text-electric-blue hover:bg-white/5 px-3 py-2 rounded-lg">
                          <Shield size={16} /> Make Admin
                        </button>
                      )}
                      <button onClick={() => { onKickMember?.(member.id); setOpenMenuFor(null); }} className="flex items-center gap-2 text-sm font-semibold text-warm-yellow hover:bg-white/5 px-3 py-2 rounded-lg">
                        <UserX size={16} /> Remove Member
                      </button>
                      <button onClick={() => { onBlockMember?.(member.id); setOpenMenuFor(null); }} className="flex items-center gap-2 text-sm font-semibold text-hot-red hover:bg-white/5 px-3 py-2 rounded-lg">
                        <Ban size={16} /> Block Member
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Danger Zone */}
          <div className="border-t border-white/10 pt-5">
            <h3 className="font-bold text-hot-red text-sm mb-3">Danger Zone</h3>
            <div className="space-y-2">
              <button onClick={() => { onLeave(); onClose(); }} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-hot-red/10 text-hot-red px-4 py-2.5 rounded-lg hover:bg-hot-red/20">
                <LogOut size={16} /> Leave Squad
              </button>
              {isAdmin && (
                <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-hot-red/10 text-hot-red px-4 py-2.5 rounded-lg hover:bg-hot-red/20">
                  <Trash2 size={16} /> Delete Squad
                </button>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="p-5 border-t border-white/10">
            <button onClick={handleSave} className="w-full py-3 bg-electric-blue text-white font-bold rounded-xl shadow-lg hover:opacity-90">
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

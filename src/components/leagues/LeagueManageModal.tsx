import React, { useState } from 'react';
import { UserLeague, Profile } from '../../types';
import { X, Trash2, UserX, LogOut } from 'lucide-react';

interface LeagueManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: UserLeague;
  members: Profile[];
  onUpdateDetails: (leagueId: string, name: string, description: string, imageUrl: string | null) => void;
  onRemoveMember: (leagueId: string, userId: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}

export const LeagueManageModal: React.FC<LeagueManageModalProps> = ({ isOpen, onClose, league, members, onUpdateDetails, onRemoveMember, onLeave, onDelete }) => {
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateDetails(league.id, name, description, league.image_url || null);
    onClose();
  };

  const handleLeaveClick = () => {
    onLeave();
    onClose();
  };

  const handleDeleteClick = () => {
    onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full h-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Manage League</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Edit Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">League Details</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-100 border-2 border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-gray-100 border-2 border-gray-200 rounded-xl h-24" />
            </div>
          </div>

          {/* Manage Members */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Manage Members</h3>
            {members.length > 0 ? members.map(member => (
              <div key={member.id} className="flex items-center bg-gray-50 p-2 rounded-lg">
                <img src={member.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${member.id}`} alt={member.username || 'user'} className="w-8 h-8 rounded-full object-cover" />
                <p className="flex-1 ml-3 font-semibold text-sm">{member.username}</p>
                <button onClick={() => onRemoveMember(league.id, member.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                  <UserX size={16} />
                </button>
              </div>
            )) : <p className="text-xs text-gray-500 text-center">No other members to manage.</p>}
          </div>

          {/* Danger Zone */}
          <div className="border-t pt-6">
            <h3 className="font-bold text-red-800 mb-3">Danger Zone</h3>
            <div className="space-y-2">
                <button onClick={handleLeaveClick} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200">
                    <LogOut size={16} /> Leave League
                </button>
                <button onClick={handleDeleteClick} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200">
                    <Trash2 size={16} /> Delete League
                </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t">
          <button onClick={handleSave} className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

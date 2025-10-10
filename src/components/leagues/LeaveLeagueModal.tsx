import React from 'react';
import { X, LogOut } from 'lucide-react';

interface LeaveLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LeaveLeagueModal: React.FC<LeaveLeagueModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>

        <div className="text-center">
            <div className="inline-block bg-red-100 p-3 rounded-full mb-3">
                <LogOut className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Leave League?</h2>
            <p className="text-sm text-gray-500 mt-1">Are you sure you want to leave this league? You will need a new invite to rejoin.</p>
        </div>

        <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-sm hover:bg-red-700">
                Yes, Leave
            </button>
        </div>
      </div>
    </div>
  );
};

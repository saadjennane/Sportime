import React from 'react';
import { Squad } from '../types';
import { Users, CheckCircle, ArrowRight } from 'lucide-react';

interface SquadJoinPageProps {
  squad: Squad | null;
  isMember: boolean;
  onJoin: () => void;
  onGoToSquad: () => void;
  onCancel: () => void;
}

const SquadJoinPage: React.FC<SquadJoinPageProps> = ({ squad, isMember, onJoin, onGoToSquad, onCancel }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto p-8 bg-white rounded-3xl shadow-2xl space-y-6 animate-scale-in text-center">
        {squad ? (
          <>
            <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
              {squad.image_url ? (
                <img src={squad.image_url} alt={squad.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <Users className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">You're invited to join</h1>
            <p className="text-3xl font-extrabold text-purple-700">{squad.name}</p>
            {squad.description && <p className="text-gray-500">{squad.description}</p>}

            {isMember ? (
              <div className="space-y-3 pt-4">
                 <p className="text-sm font-semibold text-green-600 flex items-center justify-center gap-2"><CheckCircle size={16}/> You are already a member.</p>
                 <button onClick={onGoToSquad} className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
                    Go to Squad <ArrowRight size={18} />
                 </button>
              </div>
            ) : (
              <div className="space-y-3 pt-4">
                <button onClick={onJoin} className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 transition-all">
                  Join Squad
                </button>
                <button onClick={onCancel} className="w-full py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  Not Now
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">☹️</div>
            <h1 className="text-2xl font-bold text-gray-900">Invalid Invite Link</h1>
            <p className="text-gray-500">This squad link is invalid or has expired. Please ask for a new link.</p>
            <button onClick={onCancel} className="w-full mt-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SquadJoinPage;

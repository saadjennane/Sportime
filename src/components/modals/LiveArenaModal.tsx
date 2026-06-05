import React, { useState, useEffect } from 'react';
import { X, User, Users, Link, Copy, Check, ArrowLeft, Gamepad2 } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { ActiveSession } from '../../types';
import { MOCK_LIVE_GAME_TYPES } from '../../data/mockLiveGameTypes';
import { AnimatePresence, motion } from 'framer-motion';

type Step = 'select_type' | 'link' | 'confirm';

interface LiveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  matchName: string | null;
}

export const LiveArenaModal: React.FC<LiveGameModalProps> = ({ isOpen, onClose, matchId, matchName }) => {
  const [step, setStep] = useState<Step>('select_type');
  const [selectedGameTypeId, setSelectedGameTypeId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('none');
  const [createdSession, setCreatedSession] = useState<ActiveSession | null>(null);
  const [copied, setCopied] = useState(false);

  const { userLeagues, createLiveSession } = useMockStore();

  useEffect(() => {
    if (isOpen) {
      setStep('select_type');
      setSelectedGameTypeId(null);
      setSelectedLeagueId('none');
      setCreatedSession(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleSelectType = (gameTypeId: string) => {
    setSelectedGameTypeId(gameTypeId);
    setStep('link');
  };

  const handleStartGame = () => {
    if (!matchId || !selectedGameTypeId) return;
    const leagueId = selectedLeagueId === 'none' ? undefined : selectedLeagueId;
    const session = createLiveSession(matchId, selectedGameTypeId, leagueId);
    setCreatedSession(session);
    setStep('confirm');
  };

  const handleCopy = () => {
    if (!createdSession || !createdSession.pin) return;
    const link = `${window.location.origin}/live/${createdSession.id}?pin=${createdSession.pin}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderSelectType = () => (
    <div className="space-y-3">
      {MOCK_LIVE_GAME_TYPES.map(type => (
        <button key={type.id} onClick={() => handleSelectType(type.id)} className="w-full text-left p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-disabled hover:border-electric-blue/50 transition-all">
          <h4 className="font-bold text-text-primary">{type.name}</h4>
          <p className="text-sm text-text-secondary">{type.description}</p>
        </button>
      ))}
    </div>
  );

  const renderLinkStep = () => (
    <div className="space-y-4">
      <button onClick={() => setStep('select_type')} className="flex items-center gap-2 text-sm text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={16} /> Back
      </button>
      <select value={selectedLeagueId} onChange={(e) => setSelectedLeagueId(e.target.value)} className="input-base">
        <option value="none">Start without linking (PIN)</option>
        {userLeagues.map(league => (
          <option key={league.id} value={league.id}>Link to: {league.name}</option>
        ))}
      </select>
      <button onClick={handleStartGame} className="w-full primary-button">Start Game</button>
    </div>
  );
  
  const renderConfirmStep = () => (
    <div className="space-y-4 text-center">
      <h3 className="text-xl font-bold text-lime-glow">✅ Game Created!</h3>
      {createdSession?.pin ? (
        <>
          <p className="text-text-secondary">Share this code with your friends:</p>
          <p className="text-5xl font-bold tracking-widest text-warm-yellow" style={{fontVariantNumeric: 'tabular-nums'}}>{createdSession.pin}</p>
          <div className="bg-deep-navy p-2 rounded-xl flex items-center gap-2">
            <input type="text" value={`${window.location.origin}/live/${createdSession.id}?pin=${createdSession.pin}`} readOnly className="flex-1 bg-transparent text-xs text-text-disabled truncate" />
            <button onClick={handleCopy} className="p-2 bg-electric-blue text-white rounded-lg hover:bg-electric-blue/80">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </>
      ) : (
        <p className="text-text-secondary">The game has been linked to your league. Members can join from the league page.</p>
      )}
      <button onClick={onClose} className="w-full primary-button mt-4">Done</button>
    </div>
  );

  const stepTitles: Record<Step, string> = {
    select_type: 'Choose Live Game Type',
    link: 'Link to a League',
    confirm: 'Session Created'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">{stepTitles[step]}</h2>
          {matchName && <p className="text-text-secondary text-sm mt-1">{matchName}</p>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
          >
            {step === 'select_type' && renderSelectType()}
            {step === 'link' && renderLinkStep()}
            {step === 'confirm' && renderConfirmStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

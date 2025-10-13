import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { TOURNAMENT_COSTS } from '../config/constants';
import { TournamentType, BettingChallenge } from '../types';

type DurationType = 'daily' | 'mini' | 'season';

interface ChallengesAdminProps {
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
    onAddChallenge: (challenge: Omit<BettingChallenge, 'id' | 'status' | 'totalPlayers' | 'gameType' | 'is_linkable'>) => void;
}

const TOURNAMENT_TYPES: TournamentType[] = ['rookie', 'pro', 'elite'];
const DURATION_TYPES: DurationType[] = ['daily', 'mini', 'season'];

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = ({ addToast, onAddChallenge }) => {
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tournamentType, setTournamentType] = useState<TournamentType>('rookie');
    const [durationType, setDurationType] = useState<DurationType>('daily');
    const [challengeBalance, setChallengeBalance] = useState(1000);
    const [entryCost, setEntryCost] = useState(0);

    useEffect(() => {
        const cost = TOURNAMENT_COSTS[tournamentType].base * TOURNAMENT_COSTS[tournamentType].multipliers[durationType];
        setEntryCost(cost);
    }, [tournamentType, durationType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !startDate || !endDate) {
            addToast('Please fill all fields', 'error');
            return;
        }
        onAddChallenge({
            name,
            startDate,
            endDate,
            entryCost,
            challengeBalance,
            tournament_type: tournamentType,
            duration_type: durationType,
        });
        addToast('Challenge created!', 'success');
        // Reset form
        setName('');
        setStartDate('');
        setEndDate('');
    };

    const formField = "w-full p-3 bg-deep-navy border-2 border-disabled rounded-xl text-text-primary placeholder-text-disabled focus:border-electric-blue focus:ring-electric-blue/50 focus:outline-none transition-colors";

    return (
        <div className="card-base p-5 space-y-4">
            <h2 className="font-bold text-lg text-electric-blue">Create New Challenge</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Challenge Name" className={formField} required />
                <div className="grid grid-cols-2 gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={formField} required />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={formField} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <select value={tournamentType} onChange={e => setTournamentType(e.target.value as TournamentType)} className={formField}>
                        {TOURNAMENT_TYPES.map(t => <option key={t} value={t} className="capitalize bg-deep-navy">{t}</option>)}
                    </select>
                    <select value={durationType} onChange={e => setDurationType(e.target.value as DurationType)} className={formField}>
                        {DURATION_TYPES.map(d => <option key={d} value={d} className="capitalize bg-deep-navy">{d}</option>)}
                    </select>
                </div>
                <div className="bg-deep-navy p-3 rounded-lg text-center">
                    <p className="text-sm text-text-secondary">Calculated Entry Cost</p>
                    <p className="text-xl font-bold text-warm-yellow">{entryCost.toLocaleString()} coins</p>
                </div>
                <button type="submit" className="w-full primary-button flex items-center justify-center gap-2">
                    <Plus size={18} /> Create Challenge
                </button>
            </form>
        </div>
    );
};

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SwipeMatchDay, SwipeMatch, SwipePredictionOutcome } from '../types';
import { PlusCircle, Play, Square } from 'lucide-react';

interface SwipeAdminProps {
  swipeMatchDays: SwipeMatchDay[];
  onAddMatchDay: (matchDay: Omit<SwipeMatchDay, 'id' | 'status' | 'gameType'>) => void;
  onResolveMatch: (matchId: string, result: SwipePredictionOutcome) => void;
  onUpdateStatus: (matchDayId: string, status: 'Ongoing' | 'Finished') => void;
}

export const SwipeAdmin: React.FC<SwipeAdminProps> = ({ swipeMatchDays, onAddMatchDay, onResolveMatch, onUpdateStatus }) => {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-full text-left font-bold text-lg text-purple-700">
          Create New Swipe Game
        </button>
        {showAddForm && (
          <div className="mt-4">
            <SwipeMatchDayForm onSubmit={(data) => {
              onAddMatchDay(data);
              setShowAddForm(false);
            }} />
          </div>
        )}
      </div>

      {swipeMatchDays.map(matchDay => (
        <SwipeMatchDayAdminCard
          key={matchDay.id}
          matchDay={matchDay}
          onResolveMatch={onResolveMatch}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
};

const SwipeMatchDayForm: React.FC<{ onSubmit: (data: Omit<SwipeMatchDay, 'id'|'status'|'gameType'>) => void }> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [entryCost, setEntryCost] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalPlayers, setTotalPlayers] = useState('5000');
  const [matches, setMatches] = useState<Omit<SwipeMatch, 'id'>[]>([]);

  const addMatch = () => {
    setMatches([...matches, {
      teamA: { name: '', emoji: '' }, teamB: { name: '', emoji: '' },
      kickoffTime: '', odds: { teamA: 2.0, draw: 3.0, teamB: 2.5 }
    }]);
  };

  const handleMatchChange = (index: number, field: string, value: any) => {
    const newMatches = [...matches];
    const keys = field.split('.');
    if (keys.length === 2) {
      // @ts-ignore
      newMatches[index][keys[0]][keys[1]] = value;
    } else {
      // @ts-ignore
      newMatches[index][field] = value;
    }
    setMatches(newMatches);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMatches = matches.map(m => ({ ...m, id: uuidv4() }));
    onSubmit({ 
      name, 
      matches: finalMatches,
      entryCost: parseInt(entryCost),
      startDate,
      endDate,
      totalPlayers: parseInt(totalPlayers)
    });
  };

  const formField = "w-full p-2 border border-gray-300 rounded-md text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Game Name" className={formField} required />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={formField} required />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={formField} required />
      </div>
       <div className="grid grid-cols-2 gap-2">
        <input type="number" value={entryCost} onChange={e => setEntryCost(e.target.value)} placeholder="Entry Cost" className={formField} required />
        <input type="number" value={totalPlayers} onChange={e => setTotalPlayers(e.target.value)} placeholder="Total Players" className={formField} required />
      </div>
      {matches.map((match, index) => (
        <div key={index} className="bg-gray-100 p-3 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Match {index + 1}</h4>
          <div className="grid grid-cols-2 gap-2">
            <input onChange={e => handleMatchChange(index, 'teamA.name', e.target.value)} placeholder="Team A Name" className={formField} />
            <input onChange={e => handleMatchChange(index, 'teamA.emoji', e.target.value)} placeholder="Team A Emoji" className={formField} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input onChange={e => handleMatchChange(index, 'teamB.name', e.target.value)} placeholder="Team B Name" className={formField} />
            <input onChange={e => handleMatchChange(index, 'teamB.emoji', e.target.value)} placeholder="Team B Emoji" className={formField} />
          </div>
        </div>
      ))}
      <button type="button" onClick={addMatch} className="w-full flex items-center justify-center gap-2 text-sm p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold">
        <PlusCircle size={16} /> Add Match
      </button>
      <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold">Create Game</button>
    </form>
  );
};

const SwipeMatchDayAdminCard: React.FC<{
  matchDay: SwipeMatchDay;
  onResolveMatch: (matchId: string, result: SwipePredictionOutcome) => void;
  onUpdateStatus: (matchDayId: string, status: 'Ongoing' | 'Finished') => void;
}> = ({ matchDay, onResolveMatch, onUpdateStatus }) => {
  const statusColors = {
    Upcoming: 'bg-blue-100 text-blue-800',
    Ongoing: 'bg-green-100 text-green-800',
    Finished: 'bg-gray-200 text-gray-700',
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-gray-800">{matchDay.name}</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColors[matchDay.status]}`}>{matchDay.status}</span>
      </div>
      {matchDay.status === 'Upcoming' && (
        <button onClick={() => onUpdateStatus(matchDay.id, 'Ongoing')} className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-md hover:bg-green-200">
          <Play size={12} /> Start Game
        </button>
      )}
      {matchDay.status === 'Ongoing' && (
        <button onClick={() => onUpdateStatus(matchDay.id, 'Finished')} className="flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-md hover:bg-red-200">
          <Square size={12} /> End Game
        </button>
      )}
      <div className="space-y-2 border-t pt-3">
        {matchDay.matches.map(match => (
          <div key={match.id} className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-semibold">{match.teamA.name} vs {match.teamB.name}</p>
            {!match.result ? (
              <div className="grid grid-cols-3 gap-1 mt-2">
                <button onClick={() => onResolveMatch(match.id, 'teamA')} className="text-xs p-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">A Wins</button>
                <button onClick={() => onResolveMatch(match.id, 'draw')} className="text-xs p-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Draw</button>
                <button onClick={() => onResolveMatch(match.id, 'teamB')} className="text-xs p-1 bg-red-100 text-red-800 rounded hover:bg-red-200">B Wins</button>
              </div>
            ) : (
              <p className="text-xs font-bold text-green-600 mt-1">Result: {match.result}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

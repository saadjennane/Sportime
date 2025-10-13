import React from 'react';
import { UserTicket, TournamentType } from '../types';
import { X, Ticket } from 'lucide-react';
import { differenceInDays, parseISO, isBefore } from 'date-fns';

interface TicketWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: UserTicket[];
}

const tierDetails = {
  rookie: { label: 'Rookie', color: 'text-lime-glow', bg: 'bg-lime-glow/10' },
  pro: { label: 'Pro', color: 'text-warm-yellow', bg: 'bg-warm-yellow/10' },
  elite: { label: 'Elite', color: 'text-hot-red', bg: 'bg-hot-red/10' },
};

export const TicketWalletModal: React.FC<TicketWalletModalProps> = ({ isOpen, onClose, tickets }) => {
  if (!isOpen) return null;

  const validTickets = tickets.filter(t => !t.is_used && isBefore(new Date(), parseISO(t.expires_at)));

  const ticketSummary = {
    rookie: validTickets.filter(t => t.type === 'rookie'),
    pro: validTickets.filter(t => t.type === 'pro'),
    elite: validTickets.filter(t => t.type === 'elite'),
  };

  const getOldestExpiry = (ticketGroup: UserTicket[]) => {
    if (ticketGroup.length === 0) return null;
    const oldest = ticketGroup.sort((a, b) => parseISO(a.expires_at).getTime() - parseISO(b.expires_at).getTime())[0];
    return differenceInDays(parseISO(oldest.expires_at), new Date());
  };

  const TicketTier: React.FC<{ type: TournamentType }> = ({ type }) => {
    const details = tierDetails[type];
    const userTickets = ticketSummary[type];
    const expiryDays = getOldestExpiry(userTickets);

    return (
      <div className={`p-4 rounded-xl ${details.bg}`}>
        <div className="flex justify-between items-center">
          <h3 className={`font-bold text-lg ${details.color}`}>{details.label}</h3>
          <span className="font-bold text-text-primary text-xl">{userTickets.length}</span>
        </div>
        {expiryDays !== null && expiryDays >= 0 ? (
          <p className="text-xs text-text-secondary mt-1">Oldest expires in {expiryDays} days</p>
        ) : (
          <p className="text-xs text-text-disabled mt-1">No tickets available</p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Ticket /> Ticket Wallet
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        {validTickets.length === 0 ? (
          <div className="text-center py-8">
            <Ticket size={48} className="mx-auto text-text-disabled mb-4" />
            <h3 className="font-bold text-text-primary text-lg">No Tickets Yet!</h3>
            <p className="text-sm text-text-secondary mt-2">
              Earn tickets by winning tournaments. Tickets can be used to enter new challenges for free!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <TicketTier type="rookie" />
            <TicketTier type="pro" />
            <TicketTier type="elite" />
          </div>
        )}

        <div className="text-center text-sm text-text-secondary pt-2">
          <p>Tickets are used automatically when joining a matching tournament.</p>
        </div>
      </div>
    </div>
  );
};

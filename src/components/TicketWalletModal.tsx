import React from 'react';
import { X, Ticket } from 'lucide-react';
import { UserTicket, TicketTier } from '../types';
import { formatDistanceToNowStrict, parseISO, isBefore, format } from 'date-fns';

interface TicketWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: UserTicket[];
}

const tierDetails: Record<TicketTier, { label: string; color: string, iconColor: string }> = {
  amateur: { label: 'Amateur', color: 'border-lime-glow', iconColor: 'text-lime-glow' },
  master: { label: 'Master', color: 'border-warm-yellow', iconColor: 'text-warm-yellow' },
  apex: { label: 'Apex', color: 'border-hot-red', iconColor: 'text-hot-red' },
};

export const TicketWalletModal: React.FC<TicketWalletModalProps> = ({ isOpen, onClose, tickets }) => {
  if (!isOpen) return null;

  const now = new Date();
  const activeTickets = tickets.filter(t => !t.is_used && isBefore(now, parseISO(t.expires_at)));
  const expiredTickets = tickets.filter(t => !t.is_used && !isBefore(now, parseISO(t.expires_at)));
  
  const ticketsByType = (tier: TicketTier) => activeTickets.filter(t => t.type === tier);

  const TicketTierSection: React.FC<{ tier: TicketTier }> = ({ tier }) => {
    const details = tierDetails[tier];
    const tierTickets = ticketsByType(tier);
    const oldestTicket = tierTickets.length > 0 ? tierTickets.sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0] : null;

    return (
      <div className={`bg-deep-navy p-4 rounded-xl border-2 ${details.color}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket size={20} className={details.iconColor} />
            <h3 className={`text-lg font-bold ${details.iconColor}`}>{details.label}</h3>
          </div>
          <span className="font-bold text-text-primary">{tierTickets.length} <span className="text-sm text-text-disabled">/ {tier === 'amateur' ? 5 : tier === 'master' ? 3 : 2}</span></span>
        </div>
        {oldestTicket && (
          <p className="text-xs text-text-disabled mt-1">
            Oldest expires in {formatDistanceToNowStrict(parseISO(oldestTicket.expires_at))}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full h-auto max-h-[80vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Ticket className="text-lime-glow" /> My Tickets
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <h4 className="text-sm font-semibold text-text-secondary uppercase">Active Tickets</h4>
          {activeTickets.length > 0 ? (
            <>
              <TicketTierSection tier="amateur" />
              <TicketTierSection tier="master" />
              <TicketTierSection tier="apex" />
            </>
          ) : (
            <p className="text-center text-text-disabled py-4">You have no active tickets. Win them in tournaments!</p>
          )}

          {expiredTickets.length > 0 && (
            <div className="pt-4 mt-4 border-t border-disabled">
              <h4 className="text-sm font-semibold text-text-disabled uppercase mb-2">Expired Tickets</h4>
              <div className="space-y-2">
                {expiredTickets.map(ticket => (
                  <div key={ticket.id} className="bg-disabled/50 p-3 rounded-lg opacity-60">
                    <p className="font-semibold text-text-disabled capitalize">{ticket.type} Ticket</p>
                    <p className="text-xs text-text-disabled">Expired on {format(parseISO(ticket.expires_at), 'MMM d, yyyy')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { UserTicket } from '../types';
import { addDays } from 'date-fns';

export const mockUserTickets: UserTicket[] = [
  // Valid tickets for user-1
  {
    id: 'ticket-1',
    user_id: 'user-1',
    type: 'rookie',
    is_used: false,
    acquired_at: new Date().toISOString(),
    expires_at: addDays(new Date(), 14).toISOString(),
  },
  {
    id: 'ticket-2',
    user_id: 'user-1',
    type: 'rookie',
    is_used: false,
    acquired_at: new Date().toISOString(),
    expires_at: addDays(new Date(), 28).toISOString(),
  },
  {
    id: 'ticket-3',
    user_id: 'user-1',
    type: 'pro',
    is_used: false,
    acquired_at: new Date().toISOString(),
    expires_at: addDays(new Date(), 40).toISOString(),
  },
  // Used ticket
  {
    id: 'ticket-4',
    user_id: 'user-1',
    type: 'rookie',
    is_used: true,
    acquired_at: addDays(new Date(), -10).toISOString(),
    expires_at: addDays(new Date(), 20).toISOString(),
    used_at: addDays(new Date(), -5).toISOString(),
  },
  // Expired ticket
   {
    id: 'ticket-5',
    user_id: 'user-1',
    type: 'pro',
    is_used: false,
    acquired_at: addDays(new Date(), -50).toISOString(),
    expires_at: addDays(new Date(), -5).toISOString(),
  },
];

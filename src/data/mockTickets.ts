import { UserTicket } from '../types';
import { addDays, subDays } from 'date-fns';

const now = new Date();

export const mockUserTickets: UserTicket[] = [
  // Valid tickets for user-1
  { id: 't1', user_id: 'user-1', type: 'amateur', is_used: false, created_at: subDays(now, 5).toISOString(), expires_at: addDays(now, 25).toISOString() },
  { id: 't2', user_id: 'user-1', type: 'amateur', is_used: false, created_at: subDays(now, 2).toISOString(), expires_at: addDays(now, 28).toISOString() },
  { id: 't3', user_id: 'user-1', type: 'master', is_used: false, created_at: subDays(now, 10).toISOString(), expires_at: addDays(now, 35).toISOString() },
  
  // Used ticket
  { id: 't4', user_id: 'user-1', type: 'amateur', is_used: true, created_at: subDays(now, 15).toISOString(), expires_at: addDays(now, 15).toISOString(), used_at: subDays(now, 1).toISOString() },
  
  // Expired ticket
  { id: 't5', user_id: 'user-1', type: 'apex', is_used: false, created_at: subDays(now, 65).toISOString(), expires_at: subDays(now, 5).toISOString() },
];

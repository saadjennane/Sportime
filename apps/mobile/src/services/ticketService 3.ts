/**
 * Ticket Service
 *
 * Handles all ticket-related operations with Supabase backend
 * Supports three tiers: amateur, master, apex
 */

import { supabase } from '../lib/supabaseClient';
import { TicketTier, UserTicket } from '../types';

export interface GrantTicketResponse {
  success: boolean;
  message: string;
  ticketId?: string;
}

export interface UseTicketResponse {
  success: boolean;
  message: string;
}

export interface TicketCounts {
  amateur: number;
  master: number;
  apex: number;
}

/**
 * Grant a ticket to a user
 *
 * @param userId - UUID of the user
 * @param ticketType - Tier of ticket (amateur, master, or apex)
 * @param reason - Why the ticket was granted (default: 'reward')
 * @returns Promise with success status, message, and ticket ID if successful
 */
export async function grantTicket(
  userId: string,
  ticketType: TicketTier,
  reason: string = 'reward'
): Promise<GrantTicketResponse> {
  try {
    const { data, error } = await supabase.rpc('grant_ticket', {
      p_user_id: userId,
      p_ticket_type: ticketType,
      p_granted_reason: reason
    });

    if (error) {
      console.error('[TicketService] Error granting ticket:', error);
      return { success: false, message: `Failed to grant ticket: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'Unknown error granting ticket' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      ticketId: result.ticket_id
    };
  } catch (err) {
    console.error('[TicketService] Exception granting ticket:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Use a ticket for a challenge
 *
 * @param userId - UUID of the user
 * @param ticketId - UUID of the ticket to use
 * @param challengeId - UUID of the challenge
 * @returns Promise with success status and message
 */
export async function useTicket(
  userId: string,
  ticketId: string,
  challengeId: string
): Promise<UseTicketResponse> {
  try {
    const { data, error } = await supabase.rpc('use_ticket', {
      p_user_id: userId,
      p_ticket_id: ticketId,
      p_challenge_id: challengeId
    });

    if (error) {
      console.error('[TicketService] Error using ticket:', error);
      return { success: false, message: `Failed to use ticket: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'Unknown error using ticket' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message
    };
  } catch (err) {
    console.error('[TicketService] Exception using ticket:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Get all tickets for a user with optional filtering
 *
 * @param userId - UUID of the user
 * @param ticketType - Optional: filter by specific tier
 * @param includeExpired - Include expired tickets (default: false)
 * @param includeUsed - Include used tickets (default: false)
 * @returns Promise with array of tickets
 */
export async function getUserTickets(
  userId: string,
  ticketType?: TicketTier,
  includeExpired: boolean = false,
  includeUsed: boolean = false
): Promise<UserTicket[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_tickets', {
      p_user_id: userId,
      p_ticket_type: ticketType || null,
      p_include_expired: includeExpired,
      p_include_used: includeUsed
    });

    if (error) {
      console.error('[TicketService] Error getting user tickets:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Map database response to UserTicket type
    return data.map((ticket: any) => ({
      id: ticket.id,
      user_id: userId,
      type: ticket.ticket_type as TicketTier,
      is_used: ticket.is_used,
      created_at: ticket.created_at,
      expires_at: ticket.expires_at,
      used_at: ticket.used_at || undefined
    }));
  } catch (err) {
    console.error('[TicketService] Exception getting user tickets:', err);
    return [];
  }
}

/**
 * Get count of active tickets by type for a user
 *
 * @param userId - UUID of the user
 * @returns Promise with counts for each tier
 */
export async function getTicketCounts(userId: string): Promise<TicketCounts> {
  try {
    const { data, error } = await supabase.rpc('get_ticket_counts', {
      p_user_id: userId
    });

    if (error) {
      console.error('[TicketService] Error getting ticket counts:', error);
      return { amateur: 0, master: 0, apex: 0 };
    }

    // Initialize counts
    const counts: TicketCounts = { amateur: 0, master: 0, apex: 0 };

    // Map database response to counts
    if (data && Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.ticket_type === 'amateur') counts.amateur = parseInt(item.count || 0);
        if (item.ticket_type === 'master') counts.master = parseInt(item.count || 0);
        if (item.ticket_type === 'apex') counts.apex = parseInt(item.count || 0);
      });
    }

    return counts;
  } catch (err) {
    console.error('[TicketService] Exception getting ticket counts:', err);
    return { amateur: 0, master: 0, apex: 0 };
  }
}

/**
 * Check if user has a valid (unused, non-expired) ticket of the required tier
 *
 * @param userId - UUID of the user
 * @param tierRequired - Tier required (amateur, master, or apex)
 * @returns Promise with boolean indicating if user has valid ticket
 */
export async function hasValidTicket(
  userId: string,
  tierRequired: TicketTier
): Promise<boolean> {
  const tickets = await getUserTickets(userId, tierRequired, false, false);
  return tickets.length > 0;
}

/**
 * Get the oldest valid ticket of a specific type (for automatic selection)
 *
 * @param userId - UUID of the user
 * @param ticketType - Tier of ticket
 * @returns Promise with the oldest ticket or null if none found
 */
export async function getOldestTicket(
  userId: string,
  ticketType: TicketTier
): Promise<UserTicket | null> {
  const tickets = await getUserTickets(userId, ticketType, false, false);

  if (tickets.length === 0) {
    return null;
  }

  // Tickets are already sorted by created_at DESC from the RPC function
  // We want the oldest, so take the last one
  return tickets[tickets.length - 1];
}

/**
 * Cleanup expired tickets (should be run periodically)
 *
 * @returns Promise with count of tickets that were cleaned up
 */
export async function cleanupExpiredTickets(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_tickets');

    if (error) {
      console.error('[TicketService] Error cleaning up expired tickets:', error);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    return data[0].expired_count || 0;
  } catch (err) {
    console.error('[TicketService] Exception cleaning up expired tickets:', err);
    return 0;
  }
}

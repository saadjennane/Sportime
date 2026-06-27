import { supabase } from './supabase';
import type { Database } from '../types/supabase';

type Squad = Database['public']['Tables']['squads']['Row'];
type SquadInsert = Database['public']['Tables']['squads']['Insert'];
type SquadUpdate = Database['public']['Tables']['squads']['Update'];
type SquadMember = Database['public']['Tables']['squad_members']['Row'];
type SquadGame = Database['public']['Tables']['squad_games']['Row'];
type SquadFeedPost = Database['public']['Tables']['squad_feed']['Row'];
type SquadLeaderboardSnapshot = Database['public']['Tables']['squad_leaderboard_snapshots']['Row'];
type SquadPrivateGame = Database['public']['Tables']['squad_private_games']['Row'];

/**
 * Squad Management Service
 * Handles all CRUD operations for the Squads feature (formerly Leagues)
 */

// ============================================================================
// SQUAD CRUD OPERATIONS
// ============================================================================

/**
 * Create a new squad
 */
export async function createSquad(
  userId: string,
  data: {
    name: string;
    description?: string;
    image_url?: string;
    season_start_date?: string;
    season_end_date?: string;
  }
): Promise<Squad> {
  // Via SECURITY DEFINER RPC (direct insert is blocked by RLS in the app context).
  const { data: squad, error } = await supabase.rpc('create_squad', {
    p_user_id: userId,
    p_name: data.name,
    p_description: data.description ?? null,
    p_image_url: data.image_url ?? null,
  });

  if (error) {
    console.error('[squadService] Failed to create squad:', error);
    throw error;
  }

  return squad as Squad;
}

/**
 * Get a squad by ID with member count
 */
export async function getSquadById(squadId: string): Promise<Squad & { member_count: number }> {
  const { data: squad, error: squadError } = await supabase
    .from('squads')
    .select('*')
    .eq('id', squadId)
    .single();

  if (squadError) {
    console.error('[squadService] Failed to get squad:', squadError);
    throw squadError;
  }

  // Get member count
  const { count, error: countError } = await supabase
    .from('squad_members')
    .select('*', { count: 'exact', head: true })
    .eq('squad_id', squadId);

  if (countError) {
    console.error('[squadService] Failed to count members:', countError);
    throw countError;
  }

  return {
    ...squad,
    member_count: count || 0,
  };
}

/**
 * Get all squads for a user
 */
export async function getUserSquads(userId: string): Promise<(Squad & { member_count: number; role: string })[]> {
  const { data: memberships, error } = await supabase
    .from('squad_members')
    .select(`
      role,
      squads (*)
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('[squadService] Failed to get user squads:', error);
    throw error;
  }

  // Get member counts for each squad
  const squadsWithCounts = await Promise.all(
    memberships.map(async (membership: any) => {
      const { count } = await supabase
        .from('squad_members')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', membership.squads.id);

      return {
        ...membership.squads,
        member_count: count || 0,
        role: membership.role,
      };
    })
  );

  return squadsWithCounts;
}

/**
 * Update a squad
 */
export async function updateSquad(
  squadId: string,
  updates: {
    name?: string;
    description?: string;
    image_url?: string;
    season_start_date?: string;
    season_end_date?: string;
  }
): Promise<Squad> {
  const { data: squad, error } = await supabase
    .from('squads')
    .update(updates)
    .eq('id', squadId)
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to update squad:', error);
    throw error;
  }

  return squad;
}

/**
 * Delete a squad (admin only)
 */
export async function deleteSquad(squadId: string): Promise<void> {
  const { error } = await supabase
    .from('squads')
    .delete()
    .eq('id', squadId);

  if (error) {
    console.error('[squadService] Failed to delete squad:', error);
    throw error;
  }
}

// ============================================================================
// SQUAD MEMBERSHIP OPERATIONS
// ============================================================================

/**
 * Join a squad using invite code
 */
export async function joinSquad(userId: string, inviteCode: string): Promise<{ squad_id: string }> {
  // Via SECURITY DEFINER RPC (find squad by code + insert membership, bypassing RLS).
  const { data: squadId, error } = await supabase.rpc('join_squad', {
    p_user_id: userId,
    p_invite_code: inviteCode,
  });

  if (error) {
    if (error.message === 'invalid_code') throw new Error('Invalid invite code');
    console.error('[squadService] Failed to join squad:', error);
    throw error;
  }

  return { squad_id: squadId as string };
}

/**
 * Get all members of a squad
 */
export async function getSquadMembers(squadId: string): Promise<(SquadMember & { user: any })[]> {
  const { data: members, error } = await supabase
    .from('squad_members')
    .select(`
      *,
      users (id, username, profile_picture_url, level_name, xp_total)
    `)
    .eq('squad_id', squadId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[squadService] Failed to get squad members:', error);
    throw error;
  }

  return members as any;
}

/**
 * Update member role (admin only)
 */
export async function updateMemberRole(
  squadId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<SquadMember> {
  const { data: member, error } = await supabase
    .from('squad_members')
    .update({ role })
    .eq('squad_id', squadId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to update member role:', error);
    throw error;
  }

  return member;
}

/**
 * Remove a member from squad (admin only)
 */
export async function removeMember(squadId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);

  if (error) {
    console.error('[squadService] Failed to remove member:', error);
    throw error;
  }
}

/**
 * Leave a squad
 */
export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  // Check if user is the creator
  const { data: squad } = await supabase
    .from('squads')
    .select('created_by')
    .eq('id', squadId)
    .single();

  if (squad?.created_by === userId) {
    throw new Error('Squad creator cannot leave. Delete the squad instead.');
  }

  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);

  if (error) {
    console.error('[squadService] Failed to leave squad:', error);
    throw error;
  }
}

// ============================================================================
// SQUAD GAMES (LINKED CHALLENGES)
// ============================================================================

/**
 * Link a challenge to multiple squads
 */
export async function linkGameToSquads(
  gameId: string,
  gameType: string,
  squadIds: string[],
  linkedBy: string
): Promise<number> {
  // Via SECURITY DEFINER RPC (validates membership, bypasses RLS, polymorphic game_type).
  const { data, error } = await supabase.rpc('link_game_to_squads', {
    p_user_id: linkedBy,
    p_game_id: gameId,
    p_game_type: gameType,
    p_squad_ids: squadIds,
  });

  if (error) {
    console.error('[squadService] Failed to link game to squads:', error);
    throw error;
  }

  return (data as number) ?? 0;
}

/**
 * Unlink a game from a squad
 */
export async function unlinkGame(squadId: string, gameId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('unlink_squad_game', {
    p_user_id: userId,
    p_squad_id: squadId,
    p_game_id: gameId,
  });

  if (error) {
    console.error('[squadService] Failed to unlink game:', error);
    throw error;
  }
}

/**
 * Get all games linked to a squad (raw rows; the client resolves each game from
 * its catalog / live-games source by game_type).
 */
export async function getSquadGames(squadId: string): Promise<any[]> {
  const { data: games, error } = await supabase
    .from('squad_games')
    .select('id, squad_id, game_id, game_type, linked_by, linked_at')
    .eq('squad_id', squadId)
    .order('linked_at', { ascending: false });

  if (error) {
    console.error('[squadService] Failed to get squad games:', error);
    throw error;
  }

  return games as any;
}

// ============================================================================
// SQUAD FEED (SOCIAL POSTS)
// ============================================================================

/**
 * Get squad feed posts
 */
export async function getSquadFeed(squadId: string, limit: number = 50): Promise<any[]> {
  const { data: posts, error } = await supabase
    .from('squad_feed')
    .select(`
      *,
      users!squad_feed_user_id_fkey (id, username, avatar_url),
      squad_feed_likes (user_id, reaction),
      squad_feed_comments (count)
    `)
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[squadService] Failed to get squad feed:', error);
    throw error;
  }

  return posts as any;
}

/**
 * Create a celebration post when squad wins
 */
export async function createCelebrationPost(
  squadId: string,
  gameId: string,
  userId: string,
  message: string,
  metadata?: Record<string, any>
): Promise<SquadFeedPost> {
  const { data: post, error } = await supabase
    .from('squad_feed')
    .insert({
      squad_id: squadId,
      user_id: userId,
      post_type: 'celebration',
      content: message,
      related_game_id: gameId,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to create celebration post:', error);
    throw error;
  }

  return post;
}

/**
 * Toggle like on a feed post
 */
export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean }> {
  // Check if already liked
  const { data: existingLike } = await supabase
    .from('squad_feed_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingLike) {
    // Unlike
    const { error } = await supabase
      .from('squad_feed_likes')
      .delete()
      .eq('id', existingLike.id);

    if (error) {
      console.error('[squadService] Failed to unlike post:', error);
      throw error;
    }

    return { liked: false };
  } else {
    // Like
    const { error } = await supabase
      .from('squad_feed_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      });

    if (error) {
      console.error('[squadService] Failed to like post:', error);
      throw error;
    }

    return { liked: true };
  }
}

// ============================================================================
// REACTIONS (multi-emoji) — one reaction per user per post
// ============================================================================

export const SQUAD_REACTIONS = ['👍', '🔥', '😂', '😮', '💪', '😭'] as const;

/** Set the user's reaction on a post, or clear it when emoji is null / same as current. */
export async function setReaction(postId: string, userId: string, emoji: string | null): Promise<void> {
  if (!emoji) {
    const { error } = await supabase.from('squad_feed_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('squad_feed_likes')
    .upsert({ post_id: postId, user_id: userId, reaction: emoji }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function getSquadComments(postId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('squad_feed_comments')
    .select('id, body, created_at, user_id, users!squad_feed_comments_user_id_fkey (username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(postId: string, userId: string, body: string): Promise<any> {
  const { data, error } = await supabase
    .from('squad_feed_comments')
    .insert({ post_id: postId, user_id: userId, body })
    .select('id, body, created_at, user_id, users!squad_feed_comments_user_id_fkey (username, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('squad_feed_comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ============================================================================
// SQUAD LEADERBOARD SNAPSHOTS
// ============================================================================

/**
 * Create a leaderboard snapshot when squad achieves something
 */
export async function createLeaderboardSnapshot(
  squadId: string,
  gameId: string,
  leaderboardData: any,
  celebrationMessage?: string
): Promise<SquadLeaderboardSnapshot> {
  const { data: snapshot, error } = await supabase
    .from('squad_leaderboard_snapshots')
    .insert({
      squad_id: squadId,
      game_id: gameId,
      leaderboard_data: leaderboardData,
      celebration_message: celebrationMessage,
    })
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to create leaderboard snapshot:', error);
    throw error;
  }

  return snapshot;
}

/**
 * Get leaderboard snapshots for a squad
 */
export async function getSquadSnapshots(squadId: string, limit: number = 20): Promise<SquadLeaderboardSnapshot[]> {
  const { data: snapshots, error } = await supabase
    .from('squad_leaderboard_snapshots')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[squadService] Failed to get squad snapshots:', error);
    throw error;
  }

  return snapshots;
}

// ============================================================================
// SQUAD PRIVATE GAMES
// ============================================================================

/**
 * Create a private tournament for squad members only
 */
export async function createPrivateSquadGame(
  squadId: string,
  createdBy: string,
  data: {
    name: string;
    description?: string;
    tournament_type: 'amateur' | 'master' | 'apex';
    starts_at: string;
    ends_at: string;
    entry_fee?: number;
    prize_pool?: number;
    max_participants?: number;
  }
): Promise<SquadPrivateGame> {
  const { data: game, error } = await supabase
    .from('squad_private_games')
    .insert({
      squad_id: squadId,
      created_by: createdBy,
      name: data.name,
      description: data.description,
      tournament_type: data.tournament_type,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      entry_fee: data.entry_fee,
      prize_pool: data.prize_pool,
      max_participants: data.max_participants,
      status: 'upcoming',
    })
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to create private game:', error);
    throw error;
  }

  return game;
}

/**
 * Get private games for a squad
 */
export async function getSquadPrivateGames(squadId: string): Promise<SquadPrivateGame[]> {
  const { data: games, error } = await supabase
    .from('squad_private_games')
    .select('*')
    .eq('squad_id', squadId)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('[squadService] Failed to get private games:', error);
    throw error;
  }

  return games;
}

/**
 * Update private game status
 */
export async function updatePrivateGameStatus(
  gameId: string,
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
): Promise<SquadPrivateGame> {
  const { data: game, error } = await supabase
    .from('squad_private_games')
    .update({ status })
    .eq('id', gameId)
    .select()
    .single();

  if (error) {
    console.error('[squadService] Failed to update private game status:', error);
    throw error;
  }

  return game;
}

/** Live games linked to a squad, mapped to the LeaguePage LiveGameCard shape. */
export async function getSquadLiveGames(squadId: string): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_squad_live_games', { p_squad_id: squadId });
  if (error) {
    console.error('[squadService] Failed to get squad live games:', error);
    return [];
  }
  const cap = (s: string) => (s === 'live' ? 'Ongoing' : s === 'finished' ? 'Finished' : 'Upcoming');
  return ((data as any[]) || []).map((g) => ({
    id: g.id,
    status: cap(g.status),
    match_details: { teamA: { name: g.home_team }, teamB: { name: g.away_team } },
    players: Array.from({ length: g.players || 0 }),
  }));
}

/** Admin: change a member's role (admin/member). */
export async function setMemberRoleRpc(squadId: string, targetUserId: string, role: 'admin' | 'member', actorId: string): Promise<void> {
  const { error } = await supabase.rpc('squad_set_member_role', {
    p_actor: actorId, p_squad_id: squadId, p_target: targetUserId, p_role: role,
  });
  if (error) throw error;
}

/** Admin: remove a member from the squad. */
export async function kickMember(squadId: string, targetUserId: string, actorId: string): Promise<void> {
  const { error } = await supabase.rpc('squad_remove_member', {
    p_actor: actorId, p_squad_id: squadId, p_target: targetUserId,
  });
  if (error) throw error;
}

/** Admin: block a member (removes them and prevents rejoining via the code). */
export async function blockMember(squadId: string, targetUserId: string, actorId: string): Promise<void> {
  const { error } = await supabase.rpc('squad_block_member', {
    p_actor: actorId, p_squad_id: squadId, p_target: targetUserId,
  });
  if (error) throw error;
}

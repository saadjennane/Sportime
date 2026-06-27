import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { getSquadFeed, setReaction, getSquadComments, addComment, SQUAD_REACTIONS } from '../../services/squadService';

// Real (Supabase-backed) squad feed: auto-moments + manual posts, with multi-emoji
// reactions and lightweight comments. Self-contained — owns its loading & mutations.

interface FeedItem {
  id: string;
  post_type: string;
  content: string;
  created_at: string;
  author: { username?: string; avatar_url?: string } | null;
  authorId: string;
  reactions: Record<string, number>;
  myReaction: string | null;
  commentCount: number;
  topPlayers?: { name: string; score: number }[];
}

const TYPE_GLYPH: Record<string, string> = {
  celebration: '🎉', announcement: '🗣️', game_linked: '🎮', member_joined: '👋',
  game_settled: '🏁', lead_change: '👑', overtake: '↗️', near_miss: '😭', bold_pick: '🔮', streak: '🔥',
};

function mapRow(row: any, userId: string): FeedItem {
  const likes: { user_id: string; reaction: string }[] = row.squad_feed_likes ?? [];
  const reactions: Record<string, number> = {};
  let myReaction: string | null = null;
  for (const l of likes) {
    reactions[l.reaction] = (reactions[l.reaction] ?? 0) + 1;
    if (l.user_id === userId) myReaction = l.reaction;
  }
  return {
    id: row.id, post_type: row.post_type, content: row.content, created_at: row.created_at,
    author: row.users ? { username: row.users.username, avatar_url: row.users.avatar_url } : null,
    authorId: row.user_id,
    reactions, myReaction,
    commentCount: row.squad_feed_comments?.[0]?.count ?? 0,
    topPlayers: row.metadata?.top_players,
  };
}

export const SquadFeed: React.FC<{ squadId: string; currentUserId: string }> = ({ squadId, currentUserId }) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await getSquadFeed(squadId);
      setItems(rows.map((r: any) => mapRow(r, currentUserId)));
    } catch (e) {
      console.error('[SquadFeed] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [squadId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  // Optimistic reaction toggle.
  const react = (item: FeedItem, emoji: string) => {
    const clearing = item.myReaction === emoji;
    setItems(prev => prev.map(it => {
      if (it.id !== item.id) return it;
      const reactions = { ...it.reactions };
      if (it.myReaction) reactions[it.myReaction] = Math.max(0, (reactions[it.myReaction] ?? 1) - 1);
      const myReaction = clearing ? null : emoji;
      if (myReaction) reactions[myReaction] = (reactions[myReaction] ?? 0) + 1;
      return { ...it, reactions, myReaction };
    }));
    setReaction(item.id, currentUserId, clearing ? null : emoji).catch(() => load());
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;

  if (items.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <div className="text-6xl mb-4">🤫</div>
        <p className="text-text-secondary font-medium">The feed is quiet…</p>
        <p className="text-sm text-text-disabled mt-2">Join a game together — your squad's moments will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <SquadFeedCard key={item.id} item={item} currentUserId={currentUserId} onReact={react} />
      ))}
    </div>
  );
};

const SquadFeedCard: React.FC<{ item: FeedItem; currentUserId: string; onReact: (item: FeedItem, emoji: string) => void }> = ({ item, currentUserId, onReact }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [count, setCount] = useState(item.commentCount);

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      setLoadingComments(true);
      try { setComments(await getSquadComments(item.id)); }
      catch (e) { console.error('[SquadFeed] comments failed', e); }
      finally { setLoadingComments(false); }
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const c = await addComment(item.id, currentUserId, body);
      setComments(prev => [...prev, c]);
      setCount(n => n + 1);
      setDraft('');
    } catch (e) { console.error('[SquadFeed] addComment failed', e); }
    finally { setSending(false); }
  };

  return (
    <div className="card-base p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img
          src={item.author?.avatar_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${item.authorId}`}
          alt={item.author?.username || 'user'}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="font-bold text-text-primary truncate">{item.author?.username || 'A member'}</p>
          <p className="text-xs text-text-disabled">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
        </div>
      </div>

      {/* Content */}
      <p className="text-text-primary whitespace-pre-wrap">{TYPE_GLYPH[item.post_type] ?? ''} {item.content}</p>
      {item.topPlayers && item.topPlayers.length > 0 && (
        <div className="space-y-1">
          {item.topPlayers.slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span>{['🥇', '🥈', '🥉'][i]}</span>
              <span className="font-bold text-text-primary">{p.name}</span>
              <span className="text-warm-yellow">{p.score} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Reactions bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SQUAD_REACTIONS.map(emoji => {
          const n = item.reactions[emoji] ?? 0;
          const mine = item.myReaction === emoji;
          return (
            <button
              key={emoji}
              onClick={() => onReact(item, emoji)}
              className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full border transition-colors ${mine ? 'border-electric-blue bg-electric-blue/15' : 'border-white/10 hover:bg-white/5'}`}
            >
              <span>{emoji}</span>
              {n > 0 && <span className={`text-xs ${mine ? 'text-electric-blue' : 'text-text-secondary'}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      {/* Comments */}
      <div className="pt-2 border-t border-white/10">
        <button onClick={toggleComments} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary">
          <MessageSquare size={16} /> {count > 0 ? `${count} comment${count > 1 ? 's' : ''}` : 'Comment'}
        </button>

        {showComments && (
          <div className="mt-3 space-y-3">
            {loadingComments ? (
              <div className="flex justify-center py-2"><Loader2 className="animate-spin text-text-disabled" size={18} /></div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <img src={c.users?.avatar_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${c.user_id}`} alt="" className="w-7 h-7 rounded-full object-cover mt-0.5" />
                  <div className="bg-deep-navy rounded-xl px-3 py-2 flex-1">
                    <p className="text-xs font-semibold text-text-primary">{c.users?.username || 'A member'}</p>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send(); }}
                maxLength={500}
                placeholder="Add a comment…"
                className="flex-1 bg-deep-navy border border-white/10 rounded-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-electric-blue"
              />
              <button onClick={send} disabled={!draft.trim() || sending} className="text-electric-blue disabled:opacity-40 p-2">
                {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SquadFeed;

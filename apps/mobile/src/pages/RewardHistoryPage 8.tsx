import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Gift, Ticket, Zap, Coins, Filter, X, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import * as rewardHistoryService from '../services/rewardHistoryService';
import { RewardHistoryItem, RewardStats } from '../services/rewardHistoryService';
import { Profile } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface RewardHistoryPageProps {
  profile: Profile | null;
}

const RewardHistoryPage: React.FC<RewardHistoryPageProps> = ({ profile }) => {
  const [rewards, setRewards] = useState<RewardHistoryItem[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (profile) {
      loadRewardHistory();
      loadStats();
    }
  }, [profile, filterType, filterStatus]);

  const loadRewardHistory = async () => {
    if (!profile) return;

    setLoading(true);
    const filters: any = {};
    if (filterType !== 'all') filters.reward_type = filterType;
    if (filterStatus !== 'all') filters.status = filterStatus;

    const result = await rewardHistoryService.getUserRewardHistory(
      profile.id,
      100,
      0,
      filters
    );

    if (result.success) {
      setRewards(result.rewards);
    }

    setLoading(false);
  };

  const loadStats = async () => {
    if (!profile) return;

    const result = await rewardHistoryService.getUserRewardStats(profile.id);
    if (result.success && result.stats) {
      setStats(result.stats);
    }
  };

  const resetFilters = () => {
    setFilterType('all');
    setFilterStatus('all');
  };

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all';

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-text-secondary">Please sign in to view your reward history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Trophy className="text-warm-yellow" size={28} />
            Reward History
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Track all your earned rewards and their status
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            showFilters || hasActiveFilters
              ? 'bg-electric-blue/20 text-electric-blue'
              : 'bg-navy-accent hover:bg-white/10 text-text-secondary'
          }`}
        >
          <Filter size={16} />
          Filters
          {hasActiveFilters && (
            <span className="bg-electric-blue text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {(filterType !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card-base p-4 space-y-3 animate-scale-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">Filter Rewards</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-electric-blue hover:underline flex items-center gap-1"
              >
                <X size={12} />
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Reward Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-base w-full text-sm"
              >
                <option value="all">All Types</option>
                <option value="coins">Coins</option>
                <option value="xp">XP</option>
                <option value="ticket">Tickets</option>
                <option value="spin">Spins</option>
                <option value="giftcard">Gift Cards</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-base w-full text-sm"
              >
                <option value="all">All Status</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card-base p-3">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-warm-yellow" />
              <p className="text-xs text-text-secondary">Total Rewards</p>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.total_rewards}</p>
          </div>
          <div className="card-base p-3">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={16} className="text-warm-yellow" />
              <p className="text-xs text-text-secondary">Coins Earned</p>
            </div>
            <p className="text-2xl font-bold text-warm-yellow">{stats.total_coins.toLocaleString()}</p>
          </div>
          <div className="card-base p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-electric-blue" />
              <p className="text-xs text-text-secondary">XP Earned</p>
            </div>
            <p className="text-2xl font-bold text-electric-blue">{stats.total_xp.toLocaleString()}</p>
          </div>
          <div className="card-base p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-warm-yellow" />
              <p className="text-xs text-text-secondary">Pending</p>
            </div>
            <p className="text-2xl font-bold text-warm-yellow">{stats.pending_fulfillments}</p>
          </div>
        </div>
      )}

      {/* Rewards List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-electric-blue"></div>
        </div>
      ) : rewards.length === 0 ? (
        <div className="card-base p-12 text-center">
          <Gift className="mx-auto text-text-disabled mb-3" size={48} />
          <p className="text-text-secondary font-semibold">
            {hasActiveFilters ? 'No rewards match your filters' : 'No rewards earned yet'}
          </p>
          <p className="text-xs text-text-disabled mt-2">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results'
              : 'Start playing games to earn rewards!'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-electric-blue/20 text-electric-blue rounded-lg font-semibold hover:bg-electric-blue/30 transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map((reward) => {
            const typeStyle = rewardHistoryService.getRewardTypeStyle(reward.reward_type);
            const statusStyle = rewardHistoryService.getStatusStyle(reward.status);

            return (
              <div key={reward.id} className="card-base p-4 hover:border-electric-blue/50 transition-all">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Reward Info */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`text-2xl p-2 rounded-lg ${typeStyle.color}`}>
                      {typeStyle.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text-primary">
                          {rewardHistoryService.formatRewardValue(reward)}
                        </h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                        <span>{reward.source_name}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(reward.earned_at), { addSuffix: true })}</span>
                      </div>
                      {reward.fulfillment_details && (
                        <div className="mt-2 p-2 bg-navy-accent rounded text-xs">
                          {reward.fulfillment_details.code && (
                            <div>
                              <span className="text-text-secondary">Code: </span>
                              <span className="font-mono text-text-primary">{reward.fulfillment_details.code}</span>
                            </div>
                          )}
                          {reward.fulfillment_details.link && (
                            <div className="mt-1">
                              <a
                                href={reward.fulfillment_details.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-electric-blue hover:underline"
                              >
                                View Details →
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Status Icon */}
                  <div>
                    {reward.status === 'fulfilled' ? (
                      <CheckCircle className="text-lime-glow" size={20} />
                    ) : reward.status === 'failed' ? (
                      <AlertCircle className="text-hot-red" size={20} />
                    ) : (
                      <Clock className="text-warm-yellow" size={20} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RewardHistoryPage;

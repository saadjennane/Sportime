import React, { useState, useEffect } from 'react';
import { Gift, Check, X, Clock, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import * as rewardFulfillmentService from '../../services/rewardFulfillmentService';
import { RewardFulfillment, FulfillmentStatus } from '../../services/rewardFulfillmentService';

interface RewardFulfillmentManagerProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const RewardFulfillmentManager: React.FC<RewardFulfillmentManagerProps> = ({ addToast }) => {
  const [fulfillments, setFulfillments] = useState<RewardFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFulfillment, setSelectedFulfillment] = useState<RewardFulfillment | null>(null);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);

  // Fulfillment form state
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'email' | 'in_app' | 'external_api'>('in_app');
  const [fulfillmentCode, setFulfillmentCode] = useState('');
  const [fulfillmentLink, setFulfillmentLink] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPendingFulfillments();
  }, []);

  const loadPendingFulfillments = async () => {
    setLoading(true);
    const result = await rewardFulfillmentService.getPendingFulfillments(100, 0);

    if (result.success) {
      setFulfillments(result.fulfillments);
    } else {
      addToast(result.error || 'Failed to load fulfillments', 'error');
    }

    setLoading(false);
  };

  const handleOpenFulfillModal = (fulfillment: RewardFulfillment) => {
    setSelectedFulfillment(fulfillment);
    setIsFulfillModalOpen(true);
    setFulfillmentMethod('in_app');
    setFulfillmentCode('');
    setFulfillmentLink('');
    setAdminNotes('');
  };

  const handleFulfillReward = async () => {
    if (!selectedFulfillment) return;

    setSubmitting(true);

    const fulfillmentDetails: any = {
      method: fulfillmentMethod,
    };

    if (fulfillmentCode) fulfillmentDetails.code = fulfillmentCode;
    if (fulfillmentLink) fulfillmentDetails.link = fulfillmentLink;

    const result = await rewardFulfillmentService.fulfillReward({
      fulfillmentId: selectedFulfillment.id,
      fulfillmentMethod,
      fulfillmentDetails,
      adminNotes: adminNotes || undefined,
    });

    if (result.success) {
      addToast('Reward fulfilled successfully!', 'success');
      setIsFulfillModalOpen(false);
      loadPendingFulfillments(); // Refresh list
    } else {
      addToast(result.error || 'Failed to fulfill reward', 'error');
    }

    setSubmitting(false);
  };

  const handleUpdateStatus = async (fulfillmentId: string, newStatus: FulfillmentStatus) => {
    const result = await rewardFulfillmentService.updateFulfillmentStatus(
      fulfillmentId,
      newStatus
    );

    if (result.success) {
      addToast(`Status updated to ${newStatus}`, 'success');
      loadPendingFulfillments();
    } else {
      addToast(result.error || 'Failed to update status', 'error');
    }
  };

  const getStatusColor = (status: FulfillmentStatus) => {
    switch (status) {
      case 'pending': return 'text-warm-yellow bg-warm-yellow/20';
      case 'processing': return 'text-electric-blue bg-electric-blue/20';
      case 'fulfilled': return 'text-lime-glow bg-lime-glow/20';
      case 'failed': return 'text-hot-red bg-hot-red/20';
      case 'cancelled': return 'text-text-disabled bg-disabled';
      default: return 'text-text-secondary bg-navy-accent';
    }
  };

  const getPriorityColor = (daysPending: number) => {
    if (daysPending >= 7) return 'text-hot-red';
    if (daysPending >= 3) return 'text-warm-yellow';
    return 'text-text-secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-electric-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Gift className="text-electric-blue" size={24} />
            Reward Fulfillments
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage manual reward fulfillments (gift cards, custom rewards, etc.)
          </p>
        </div>
        <button
          onClick={loadPendingFulfillments}
          className="flex items-center gap-2 px-4 py-2 bg-navy-accent hover:bg-white/10 rounded-lg text-sm font-semibold transition-all"
        >
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-base p-3">
          <p className="text-xs text-text-secondary">Pending</p>
          <p className="text-2xl font-bold text-warm-yellow">
            {fulfillments.filter(f => f.status === 'pending').length}
          </p>
        </div>
        <div className="card-base p-3">
          <p className="text-xs text-text-secondary">Processing</p>
          <p className="text-2xl font-bold text-electric-blue">
            {fulfillments.filter(f => f.status === 'processing').length}
          </p>
        </div>
        <div className="card-base p-3">
          <p className="text-xs text-text-secondary">Urgent (7+ days)</p>
          <p className="text-2xl font-bold text-hot-red">
            {fulfillments.filter(f => f.days_pending >= 7 && f.status !== 'fulfilled').length}
          </p>
        </div>
        <div className="card-base p-3">
          <p className="text-xs text-text-secondary">Total</p>
          <p className="text-2xl font-bold text-text-primary">
            {fulfillments.length}
          </p>
        </div>
      </div>

      {/* Fulfillments List */}
      {fulfillments.length === 0 ? (
        <div className="card-base p-8 text-center">
          <Gift className="mx-auto text-text-disabled mb-3" size={48} />
          <p className="text-text-secondary">No pending fulfillments</p>
          <p className="text-xs text-text-disabled mt-2">All rewards have been fulfilled!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fulfillments.map((fulfillment) => (
            <div key={fulfillment.id} className="card-base p-4 hover:border-electric-blue/50 transition-all">
              <div className="flex items-start justify-between gap-4">
                {/* Left: User & Reward Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">{fulfillment.username}</span>
                    <span className="text-xs text-text-disabled">{fulfillment.email}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(fulfillment.status)}`}>
                      {fulfillment.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-navy-accent text-text-primary">
                      {fulfillment.reward_type}
                    </span>
                    <span className={`text-xs font-semibold ${getPriorityColor(fulfillment.days_pending)}`}>
                      <Clock size={12} className="inline mr-1" />
                      {fulfillment.days_pending}d pending
                    </span>
                  </div>

                  {fulfillment.reward_value && (
                    <div className="text-xs text-text-secondary">
                      Value: {JSON.stringify(fulfillment.reward_value)}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  {fulfillment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(fulfillment.id, 'processing')}
                        className="p-2 bg-electric-blue/20 hover:bg-electric-blue/30 text-electric-blue rounded-lg transition-all"
                        title="Mark as Processing"
                      >
                        <Clock size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenFulfillModal(fulfillment)}
                        className="p-2 bg-lime-glow/20 hover:bg-lime-glow/30 text-lime-glow rounded-lg transition-all"
                        title="Fulfill Reward"
                      >
                        <Check size={16} />
                      </button>
                    </>
                  )}
                  {fulfillment.status === 'processing' && (
                    <button
                      onClick={() => handleOpenFulfillModal(fulfillment)}
                      className="px-3 py-2 bg-lime-glow/20 hover:bg-lime-glow/30 text-lime-glow rounded-lg transition-all text-xs font-semibold"
                    >
                      Complete Fulfillment
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus(fulfillment.id, 'cancelled')}
                    className="p-2 bg-hot-red/20 hover:bg-hot-red/30 text-hot-red rounded-lg transition-all"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fulfill Modal */}
      {isFulfillModalOpen && selectedFulfillment && (
        <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-scale-in">
          <div className="modal-base max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-primary">Fulfill Reward</h3>
              <button
                onClick={() => setIsFulfillModalOpen(false)}
                className="p-2 text-text-secondary hover:bg-white/10 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 p-3 bg-navy-accent rounded-lg">
              <p className="text-sm text-text-secondary">User:</p>
              <p className="font-semibold text-text-primary">{selectedFulfillment.username}</p>
              <p className="text-xs text-text-disabled">{selectedFulfillment.email}</p>
              <p className="text-sm mt-2">
                <span className="text-text-secondary">Reward: </span>
                <span className="font-semibold text-electric-blue">{selectedFulfillment.reward_type}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-1">Fulfillment Method</label>
                <select
                  value={fulfillmentMethod}
                  onChange={(e) => setFulfillmentMethod(e.target.value as any)}
                  className="input-base w-full"
                >
                  <option value="in_app">In-App Delivery</option>
                  <option value="email">Email</option>
                  <option value="external_api">External API</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-1">Code/Voucher (optional)</label>
                <input
                  type="text"
                  value={fulfillmentCode}
                  onChange={(e) => setFulfillmentCode(e.target.value)}
                  placeholder="e.g., GIFT-CODE-123"
                  className="input-base w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-1">Link/URL (optional)</label>
                <input
                  type="text"
                  value={fulfillmentLink}
                  onChange={(e) => setFulfillmentLink(e.target.value)}
                  placeholder="https://..."
                  className="input-base w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-1">Admin Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this fulfillment..."
                  className="input-base w-full h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsFulfillModalOpen(false)}
                className="flex-1 py-2 bg-disabled text-text-secondary rounded-lg font-semibold"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleFulfillReward}
                disabled={submitting}
                className="flex-1 primary-button py-2 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Fulfilling...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Fulfill Reward
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

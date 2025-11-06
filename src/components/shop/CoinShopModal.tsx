import React, { useState } from 'react';
import { Profile } from '../../types';
import { COIN_PACKS } from '../../config/coinPacks';
import { CoinsShopCard } from '../shop/CoinsShopCard';
import { PurchaseConfirmationModal } from '../shop/PurchaseConfirmationModal';
import { PremiumPromoCard } from '../premium/PremiumPromoCard';
import { PremiumStatusCard } from '../premium/PremiumStatusCard';
import { X, Copy, Coins } from 'lucide-react';
import { purchaseCoinPack } from '../../services/coinService';
import { useAuth } from '../../contexts/AuthContext';

interface CoinShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenPremiumModal: () => void;
  onTriggerSignUp: () => void;
}

export const CoinShopModal: React.FC<CoinShopModalProps> = ({ isOpen, onClose, profile, addToast, onOpenPremiumModal, onTriggerSignUp }) => {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const { reloadProfile } = useAuth();

  if (!isOpen) return null;

  const handlePurchase = (packId: string) => {
    setSelectedPackId(packId);
  };

  const handleConfirmPurchase = async () => {
    if (!profile || !selectedPackId) return;

    const pack = COIN_PACKS.find(p => p.id === selectedPackId);
    if (!pack) return;

    try {
      // Purchase coins via Supabase (no payment, just adds coins)
      await purchaseCoinPack(profile.id, selectedPackId, pack.coins);

      // Refresh profile to get updated balance
      await reloadProfile();

      addToast(`+${pack.coins.toLocaleString()} coins added!`, 'success');
      setSelectedPackId(null);
    } catch (error) {
      console.error('[CoinShopModal] Purchase failed:', error);
      addToast('Failed to purchase coins. Please try again.', 'error');
    }
  };

  const handleReferralClick = () => {
    if (!profile || profile.is_guest) {
        onTriggerSignUp();
        onClose();
        return;
    }
    const referralLink = `https://sportime.app/invite?ref=${profile.referralCode || profile.id}`;
    navigator.clipboard.writeText(referralLink);
    addToast("✅ Invite link copied! You’ll each earn 1,000 coins once your friend joins and bets.", 'success');
  };

  const selectedPack = COIN_PACKS.find(p => p.id === selectedPackId);

  return (
    <>
      <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="modal-base max-w-md w-full h-auto max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-disabled">
            <h2 className="text-xl font-bold text-text-primary">Coin Shop</h2>
            <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-center text-sm text-text-secondary">Stock up on coins to join more games and win big!</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COIN_PACKS.map(pack => (
                <CoinsShopCard
                  key={pack.id}
                  name={pack.name}
                  coins={pack.coins}
                  price={pack.priceEUR}
                  bonus={pack.bonus}
                  isBestValue={pack.isBestValue}
                  onClick={() => handlePurchase(pack.id)}
                />
              ))}
               <div className="card-base p-3 flex flex-col justify-between text-center relative overflow-hidden">
                <div className="space-y-1 my-2">
                  <h3 className="text-md font-bold text-text-primary">🎉 Invite & Earn!</h3>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-3xl font-bold text-warm-yellow">+1,000</p>
                    <Coins size={20} className="text-warm-yellow" />
                  </div>
                  <p className="text-xs text-text-secondary h-10">Invite friends & you both get coins when they place their first bet.</p>
                </div>
                <button onClick={handleReferralClick} className="w-full primary-button py-2 text-sm flex items-center justify-center gap-2">
                  <Copy size={14} /> Copy Invite Link
                </button>
              </div>
            </div>
            <div className="pt-4">
              {profile && !profile.is_subscriber ? (
                <PremiumPromoCard onClick={onOpenPremiumModal} />
              ) : profile && profile.subscription_expires_at ? (
                <PremiumStatusCard expiryDate={profile.subscription_expires_at} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {selectedPack && (
        <PurchaseConfirmationModal
          isOpen={!!selectedPackId}
          onClose={() => setSelectedPackId(null)}
          onConfirm={handleConfirmPurchase}
          pack={selectedPack}
        />
      )}
    </>
  );
};

import React, { useState } from 'react';
import { Profile } from '../../types';
import { COIN_PACKS } from '../../config/coinPacks';
import { CoinsShopCard } from '../shop/CoinsShopCard';
import { PurchaseConfirmationModal } from '../shop/PurchaseConfirmationModal';
import { useMockStore } from '../../store/useMockStore';
import { PremiumPromoCard } from '../premium/PremiumPromoCard';
import { PremiumStatusCard } from '../premium/PremiumStatusCard';
import { X } from 'lucide-react';

interface CoinShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenPremiumModal: () => void;
}

export const CoinShopModal: React.FC<CoinShopModalProps> = ({ isOpen, onClose, profile, addToast, onOpenPremiumModal }) => {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const { purchaseCoinPack } = useMockStore();

  if (!isOpen) return null;

  const handlePurchase = (packId: string) => {
    setSelectedPackId(packId);
  };

  const handleConfirmPurchase = () => {
    if (profile && selectedPackId) {
      purchaseCoinPack(selectedPackId, profile.id);
      const pack = COIN_PACKS.find(p => p.id === selectedPackId);
      if (pack) {
        addToast(`+${pack.coins.toLocaleString()} coins added!`, 'success');
      }
      setSelectedPackId(null);
    }
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

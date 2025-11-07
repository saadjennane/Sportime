import React, { useState } from 'react';
import { Profile } from '../types';
import { COIN_PACKS } from '../config/coinPacks';
import { CoinsShopCard } from '../components/shop/CoinsShopCard';
import { PurchaseConfirmationModal } from '../components/shop/PurchaseConfirmationModal';
import { purchaseCoinPack } from '../services/coinService';
import { PremiumPromoCard } from '../components/premium/PremiumPromoCard';
import { PremiumStatusCard } from '../components/premium/PremiumStatusCard';

interface ShopPageProps {
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenPremiumModal: () => void;
}

const ShopPage: React.FC<ShopPageProps> = ({ profile, addToast, onOpenPremiumModal }) => {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  const handlePurchase = (packId: string) => {
    setSelectedPackId(packId);
  };

  const handleConfirmPurchase = async () => {
    if (profile && selectedPackId) {
      try {
        const pack = COIN_PACKS.find(p => p.id === selectedPackId);
        if (pack) {
          await purchaseCoinPack(profile.id, selectedPackId, pack.coins);
          addToast(`+${pack.coins.toLocaleString()} coins added!`, 'success');
        }
        setSelectedPackId(null);
      } catch (error) {
        console.error('Failed to purchase coin pack:', error);
        addToast('Failed to purchase coins. Please try again.', 'error');
      }
    }
  };

  const selectedPack = COIN_PACKS.find(p => p.id === selectedPackId);

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary">Coin Shop</h1>
          <p className="text-text-secondary mt-1">Stock up on coins to join more games and win big!</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="mt-6">
          {profile && !profile.is_subscriber ? (
            <PremiumPromoCard onClick={onOpenPremiumModal} />
          ) : profile && profile.subscription_expires_at ? (
            <PremiumStatusCard expiryDate={profile.subscription_expires_at} />
          ) : null}
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

export default ShopPage;

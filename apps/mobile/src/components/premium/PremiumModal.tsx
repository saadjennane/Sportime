import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { PREMIUM_BENEFITS } from '../../config/premiumBenefits';
import { getPremiumPackages, purchasePremium } from '../../services/premiumPurchaseService';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe?: (plan: 'monthly' | 'seasonal') => void;  // deprecated mock path (unused — RevenueCat drives purchases)
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onPurchased?: () => void;                              // refresh profile after a real purchase
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, addToast, onPurchased }) => {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Try to load real RevenueCat offerings; gracefully fall back to mock plans if the
  // plugin isn't installed/configured yet.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    getPremiumPackages()
      .then(p => { if (!cancelled) setPackages(p ?? []); })
      .catch(() => { if (!cancelled) setPackages([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const buy = async (pkg: any) => {
    setBusy(pkg.identifier);
    try {
      const ok = await purchasePremium(pkg);
      if (ok) {
        addToast?.('Premium unlocked! 🎉', 'success');
        onPurchased?.();
        onClose();
      } else {
        addToast?.('Purchase not completed', 'info');
      }
    } catch {
      addToast?.('Purchase failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const hasOffers = packages.length > 0;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className="modal-base max-w-md w-full p-6 space-y-5 relative border-2 border-warm-yellow/50 max-h-[92vh] overflow-y-auto scrollbar-hide">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-warm-yellow">💎 Go Premium</h2>
          <p className="text-text-secondary mt-1">Unlock the ultimate Sportime experience.</p>
        </div>

        <div className="space-y-3">
          {PREMIUM_BENEFITS.map(benefit => (
            <div key={benefit.title} className="flex items-start gap-3">
              <div className="text-xl mt-0.5">{benefit.icon}</div>
              <div>
                <h4 className="font-semibold text-text-primary">{benefit.title}</h4>
                <p className="text-xs text-text-disabled">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-deep-navy/50 p-3 rounded-lg text-center">
          <p className="text-sm font-semibold text-lime-glow">One-time welcome bonus: +5,000 Coins! ✨</p>
        </div>

        {/* Offers — driven entirely by the RevenueCat skeleton. */}
        <div className="space-y-3 pt-1">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-warm-yellow" size={24} /></div>
          ) : hasOffers ? (
            packages.map(pkg => {
              const price = pkg?.product?.priceString ?? '';
              const title = pkg?.product?.title || pkg?.identifier || 'Premium';
              return (
                <button key={pkg.identifier} onClick={() => buy(pkg)} disabled={!!busy}
                  className="w-full primary-button flex items-center justify-between px-4 disabled:opacity-60">
                  <span>{title}</span>
                  <span className="font-extrabold">{busy === pkg.identifier ? '…' : (price || 'Soon')}</span>
                </button>
              );
            })
          ) : (
            // RevenueCat not active yet (plugin not installed / no offering): honest pending state.
            <>
              <button disabled className="w-full primary-button opacity-60 cursor-not-allowed">Unlock Premium — coming soon</button>
              <p className="text-xs text-text-disabled text-center">In-app subscriptions open as soon as the store is live.</p>
            </>
          )}
          {hasOffers && <p className="text-[11px] text-text-disabled text-center">Cancel anytime. Auto-renews until cancelled.</p>}
        </div>
      </div>
    </div>
  );
};

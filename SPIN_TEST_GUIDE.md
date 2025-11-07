# Guide de Test - Système de Spin

## Prérequis

1. **Vérifier que l'application démarre**
   ```bash
   npm run dev
   ```

2. **Se connecter avec un compte test** (ou créer un guest account)

3. **Ouvrir la console du navigateur** (F12 → Console)

---

## Tests à Effectuer

### ✅ Test 1: Vérifier la compilation
```bash
npm run build
```
**Résultat attendu**: Build réussi sans erreurs TypeScript

---

### ✅ Test 2: Obtenir l'état initial du spin

Ouvrir la console et exécuter:

```javascript
// Importer le service
import { getUserSpinState } from './src/services/spinService';

// Obtenir l'userId (depuis le contexte auth)
const userId = 'VOTRE_USER_ID'; // Remplacer par votre ID

// Test
const state = await getUserSpinState(userId);
console.log('État initial:', state);
```

**Résultat attendu**:
```javascript
{
  userId: "xxx",
  pityCounter: 0,
  adaptiveMultipliers: {},
  availableSpins: { free: 0, amateur: 0, master: 0, apex: 0, premium: 0 },
  lastFreeSpinAt: null,
  freeSpinStreak: 0,
  updatedAt: Date
}
```

---

### ✅ Test 3: Réclamer le free spin quotidien

```javascript
import { claimDailyFreeSpin } from './src/services/spinService';

const result = await claimDailyFreeSpin(userId);
console.log('Free spin claim:', result);

// Vérifier l'état après claim
const state = await getUserSpinState(userId);
console.log('Spins disponibles:', state.availableSpins);
```

**Résultat attendu**:
```javascript
{
  success: true,
  message: "Free spin granted! Current streak: 1",
  spinsGranted: 1,
  nextAvailableAt: Date (dans 24h)
}
// state.availableSpins.free devrait être 1
```

---

### ✅ Test 4: Tester le cooldown 24h

```javascript
// Essayer de claim immédiatement après
const result2 = await claimDailyFreeSpin(userId);
console.log('Deuxième claim:', result2);
```

**Résultat attendu**:
```javascript
{
  success: false,
  message: "Daily free spin already claimed. Try again later.",
  spinsGranted: 0,
  nextAvailableAt: Date (dans ~24h)
}
```

---

### ✅ Test 5: Ajouter des spins manuellement

```javascript
import { updateAvailableSpins } from './src/services/spinService';

// Ajouter 3 spins amateur, 2 master, 1 apex
await updateAvailableSpins(userId, 'amateur', 3);
await updateAvailableSpins(userId, 'master', 2);
await updateAvailableSpins(userId, 'apex', 1);

const state = await getUserSpinState(userId);
console.log('Spins après ajout:', state.availableSpins);
```

**Résultat attendu**:
```javascript
availableSpins: {
  free: 1,
  amateur: 3,
  master: 2,
  apex: 1,
  premium: 0
}
```

---

### ✅ Test 6: Effectuer un spin amateur

```javascript
import { performSpin } from './src/services/spinService';

const result = await performSpin(userId, 'amateur');
console.log('Résultat du spin:', result);

// Vérifier l'état après
const state = await getUserSpinState(userId);
console.log('État après spin:', {
  pityCounter: state.pityCounter,
  availableSpins: state.availableSpins,
  multipliers: state.adaptiveMultipliers
});
```

**Résultat attendu**:
```javascript
{
  rewardId: "boost_50" (ou autre),
  rewardLabel: "XP +50",
  rewardCategory: "xp",
  wasPity: false,
  finalChances: { ... },
  timestamp: Date
}
// pityCounter devrait être 1 (si récompense non-rare)
// availableSpins.amateur devrait être 2
```

---

### ✅ Test 7: Effectuer plusieurs spins pour tester le pity timer

```javascript
// Ajouter 15 spins pour tester
await updateAvailableSpins(userId, 'amateur', 15);

// Effectuer 10 spins et observer le pity counter
for (let i = 0; i < 10; i++) {
  const result = await performSpin(userId, 'amateur');
  const state = await getUserSpinState(userId);
  console.log(`Spin ${i+1}:`, {
    reward: result.rewardLabel,
    pityCounter: state.pityCounter,
    wasPity: result.wasPity
  });
}
```

**Résultat attendu**:
- Pity counter devrait augmenter à chaque spin non-rare
- À partir du spin où pityCounter >= 10, les chances de récompenses rares augmentent
- Quand une récompense rare est obtenue, pityCounter se reset à 0

---

### ✅ Test 8: Vérifier les adaptive multipliers

```javascript
// Après avoir obtenu une récompense rare (premium, gift_card, masterpass)
const state = await getUserSpinState(userId);
console.log('Multiplicateurs adaptatifs:', state.adaptiveMultipliers);

// Exemple:
// Si vous avez gagné un premium, vous devriez voir:
{
  premium: {
    multiplier: 0.5,
    expiresAt: "2025-XX-XX..." (7 jours plus tard)
  }
}
```

---

### ✅ Test 9: Vérifier l'historique des spins

```javascript
import { getSpinHistory } from './src/services/spinService';

const history = await getSpinHistory(userId, 20);
console.log('Historique (20 derniers spins):', history);
```

**Résultat attendu**:
```javascript
[
  {
    rewardId: "boost_50",
    rewardLabel: "XP +50",
    rewardCategory: "xp",
    wasPity: false,
    timestamp: Date
  },
  // ... autres spins
]
```

---

### ✅ Test 10: Vérifier les récompenses distribuées

#### Pour les récompenses XP:
```javascript
import { supabase } from './src/config/supabase';

// Vérifier les coins/XP du profil
const { data: profile } = await supabase
  .from('users')
  .select('coins_balance, xp')
  .eq('id', userId)
  .single();

console.log('Profil après spins:', profile);
```

#### Pour les tickets:
```javascript
// Vérifier les tickets créés
const { data: tickets } = await supabase
  .from('user_tickets')
  .select('*')
  .eq('user_id', userId);

console.log('Tickets:', tickets);
```

---

### ✅ Test 11: Tester les récompenses "Extra Spin"

```javascript
// Ajouter 10 spins amateur pour augmenter les chances d'avoir un extra spin
await updateAvailableSpins(userId, 'amateur', 10);

const stateBefore = await getUserSpinState(userId);
console.log('Spins avant:', stateBefore.availableSpins.amateur);

// Spinner jusqu'à obtenir un extra spin
let gotExtraSpin = false;
for (let i = 0; i < 10 && !gotExtraSpin; i++) {
  const result = await performSpin(userId, 'amateur');
  if (result.rewardId === 'extra_spin') {
    gotExtraSpin = true;
    const stateAfter = await getUserSpinState(userId);
    console.log('Extra spin obtenu!');
    console.log('Spins après:', stateAfter.availableSpins.amateur);
    // Le nombre de spins devrait être le même (consommé 1, gagné 1)
  }
}
```

---

### ✅ Test 12: Tester la rejection sans spins

```javascript
// Supprimer tous les spins
await updateAvailableSpins(userId, 'amateur', -100);

const state = await getUserSpinState(userId);
console.log('Spins disponibles:', state.availableSpins.amateur); // Devrait être 0

// Essayer de spinner
try {
  const result = await performSpin(userId, 'amateur');
  console.error('ERREUR: Le spin aurait dû échouer!');
} catch (error) {
  console.log('✅ Rejection correcte:', error.message);
}
```

**Résultat attendu**: `Error: No available amateur spins`

---

## Tests depuis l'UI (si les composants sont intégrés)

### Test 13: Hook useSpinWheel

Si tu as un composant React qui utilise le hook:

```tsx
import { useSpinWheel } from './hooks/useSpinWheel';

function TestSpinComponent() {
  const { userId } = useAuth();

  const {
    spinState,
    spinHistory,
    isLoading,
    isSpinning,
    spin,
    claimFreeSpin,
    canClaimFreeSpin,
    nextFreeSpinAt,
    canSpin,
    getAvailableSpins
  } = useSpinWheel({ userId });

  // Afficher l'état et tester les actions

  return (
    <div>
      <h2>Spin State</h2>
      <pre>{JSON.stringify(spinState, null, 2)}</pre>

      <button
        onClick={() => spin('amateur')}
        disabled={!canSpin('amateur') || isSpinning}
      >
        Spin Amateur ({getAvailableSpins('amateur')} available)
      </button>

      <button
        onClick={claimFreeSpin}
        disabled={!canClaimFreeSpin}
      >
        Claim Free Spin
      </button>

      {nextFreeSpinAt && (
        <p>Next free spin: {nextFreeSpinAt.toLocaleString()}</p>
      )}

      <h3>History</h3>
      <pre>{JSON.stringify(spinHistory, null, 2)}</pre>
    </div>
  );
}
```

---

## Tests de Performance

### Test 14: Multiple spins rapides

```javascript
// Ajouter 50 spins
await updateAvailableSpins(userId, 'amateur', 50);

// Mesurer le temps pour 50 spins
console.time('50 spins');
for (let i = 0; i < 50; i++) {
  await performSpin(userId, 'amateur');
}
console.timeEnd('50 spins');

// Vérifier l'intégrité des données
const finalState = await getUserSpinState(userId);
const finalHistory = await getSpinHistory(userId, 50);
console.log('État final:', finalState);
console.log('Historique final:', finalHistory.length, 'spins enregistrés');
```

---

## Vérifications dans Supabase Dashboard

1. **Table `user_spin_states`**
   - Vérifier que ton userId a bien une entrée
   - Vérifier `pity_counter`, `adaptive_multipliers`, `available_spins`

2. **Table `spin_history`**
   - Vérifier que tous les spins sont enregistrés
   - Vérifier les timestamps
   - Vérifier `was_pity` pour les spins avec pity timer

3. **Table `user_tickets`**
   - Vérifier que les tickets gagnés sont créés
   - Vérifier `type` (amateur/master/apex)
   - Vérifier `expires_at` (7 jours)

4. **Table `users`**
   - Vérifier que `coins_balance` ou `xp` augmente avec les récompenses XP

---

## Commandes Utiles

### Reset complet de l'état (en SQL via Supabase)

```sql
-- Reset pity counter
SELECT update_pity_counter('VOTRE_USER_ID', true);

-- Clear adaptive multipliers
UPDATE user_spin_states
SET adaptive_multipliers = '{}'
WHERE user_id = 'VOTRE_USER_ID';

-- Reset available spins
UPDATE user_spin_states
SET available_spins = '{"free":0,"amateur":5,"master":3,"apex":1,"premium":0}'
WHERE user_id = 'VOTRE_USER_ID';

-- Clear history
DELETE FROM spin_history WHERE user_id = 'VOTRE_USER_ID';
```

---

## Checklist Finale

- [ ] Compilation réussie (TypeScript)
- [ ] État initial créé automatiquement
- [ ] Free spin quotidien fonctionne
- [ ] Cooldown 24h respecté
- [ ] Ajout de spins manuel fonctionne
- [ ] Spin amateur/master/apex réussis
- [ ] Pity counter incrémenté correctement
- [ ] Pity timer boost les rares après 10 spins
- [ ] Adaptive multipliers ajoutés après rares
- [ ] Historique enregistré correctement
- [ ] Récompenses XP distribuées (coins ajoutés)
- [ ] Récompenses Tickets distribuées (tickets créés)
- [ ] Récompense Extra Spin fonctionne
- [ ] Rejection sans spins disponibles
- [ ] Hook React useSpinWheel fonctionne
- [ ] Performance acceptable (50 spins < 30s)

---

## Bugs Connus à Vérifier

1. **Gift Cards / Premium**: Actuellement en TODO (console.log seulement)
2. **MasterPass**: Actuellement en TODO (console.log seulement)
3. **Free spin rewards**: Configuration vide dans `SPIN_REWARDS.free`

---

## Notes

- Utilise `USE_SUPABASE=true` dans `.env` pour tester avec Supabase
- Utilise `USE_SUPABASE=false` pour tester en mode mock local
- Les tests en mode mock utilisent `SpinEngine.ts` (ancienne logique client-side)
- Les tests en mode Supabase utilisent les RPC functions (nouvelle logique server-side)

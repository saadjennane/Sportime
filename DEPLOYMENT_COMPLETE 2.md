# Déploiement des Notifications - Statut

## ✅ Complété

### 1. Edge Function `send-notification`
- **Statut**: Déployée avec succès
- **URL**: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions
- **Fonction**: Envoie des notifications via OneSignal et les sauvegarde dans Supabase

### 2. Secrets Supabase Configurés
- ✅ `ONESIGNAL_APP_ID`: 7873fb7e-774d-4dd4-afae-e37ab2d73c56

### 3. Configuration Frontend
- ✅ `.env` configuré avec `VITE_ONESIGNAL_APP_ID`
- ✅ OneSignal SDK installé et initialisé dans App.tsx
- ✅ NotificationCenter mis à jour pour utiliser Supabase

## ⚠️ Action Requise

### Étape 1: Ajouter le REST API Key de OneSignal

Vous devez récupérer votre **REST API Key** depuis OneSignal:

1. Allez sur [OneSignal Dashboard](https://onesignal.com/)
2. Sélectionnez votre application
3. Allez dans **Settings** → **Keys & IDs**
4. Copiez le **REST API Key**
5. Exécutez cette commande (remplacez `YOUR_REST_API_KEY`):

```bash
npx supabase secrets set ONESIGNAL_API_KEY=YOUR_REST_API_KEY
```

### Étape 2: Déployer la Migration de la Base de Données

La migration SQL a été préparée dans le fichier `deploy_notifications.sql`.

**Option A: Via Supabase Dashboard (Recommandé)**

1. Ouvrez [Supabase SQL Editor](https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new)
2. Copiez le contenu de `deploy_notifications.sql`
3. Collez-le dans l'éditeur SQL
4. Cliquez sur "Run"
5. Vérifiez que vous voyez le message: "Notifications schema deployed successfully!"

**Option B: Via CLI (si les autres migrations sont corrigées)**

```bash
npx supabase db push
```

## 🧪 Tester les Notifications

Une fois les 2 étapes ci-dessus complétées:

### Test 1: Vérifier l'Initialisation OneSignal

1. Ouvrez l'application dans votre navigateur
2. Ouvrez la console du navigateur (F12)
3. Vous devriez voir: `[OneSignal] Initialized successfully`

### Test 2: Enregistrement du Player ID

1. Connectez-vous avec un compte (pas en tant que guest)
2. Une popup devrait apparaître demandant la permission pour les notifications
3. Acceptez la permission
4. Vérifiez dans la console: `[OneSignal] Permission granted, player ID: xxx`

### Test 3: Envoyer une Notification de Test

Via Supabase SQL Editor:

```sql
-- Remplacez 'YOUR_USER_ID' par un vrai user_id
SELECT extensions.http(
  'POST',
  'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/send-notification',
  ARRAY[
    extensions.http_header('Content-Type', 'application/json'),
    extensions.http_header('Authorization', 'Bearer YOUR_ANON_KEY')
  ],
  'application/json',
  json_build_object(
    'userId', 'YOUR_USER_ID',
    'type', 'system',
    'title', 'Test Notification',
    'message', 'Ceci est une notification de test depuis Supabase!'
  )::text
);
```

Ou via le code TypeScript:

```typescript
import { sendNotification } from './services/notificationService';

// Dans un useEffect ou handler
await sendNotification(
  userId,
  'system',
  'Bienvenue!',
  'Le système de notifications fonctionne!'
);
```

## 📊 Vérifier les Tables

Dans Supabase SQL Editor, vérifiez que les tables ont été créées:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'user_onesignal_players', 'notification_preferences');
```

Vous devriez voir:
- `notifications`
- `user_onesignal_players`
- `notification_preferences`

## 🔍 Debug

Si les notifications ne fonctionnent pas:

### Vérifier les Logs de l'Edge Function

1. Allez sur https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions
2. Cliquez sur `send-notification`
3. Allez dans l'onglet **Logs**
4. Envoyez une notification test
5. Vérifiez les erreurs dans les logs

### Vérifier les Secrets

```bash
npx supabase secrets list
```

Vous devriez voir:
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY` (après l'avoir ajouté)

### Console du Navigateur

Ouvrez la console et filtrez par `[OneSignal]` pour voir tous les logs.

## 📝 Prochaines Étapes

Une fois que tout fonctionne:

1. **Intégrer les notifications dans votre logique métier**:
   - Appeler `sendNotification()` quand un utilisateur rejoint une squad
   - Notifications pour les résultats de défis
   - Rappels de streaks quotidiennes

2. **Ajouter une page de préférences de notifications** dans le profil utilisateur

3. **Tester sur différents appareils**:
   - Web Desktop
   - Web Mobile
   - iOS (via PWA)
   - Android (via PWA)

## 🎉 Ressources

- [Documentation OneSignal](https://documentation.onesignal.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md) - Guide complet

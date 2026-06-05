#!/bin/bash

echo "🔍 Analyse du projet Sportime..."

# Créer un backup
git branch backup-before-optimization 2>/dev/null && echo "✅ Backup créé: backup-before-optimization" || echo "ℹ️  Branche backup existe déjà"

# Créer .gitignore optimisé
cat > .gitignore << 'GITIGNORE'
# Dépendances
node_modules/
vendor/
bower_components/
jspm_packages/
package-lock.json
composer.lock
yarn.lock

# Build et distribution
dist/
build/
out/
.next/
.nuxt/
.cache/
public/build/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environnement
.env
.env.local
.env.*.local
*.key

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Tests
coverage/
.nyc_output/

# Temporaires
tmp/
temp/
*.tmp
*.bak
.sass-cache/
GITIGNORE

echo "✅ .gitignore créé"

# Supprimer les fichiers trackés qui devraient être ignorés
echo "🧹 Nettoyage des fichiers trackés..."

git rm -r --cached node_modules/ 2>/dev/null && echo "✅ node_modules retiré du Git" || echo "ℹ️  node_modules non trouvé"
git rm -r --cached vendor/ 2>/dev/null && echo "✅ vendor retiré du Git" || echo "ℹ️  vendor non trouvé"
git rm -r --cached dist/ 2>/dev/null && echo "✅ dist retiré du Git" || echo "ℹ️  dist non trouvé"
git rm -r --cached build/ 2>/dev/null && echo "✅ build retiré du Git" || echo "ℹ️  build non trouvé"
git rm -r --cached .next/ 2>/dev/null && echo "✅ .next retiré du Git" || echo "ℹ️  .next non trouvé"
git rm --cached package-lock.json 2>/dev/null && echo "✅ package-lock.json retiré du Git" || echo "ℹ️  package-lock.json non trouvé"
git rm --cached composer.lock 2>/dev/null && echo "✅ composer.lock retiré du Git" || echo "ℹ️  composer.lock non trouvé"

find . -name "*.log" -type f -exec git rm --cached {} \; 2>/dev/null
find . -name ".DS_Store" -type f -exec git rm --cached {} \; 2>/dev/null

git rm -r --cached .vscode/ 2>/dev/null && echo "✅ .vscode retiré du Git" || echo "ℹ️  .vscode non trouvé"
git rm -r --cached .idea/ 2>/dev/null && echo "✅ .idea retiré du Git" || echo "ℹ️  .idea non trouvé"

echo ""
echo "✅ Optimisation terminée!"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Vérifiez les changements: git status"
echo "2. Commitez: git add . && git commit -m 'Optimize repo size for dualite.dev'"
echo "3. Poussez: git push origin Sportime-stable-nov3"
echo ""
echo "⚠️  Pour annuler: git checkout backup-before-optimization"

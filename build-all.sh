#!/bin/bash

set -e

echo "🚀 Building all apps..."

# Build all apps
npm run build

echo "📦 Organizing builds for deployment..."

# Create mobile and admin directories in landing dist
mkdir -p apps/landing/dist/mobile
mkdir -p apps/landing/dist/admin

# Copy mobile build to /mobile
cp -r apps/mobile/dist/* apps/landing/dist/mobile/

# Copy admin build to /admin
cp -r apps/admin/dist/* apps/landing/dist/admin/

echo "✅ All builds organized!"
echo "   - Landing: apps/landing/dist/"
echo "   - Mobile:  apps/landing/dist/mobile/"
echo "   - Admin:   apps/landing/dist/admin/"

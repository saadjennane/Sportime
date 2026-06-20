#!/bin/bash

set -e

echo "🚀 Building Sportime Admin + Landing (mobile is NOT deployed on Vercel)..."

# Build only landing + admin. Mobile ships via Capacitor/iOS, not Vercel —
# and its web build fails here, so it's intentionally excluded.
npm run build:landing
npm run build:admin

echo "📦 Organizing builds for deployment..."

# Create admin directory in landing dist
mkdir -p apps/landing/dist/admin

# Copy admin build to /admin
cp -r apps/admin/dist/* apps/landing/dist/admin/

echo "✅ Builds organized!"
echo "   - Landing: apps/landing/dist/"
echo "   - Admin:   apps/landing/dist/admin/"

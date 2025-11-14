# ⚽ Sportime

> Fantasy sports prediction platform with real-time betting, challenges, and social features

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF.svg)](https://vitejs.dev/)

## 🌟 Features

### 🎮 Game Modes
- **Challenge Betting** - Predict match outcomes and climb leaderboards
- **Swipe Predictions** - Quick daily predictions with matchday leaderboards
- **Fantasy Game** - Build your dream team and compete (Supabase-ready)
- **Live Games** - Real-time in-match betting and predictions

### 👥 Social Features
- **Squads** - Create private leagues with friends
- **Leaderboards** - Global and squad-based rankings
- **Feed** - Share celebrations and achievements
- **Activity Tracking** - XP, levels, and badges

### 💰 Economy
- **Coins** - In-app currency for entry fees and shop
- **Tickets** - Tournament entry tickets (Amateur/Master/Apex)
- **Rewards** - Daily streaks, level-up bonuses, prize pools
- **Spin Wheel** - Fun zone with daily free spins

### 📊 Progression System
- **7 Levels** - Rookie → Rising Star → Pro → Elite → Legend → Master → GOAT
- **Badges** - Achievement system with 15+ unique badges
- **XP System** - Earn XP from bets, challenges, and activities
- **Weekly Decay** - Stay active or lose XP (with GOAT immunity)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Supabase Account** ([supabase.com](https://supabase.com))
- **API-Sports Key** ([api-sports.io](https://api-sports.io/))
- **OneSignal Account** (Optional - for push notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/saadjennane/Sportime.git
   cd Sportime
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   # Supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # OneSignal (Optional)
   VITE_ONESIGNAL_APP_ID=your-onesignal-app-id

   # API-Sports
   API_SPORTS_KEY=your-api-sports-key
   ```

4. **Apply database migrations**
   ```bash
   # Using Supabase CLI
   npx supabase db push

   # Or manually in Supabase dashboard
   # Run all files in supabase/migrations/ in order
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   App will be available at `http://localhost:5173`

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Zustand (state management)
- Framer Motion (animations)
- date-fns (date utilities)

**Backend:**
- Supabase (PostgreSQL + Auth + Realtime)
- Edge Functions (Deno)
- Row Level Security (RLS)

**APIs:**
- API-Sports (Football data)
- OneSignal (Push notifications)

**Hosting:**
- Frontend: Vercel / Netlify
- Backend: Supabase Cloud
- Edge Functions: Supabase Edge Runtime

## 📚 Documentation

See detailed guides in the repository:
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Complete setup instructions
- **[Fantasy Migration Guide](FANTASY_MIGRATION_GUIDE.md)** - Fantasy system migration
- **[Testing Checklist](TESTING_CHECKLIST.md)** - Testing guide
- **[Fantasy Implementation](FANTASY_IMPLEMENTATION_COMPLETE.md)** - Fantasy overview
- **[Progression System](PROGRESSION_IMPLEMENTATION.md)** - XP and levels

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Linting
npm run lint             # ESLint check
npm run lint:dualite     # Dualite-specific linting
```

### Database Management

```bash
# Apply migrations
npx supabase db push

# Reset database (dev only)
npx supabase db reset

# Create new migration
npx supabase migration new migration_name
```

## 📦 Deployment

### Vercel (Recommended)

1. Connect repository from GitHub
2. Add environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ONESIGNAL_APP_ID)
3. Deploy (auto-deploys on push to main)

## 📄 License

Proprietary and confidential. All rights reserved.

## 👨‍💻 Author

**Saad Jennane**
- GitHub: [@saadjennane](https://github.com/saadjennane)

---

**Built with ❤️ using React, TypeScript, and Supabase**

Last updated: November 14, 2025

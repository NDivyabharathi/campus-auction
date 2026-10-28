# 🏛️ Campus Auction — Kongu Engineering College Hackathon Edition

> **"Good Things Deserve a Second Round."**  
> An exclusive, campus-only online auction marketplace built for students of **Kongu Engineering College** to fairly buy, bid, and sell pre-loved campus essentials with in-person campus handover.

---

## 📋 Table of Contents
1. [Problem Statement & Overview](#-problem-statement--overview)
2. [Key Features & Business Rules](#-key-features--business-rules)
3. [Technology Stack](#-technology-stack)
4. [Architecture & Concurrency Design](#-architecture--concurrency-design)
5. [Project Structure](#-project-structure)
6. [Prerequisites](#-prerequisites)
7. [Installation & Setup](#-installation--setup)
8. [Database Seeding](#-database-seeding)
9. [Running the Application](#-running-the-application)
10. [Demo Student Credentials](#-demo-student-credentials)
11. [Hackathon Demonstration Walkthrough](#-hackathon-demonstration-walkthrough)
12. [API Reference](#-api-reference)
13. [Future Enhancements](#-future-enhancements)

---

## 🎯 Problem Statement & Overview

At the end of every semester or academic year, senior students often leave behind bicycles, scientific calculators, textbooks, lab equipment, drawing boards, electric kettles, and other valuable items. Junior students need these items, but discoverability is limited to chaotic WhatsApp groups or informal chat channels where prices are arbitrary and transactions are unorganized.

**Campus Auction** provides a transparent, fair, and reliable auction marketplace exclusively for Kongu Engineering College:
- **Campus-Only Access**: Strict `@kongu.edu` institutional email domain validation.
- **Fair Public Bidding Engine**: Atomic concurrency control, server-validated countdowns, and transparent public bid history.
- **Automated Auction Closure**: Authoritative background worker that determines highest valid winners and creates reservations.
- **Physical Handover Protocol**: 2-party physical exchange tracking and fallback to the next-highest bidder if collection fails.
- **Zero Online Payment Risk**: Physical cash or UPI on handover without intermediary payment gateway delays.

---

## ✨ Key Features & Business Rules

### 1. Authentication & Security
- **Strict Domain Control**: Registration accepts only emails matching `^[a-zA-Z0-9._%+-]+@kongu.edu$`. All other domains are rejected.
- **Dual Role Model**: Every registered student can act as both a **Buyer** and a **Seller** from one unified account.
- **Secure Password Hashing**: Passwords hashed using `bcryptjs` (salt factor 10). Plaintext passwords are never stored.
- **JWT Authentication**: Issue signed JSON Web Tokens stored securely via HTTP-Only Cookies and Bearer headers.
- **Privacy First**: Bid history and marketplace cards project only student display names and departments. Passwords, emails, and sensitive account tokens are never exposed.

### 2. Marketplace & Discovery
- **Live Auctions Grid**: Real-time cards displaying leading bids, bid counts, condition pills, and countdowns.
- **Starting Price Clarity**: If no bids have been placed yet, cards and details clearly state `"Starting Price: ₹X (No bids yet)"` rather than fabricating bids.
- **Search & Multi-Filter**: Search by keyword in title/description; filter by Category, Condition, Status (Active/Ended/All), and Price Range.
- **Smart Sorting**: Sort by Ending Soonest, Recently Listed, Lowest Price, or Highest Price.
- **Campus Categories**:
  - 🚲 Cycles & Campus Mobility
  - ⚡ Electronics & Gadgets
  - 📚 Books & Study Materials
  - 🏢 Hostel Essentials
  - 🔬 Laboratory Equipment
  - 🏸 Sports Equipment
  - 👕 Clothing & Accessories
  - 📦 Other

### 3. Fair Bidding Engine
- **Server Time Authoritative**: Browser countdowns are informative; server timestamps strictly determine bid validity. Bids submitted after `closingAt` are rejected.
- **Self-Bid Prevention**: Sellers are strictly prohibited from bidding on their own listings.
- **Starting Price & Increment Rule**:
  - First bid must be $\ge$ Starting Price.
  - Subsequent bids must be $\ge$ `Current Leading Bid + Minimum Increment`.
- **Atomic Concurrency Handling**: Optimistic atomic updates via MongoDB conditions prevent race conditions where competing bids arrive simultaneously. Competing bidders receive an immediate notice with the updated minimum acceptable bid.
- **Bid Immutability**: All bids are permanently recorded in the database and cannot be altered or retracted.

### 4. Seller Rules & Anti-Tampering
- **Pre-Bid Freedom**: Before the first valid bid is placed, sellers may edit pricing, minimum increment, closing time, or cancel the listing.
- **Fairness Protection**: Once the **first valid bid** is accepted:
  - Starting price and bid increment are permanently locked.
  - Closing time cannot be extended or reduced.
  - The seller cannot cancel the auction.

### 5. Automated Closure & Campus Handover
- **Background Worker**: A scheduled worker monitors active auctions every 10 seconds and automatically closes expired listings idempotently.
- **Winner Determination**:
  - If 0 bids exist $\rightarrow$ marked `unsold`.
  - If valid bids exist $\rightarrow$ highest valid bidder wins, marked `reserved`, and a `Transaction` is generated.
- **Handover Coordination**: Dedicated meeting spot scheduler (e.g. Kongu Central Library, Convention Center, Canteen) with notes and meeting time.
- **Two-Party Confirmation**: Both seller and buyer must click "Confirm Handover Completed" in the UI to finalize the exchange and mark the auction `sold`.
- **Failed Pickup & Next-Bidder Reassignment**: If the winning bidder fails to collect the item within the agreed window, the seller can report the failure. The system automatically reassigns the reservation to the **next-highest eligible bidder** (Round #2) without losing transaction history.

### 6. Real-Time Notification System & Browser Alerts
- **Notification Dropdown & Center**: Bell icon in navbar with live unread counter badge, dropdown panel, and full `/notifications` page.
- **Socket.IO Delivery**: Real-time delivery to authenticated student rooms (`user:${userId}`); persists in MongoDB so alerts are never lost when offline.
- **Native Browser Notifications**:
  - Optional user-enabled browser alerts via the Notifications API.
  - Clear, non-intrusive prompt explaining value before requesting permission.
  - Cross-tab deduplication using `BroadcastChannel` preventing duplicate popups across tabs.
  - Clicking notification focuses window and navigates to the relevant auction or handover.
- **Comprehensive Event Coverage**:
  - `bid_received`: Alerts seller of incoming bids with student name and amount.
  - `outbid`: Instantly warns previous leading bidder when someone outbids them.
  - `auction_won` & `auction_sold`: Celebrates with winner and directs seller to schedule handover.
  - `auction_ending_soon`: Automatically alerts active bidders 5 minutes before deadline.
  - `handover_scheduled` & `handover_confirmed_by_peer`: Syncs meeting arrangements between buyer and seller.
  - `transaction_completed`: Celebrates verified 2-party exchange.
  - `transaction_failed` & `handover_reassigned`: Reassigns item to the second-highest bidder on missed pickup.
- **Deduplication Engine**: Database-enforced `deduplicationKey` prevents worker restarts or repeated triggers from spamming duplicate alerts.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Lucide Icons, Axios |
| **Backend** | Node.js, Express.js, TypeScript, RESTful API, Socket.IO |
| **Database** | MongoDB (Local / Atlas), Mongoose ORM |
| **Image Storage** | MongoDB GridFS with Multer memory streams |
| **Auth** | JWT (jsonwebtoken), bcryptjs, Cookie-Parser |

---

## 🏗️ Architecture & Concurrency Design

```
                     ┌────────────────────────────────┐
                     │    React 19 + Tailwind v4      │
                     │  (Vite Client @ Port 5173)     │
                     └───────────────┬────────────────┘
                                     │ REST + WebSockets
                                     ▼
                     ┌────────────────────────────────┐
                     │    Node.js + Express API       │
                     │      (@ Port 5000)             │
                     └───────────────┬────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│   Auth & JWT     │       │  Bidding Engine  │        │ Closure Worker   │
│  @kongu.edu only │       │ (Atomic Updates) │        │ (Every 10s Poll) │
└──────────────────┘       └──────────────────┘        └──────────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
                     ┌────────────────────────────────┐
                     │     MongoDB (Local Database)   │
                     │  Collections: Users, Auctions, │
                     │  Bids, Transactions, GridFS    │
                     └────────────────────────────────┘
```

---

## 📁 Project Structure

```
campus-auction/
├── package.json                 # Root script runner (concurrently)
├── .gitignore                   # Ignores node_modules, .env, dist
├── client/                      # React TypeScript Frontend
│   ├── index.html               # Main HTML with Plus Jakarta Sans
│   ├── package.json
│   ├── vite.config.ts           # Vite + Tailwind v4 + Proxy config
│   └── src/
│       ├── components/
│       │   ├── Navbar.tsx       # Responsive nav with Kongu branding
│       │   ├── Footer.tsx       # Campus guarantees & location notes
│       │   ├── AuctionCard.tsx  # Marketplace card with countdown
│       │   └── ProtectedRoute.tsx
│       ├── context/
│       │   └── AuthContext.tsx  # User state & session persistence
│       ├── pages/
│       │   ├── MarketplacePage.tsx    # Home & Explore with Hero & Filters
│       │   ├── CreateListingPage.tsx  # Form with GridFS photo upload
│       │   ├── AuctionDetailsPage.tsx # 2-column layout & public history
│       │   ├── MyListingsPage.tsx     # Seller dashboard (edit/cancel)
│       │   ├── MyBidsPage.tsx         # Student bids & outcomes tracker
│       │   ├── TransactionsPage.tsx   # Handover scheduler & confirmation
│       │   ├── LoginPage.tsx          # Login with demo shortcuts
│       │   └── RegisterPage.tsx       # Register with @kongu.edu check
│       ├── services/api.ts            # Axios client with interceptors
│       ├── types/index.ts             # Strongly-typed models
│       └── utils/formatters.ts        # Currency (₹) & time formatters
└── server/                      # Node.js + Express + TypeScript Backend
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── .env
    └── src/
        ├── config/
        │   ├── db.ts            # Mongoose + GridFS Bucket init
        │   └── env.ts           # Typed environment variables
        ├── models/
        │   ├── User.ts          # Kongu email validation & bcrypt
        │   ├── Auction.ts       # Auctions with category & indexes
        │   ├── Bid.ts           # Bids with timestamp & indexes
        │   └── Transaction.ts   # Reservation & handover model
        ├── controllers/
        │   ├── authController.ts
        │   ├── auctionController.ts
        │   ├── bidController.ts
        │   ├── transactionController.ts
        │   └── imageController.ts
        ├── routes/
        │   ├── authRoutes.ts
        │   ├── auctionRoutes.ts
        │   ├── bidRoutes.ts
        │   ├── transactionRoutes.ts
        │   ├── imageRoutes.ts
        │   └── devRoutes.ts
        ├── services/
        │   └── auctionClosureService.ts # Worker + Idempotent closure
        ├── socket.ts            # Socket.IO rooms & broadcast helper
        ├── scripts/
        │   └── seed.ts          # Demo data generator
        ├── app.ts               # Express factory
        └── index.ts             # Server entry point
```

---

## 📦 Prerequisites

1. **Node.js** (v18+ or v20+ recommended). Check with `node -v`.
2. **npm** (v9+ or v10+). Check with `npm -v`.
3. **MongoDB** running locally on default port `27017`.
   - On Windows: check service with `Get-Service -Name *mongo*`. If stopped, start via Services app or `net start MongoDB`.

---

## ⚙️ Installation & Setup

### 1. Install Dependencies
Run the installation command from the repository root:
```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Environment Configuration
The backend comes pre-configured with a `.env` file. You can also view or copy `server/.env.example`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/campus_auction
JWT_SECRET=super_secret_kongu_campus_auction_jwt_token_2026_key
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

---

## 🌾 Database Seeding

Populate the database with realistic Kongu Engineering College student accounts, auction listings, active bids, and handovers:
```bash
npm run seed
```
*(or run `npm run seed --prefix server`)*

---

## 🚀 Running the Application Locally

You can launch both the backend server and frontend development server simultaneously with one command from the project root:

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

*(To run them in separate terminals)*:
- Terminal 1: `npm run dev --prefix server`
- Terminal 2: `npm run dev --prefix client`

---

## 👥 Demo Student Credentials

All demo accounts share the password: **`kongupassword123`**

| Student Name | Email Address | Department & Year | Role in Demo |
|---|---|---|---|
| **Divyabharathi N** | `divya.cse@kongu.edu` | CSE, 3rd Year | Seller (Calculator, Mountain Cycle) |
| **Rahul S** | `rahul.it@kongu.edu` | IT, 2nd Year | Active Bidder & Seller (Arduino Kit) |
| **Priya K** | `priya.ece@kongu.edu` | ECE, 3rd Year | High Bidder (Calculator ₹420) & Seller (Maths Book) |
| **Karthik M** | `karthik.mech@kongu.edu` | MECH, 4th Year | Seller (Omega Mini Drafter, Cycle) |
| **Sneha R** | `sneha.aids@kongu.edu` | AI & DS, 1st Year | Winner (Drafter Handover Reserved) |

> 💡 **Hackathon Tip:** On the Login page, click the quick-login buttons at the bottom to instantly populate credentials!

---

## 🎬 Hackathon Demonstration Walkthrough

Follow this step-by-step scenario to showcase the application during evaluation:

### Step 1: Campus Access Control
1. Go to [http://localhost:5173/register](http://localhost:5173/register).
2. Attempt to register with `user@gmail.com` $\rightarrow$ The system strictly blocks it with: *"Registration is restricted strictly to Kongu Engineering College emails ending in @kongu.edu"*.
3. Register or log in with `divya.cse@kongu.edu` (`kongupassword123`).

### Step 2: Publish an Item
1. Click **"Sell an Item"** in the top navigation bar.
2. Enter a title (e.g., *"Engineering Mechanics Notes & Question Bank"*), select **Books and Study Materials**, condition **Good**, starting price **₹150**, increment **₹15**, and choose **+3 Days**.
3. Upload an item image $\rightarrow$ Saved automatically into **MongoDB GridFS**.
4. Click **"Publish Listing"** $\rightarrow$ Instantly live in the campus marketplace!

### Step 3: Browse & Search
1. Open the Marketplace page.
2. Test keyword search for *"calculator"*, category shortcuts (*"Electronics"*, *"Cycles"*), or filter by condition and price range.
3. Observe live countdown timers and status badges.

### Step 4: Fair Bidding & Concurrency
1. Log in as a different student: `rahul.it@kongu.edu`.
2. Open the *"Casio fx-991EX"* auction (listed by Divya).
3. Attempt to bid lower than the minimum valid bid $\rightarrow$ Rejected with clear minimum amount calculation.
4. Place a valid bid $\rightarrow$ Instantly updates leading bid, bid count, and appears in the public bid history timeline.
5. Notice that bidder emails/passwords are completely shielded—only campus display names appear.

### Step 5: Seller Protection
1. Switch back to Divya (the seller).
2. Open **"My Listings"** $\rightarrow$ Observe that because bids have now been placed, the starting price and cancel button are locked for fairness.

### Step 6: Automated Closure & Handover Confirmation
1. In development mode, trigger fast-forward on an active auction to demonstrate closing:
   ```bash
   curl -X POST http://localhost:5000/api/dev/close-auction/<AUCTION_ID>
   ```
2. The auction automatically closes, selects the highest bidder, marks the status as **`reserved`**, and creates a handover transaction.
3. Navigate to **"Transactions"**:
   - Propose meeting spot: *"Kongu Central Library Entrance, Tomorrow at 4:30 PM"*.
   - Seller clicks **"Confirm Handover"** $\rightarrow$ Waiting on buyer.
   - Buyer clicks **"Confirm Handover"** $\rightarrow$ 2-party confirmation verified! Transaction marks **`completed`** and auction marks **`sold`**.

### Step 7: Next-Bidder Fallback Workflow
1. If the winning bidder fails to show up or declines:
2. The seller clicks **"Report Failed Pickup & Next Bidder"**.
3. The failed reservation is documented with a timestamp, and the system automatically creates a new transaction offering the item to the **next-highest eligible bidder** without losing history!

---

## 📡 API Reference

### Authentication
- `POST /api/auth/register` — Register student with `@kongu.edu` email
- `POST /api/auth/login` — Authenticate and issue JWT cookie & token
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Return authenticated student profile

### Auctions
- `GET /api/auctions` — List marketplace items with search, category, condition, price, and sorting
- `GET /api/auctions/:id` — Full details, seller info, and min acceptable bid calculation
- `POST /api/auctions` — Create new auction listing (protected)
- `PATCH /api/auctions/:id` — Update listing (protected, locked after first bid)
- `DELETE /api/auctions/:id` — Cancel listing (protected, rejected after first bid)
- `GET /api/auctions/my-listings` — Seller's personal listing dashboard

### Bidding
- `POST /api/auctions/:id/bids` — Submit bid with atomic concurrency & fairness validation
- `GET /api/auctions/:id/bids` — Public bid history (safe projection without private data)
- `GET /api/bids/my-bids` — Student's personal bidding activity & win/outbid status

### Transactions & Campus Handover
- `GET /api/transactions` — Student's active and completed handovers
- `GET /api/transactions/:id` — Handover details and 2-party status
- `PATCH /api/transactions/:id/handover` — Schedule campus meeting spot, date, and notes
- `POST /api/transactions/:id/confirm` — 2-party physical exchange confirmation
- `POST /api/transactions/:id/fail-and-reassign` — Mark failed pickup & fallback to next bidder

### Notifications (Real-Time & In-App)
- `GET /api/notifications` — Retrieve student's alerts (paginated, unread filter support)
- `GET /api/notifications/unread-count` — Real-time count of unread notifications
- `PATCH /api/notifications/:id/read` — Mark single notification as read
- `PATCH /api/notifications/read-all` — Mark all student notifications as read
- `DELETE /api/notifications/:id` — Dismiss/remove notification
- **Socket.IO Events**: `notification:new`, `notification:unread_count`

### Automated Integration Tests
Run the comprehensive 9-point notification integration suite:
```bash
npx tsx server/src/scripts/testNotifications.ts
```
*(Tests bid notification, outbid alerts, deduplication prevention, unread calculation, mark-read, mark-all-read, user isolation, closure notifications, and dismissal).*

### Images
- `POST /api/images/upload` — Upload photos to MongoDB GridFS (JPEG, PNG, WebP $\le$ 5MB)
- `GET /api/images/:id` — Stream image binary from GridFS

---

## 🚀 Presentation Architecture Summary

When presenting to hackathon judges:
1. **Targeted Campus Problem**: Solves the real semester-end waste problem at Kongu Engineering College with zero payment gateway friction.
2. **Access Control**: Simple yet bulletproof domain isolation (`@kongu.edu`).
3. **Rock-Solid Backend**: Server-authoritative time, MongoDB atomic condition checks for race conditions, idempotent background workers, and GridFS binary file streaming.
4. **Trust & Safety**: 2-party physical handover verification ensures both buyer and seller are satisfied before transactions mark completed.
5. **Modern Startup UX**: Crafted with React 19, Tailwind v4, live countdown micro-interactions, responsive mobile views, and Lucide icons.

---

*Developed for the Kongu Engineering College Hackathon 2026.*

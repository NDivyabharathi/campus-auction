 PROJECT: CAMPUS AUCTION
## Build a Complete Campus-Only Auction Marketplace

Act as a senior full-stack developer, UI/UX designer, software architect, database engineer, and QA engineer. Build a complete, functional, visually polished web application called **Campus Auction** for a college hackathon.

Do not stop at writing a plan or displaying sample screens. Inspect the project environment, create the application, implement its core features, run it locally, test the main user journeys, and fix errors before considering the work complete.

Prioritize a reliable, working MVP that can be demonstrated within 24 hours. Do not waste time implementing unnecessary enterprise features.

---

# 1. PROJECT OVERVIEW

### Problem statement

Build a platform where campus students can compete fairly for second-hand items, and every item finds its next owner.

At the end of a semester, senior students often leave behind bicycles, calculators, textbooks, laboratory equipment, electronics, and other useful items. Junior students may need these items but have no reliable way to discover them or purchase them fairly.

Campus Auction solves this problem by providing a college-focused online auction marketplace.

Students can list items, place public bids, track auctions, and complete transactions through physical handover on campus.

### Main objectives

1. Restrict registration to email addresses ending in `@kongu.edu`.
2. Allow every registered student to buy and sell using the same account.
3. Enable students to publish items for auction.
4. Allow eligible students to bid on active auctions.
5. Display the current leading bid, bid history, and auction countdown.
6. Close auctions automatically and determine the highest valid bidder.
7. Manage reservations, handovers, and failed transactions.
8. Provide a modern, responsive marketplace interface.
9. Keep the application easy to run locally and demonstrate during a hackathon.

### Important scope decisions

- Do not implement online payments.
- Do not implement Google OAuth in this initial version. Keep authentication modular so Google login can be added later.
- Do not build an admin dashboard in the initial version.
- Do not add unnecessary AI features, chat systems, payment gateways, or complicated microservices.
- Do not implement a watchlist unless all core functionality is already complete.
- Do not use mock functionality for essential features.
- Use real database persistence and real backend validation.

---

# 2. TECHNOLOGY STACK

Use the following stack unless a genuine technical limitation requires a change.

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React icons
- Axios or a similarly suitable HTTP client

### Backend
- Node.js
- Express.js
- TypeScript
- REST API architecture
- Socket.IO for real-time updates, if it can be implemented without delaying the core MVP

### Database
- MongoDB running locally.
- Mongoose for schema definitions and database operations.
- Use the local MongoDB connection through an environment variable.
- Keep the configuration flexible so MongoDB Atlas can be used later.

Default local connection example:

`mongodb://127.0.0.1:27017/campus_auction`

### Authentication
- Email and password registration and login.
- Allow only email addresses ending in `@kongu.edu`.
- Hash passwords with bcrypt or bcryptjs.
- Use JWT-based authentication.
- Store authentication tokens securely; prefer an HTTP-only cookie where practical.
- Validate authentication on protected backend routes.
- Do not trust a user ID supplied by the frontend when determining the authenticated user.

For this hackathon MVP, domain restriction is basic campus access control, not proof of student identity. Keep the authentication module structured so email verification and Google OAuth can be added later.

### Image storage
I do not have Cloudinary configured, so use MongoDB for image storage in the initial version.

Prefer MongoDB GridFS for uploaded image files, with image metadata stored in the appropriate database collection. If GridFS would significantly complicate the initial implementation, use carefully size-limited image storage with a clear migration path.

Requirements:
- Accept only supported image formats, such as JPEG, PNG, and WebP.
- Enforce a reasonable upload-size limit.
- Validate uploaded file types on the server.
- Support multiple images per listing, within a reasonable limit.
- Display image previews before publishing a listing.
- Provide meaningful fallback images when no photo is available.
- Avoid placing unlimited Base64 image data into ordinary MongoDB documents.

---

# 3. USER ROLES AND PERMISSIONS

There is one main user type: a registered student.

Every student can act as both a buyer and a seller.

### Student permissions

A student can:
- Register and log in.
- Browse active auctions.
- Search and filter listings.
- View auction details.
- Place bids on other students' auctions.
- View their own bid activity.
- Create new auction listings.
- Edit eligible listings.
- Cancel eligible listings.
- Track their own listings.
- View auction outcomes.
- View their transactions.
- Confirm completed handovers.

A student cannot:
- Bid on their own listing.
- Place a bid after the auction deadline.
- Bid below the minimum valid amount.
- Change the bid amount of a previous bid.
- Cancel an auction after it has received its first valid bid.
- Change protected auction details after the first bid.
- Mark a transaction completed without the required confirmations.
- Access another user's private account information.

The backend must enforce all permissions, regardless of what the frontend displays.

---

# 4. AUTHENTICATION AND REGISTRATION

Create polished registration and login pages.

### Registration fields

- Full name
- Kongu email address
- Password
- Confirm password

### Registration rules

1. The email must end in `@kongu.edu`.
2. Normalize email addresses before saving them.
3. Reject duplicate email addresses.
4. Validate password length and basic password requirements.
5. Hash passwords before storing them.
6. Never store plaintext passwords.
7. Show useful validation messages.
8. Do not allow registration with other email domains.

### Login rules

- Authenticate using email and password.
- Issue an appropriate authentication token or secure session.
- Return a safe user profile without password information.
- Provide logout functionality.
- Persist the login state appropriately.
- Protect authenticated pages.

Use environment variables for JWT secrets. Never hardcode production secrets.

### User profile

Store:
- User ID
- Full name
- Normalized email
- Password hash
- Account creation date
- Account status, if needed

The public marketplace must not expose email addresses.

---

# 5. MARKETPLACE HOME PAGE

The home page is the main destination after login.

Create a polished, modern marketplace interface with a clear visual hierarchy.

### Navigation bar

Include:
- Campus Auction logo
- Explore Auctions
- Sell an Item
- My Listings
- My Bids
- Transactions
- User profile menu
- Logout

Make the navigation responsive on mobile screens.

### Hero section

Suggested heading:

"Good Things Deserve a Second Round."

Suggested supporting text:

"Discover great deals across campus. Bid fairly, buy smarter, and give pre-loved items a new home."

Include:
- Search bar
- Explore Auctions button
- Sell an Item button
- A concise explanation of how campus auctions work

### Marketplace listing cards

Each card should display:
- Item image
- Item title
- Category
- Condition
- Current leading bid
- Starting price where appropriate
- Total number of bids
- Remaining auction time
- Auction status
- View Auction button

If no bids have been placed, clearly display the starting price rather than suggesting that a bid already exists.

### Search and filters

Implement working search and filters for:
- Item title and description
- Category
- Item condition
- Minimum and maximum price
- Auction status

Provide sorting options:
- Ending soon
- Recently listed
- Lowest current price
- Highest current price

Use backend queries where appropriate. Search and filters must work with actual database records.

### Categories

Create practical campus categories, including:
- Books and Study Materials
- Electronics
- Cycles and Transportation
- Hostel Essentials
- Clothing and Accessories
- Sports Equipment
- Laboratory Equipment
- Other

Display category shortcuts on the home page if space permits.

### Empty states

Provide helpful empty states when:
- No listings exist.
- A search has no results.
- No auctions match the selected filters.
- No auctions are ending soon.

Include suitable calls to action instead of blank sections.

---

# 6. CREATE AUCTION LISTING

Create a dedicated listing creation page with a clear form and validation.

### Required fields

1. Item title
2. Category
3. Description
4. Item condition
5. Item images
6. Starting price
7. Minimum bid increment
8. Auction closing date and time

### Item condition options

- New
- Like New
- Good
- Fair
- Heavily Used

### Listing rules

- Validate all required fields.
- The starting price must be greater than zero.
- The minimum bid increment must be greater than zero.
- The closing time must be in the future.
- Reject unsupported image formats.
- Enforce the image count and size limits.
- Sanitize and validate user input.
- Publish valid listings immediately.
- Record the listing owner's authenticated user ID.
- Set the initial auction status to active.

After successful creation, redirect the seller to the new auction page and show a success notification.

Do not require manual admin approval.

---

# 7. AUCTION DETAILS PAGE

Every auction must have a dedicated details page.

This page is one of the most important parts of the application.

### Layout

Use a two-column desktop layout:

Left side:
- Main item image
- Image gallery
- Item description
- Condition
- Category
- Seller display name

Right side:
- Current leading bid
- Starting price
- Minimum bid increment
- Number of bids
- Countdown timer
- Bid form
- Auction status

Below these sections, display the complete public bid history.

### Bid form

Display:
- Bid amount input
- Minimum acceptable bid
- Place Bid button
- Validation messages

If the auction has no bids, the minimum acceptable bid is the starting price.

If the auction already has a leading bid, the minimum acceptable bid is:

`Current leading bid + minimum bid increment`

The frontend should calculate and display the minimum acceptable bid, but the backend must independently validate every bid.

### Public bid history

Display:
- Bidder's campus display name
- Bid amount
- Timestamp

Do not display bidder email addresses, passwords, private account information, or authentication details.

Sort the history from newest to oldest or provide a clear chronological timeline.

The history must contain actual persisted bids. Do not fabricate bid entries.

### Auction countdown

Display the time remaining in a readable format, such as:

- 2 days, 4 hours
- 5 hours, 20 minutes
- 42 seconds

When the deadline passes, the interface must show that the auction has ended.

The server's closing time is authoritative. The browser countdown must not determine whether a bid is accepted.

---

# 8. BIDDING ENGINE AND FAIRNESS RULES

Implement bidding carefully. Fair bidding is central to this project.

### Valid bid conditions

A bid is valid only when:

1. The bidder is authenticated.
2. The auction exists.
3. The bidder is not the seller.
4. The auction is active.
5. The current server time is earlier than the closing time.
6. The bid amount is a valid positive monetary amount.
7. The bid satisfies the starting-price or current-leading-bid rule.
8. The request passes all other backend validations.

### First bid

If no bid exists:

`Minimum valid bid = Starting price`

### Subsequent bids

If a leading bid exists:

`Minimum valid bid = Current leading bid + Minimum bid increment`

Reject bids below the minimum acceptable amount.

### Monetary precision

Use a consistent representation for monetary amounts. Avoid floating-point arithmetic errors in validation. Integer paise or another consistent integer-based representation is suitable for Indian rupees.

### Bid persistence

Each bid must record:
- Bid ID
- Auction ID
- Bidder user ID
- Bid amount
- Server-generated timestamp

Store sufficient auction information to reconstruct the public bid history.

### Concurrent bids

Handle simultaneous bid submissions safely.

Two users must not both be accepted as the winner at the same leading-bid level when their bids conflict.

Use an appropriate atomic database update, transaction, version check, or retry strategy. If MongoDB transactions are used, account for the local MongoDB deployment's transaction requirements.

Do not rely on the frontend to serialize bids.

If a competing bid arrives while a user is submitting, return a clear response explaining the new minimum acceptable bid.

### Late bids

Reject any bid submitted at or after the authoritative closing time, even if an automated auction-closure job has not run yet.

### Bid immutability

Users cannot edit or delete previously accepted bids.

Do not silently replace old bid records.

### Real-time updates

If Socket.IO is implemented, broadcast appropriate updates when:
- A new valid bid is accepted.
- The current leading bid changes.
- The bid count changes.
- An auction closes.
- An auction's transaction status changes.

If real-time functionality cannot be implemented reliably in the available time, use sensible polling and complete the core auction rules first.

---

# 9. SELLER DASHBOARD: MY LISTINGS

Create a dedicated My Listings page.

Display listings owned by the logged-in user.

Each listing card or table row should show:
- Item image
- Item title
- Current leading bid
- Total number of bids
- Remaining time or closing time
- Auction status
- View Details button

Provide clear status labels:
- Active
- Ended
- Reserved
- Sold
- Unsold
- Cancelled

### Editing rules

Before the first valid bid:
- The seller may edit listing details.
- The seller may change the starting price.
- The seller may change the minimum bid increment.
- The seller may change the closing time, provided the new time is in the future.
- The seller may cancel the auction.

After the first valid bid:
- The seller cannot cancel the auction.
- The seller cannot change the starting price.
- The seller cannot change the minimum bid increment.
- The seller cannot change the closing time.
- The seller cannot make material changes to the item description or photos that could mislead bidders.

A seller must not be able to bypass these restrictions by directly calling the API.

Do not allow unauthorized users to edit another person's listing.

---

# 10. AUTOMATIC AUCTION CLOSURE

Auctions must close automatically at their configured deadlines.

Implement a reliable backend mechanism to detect expired auctions.

This can use a periodic job, scheduled worker, or another suitable approach.

### Closing process

When an active auction reaches its deadline:

1. Stop accepting new bids.
2. Determine the highest valid bid.
3. Mark the auction as ended.
4. If no bids exist, mark it unsold.
5. If a valid highest bid exists, automatically accept the highest bid.
6. Create a reservation for the highest bidder.
7. Record the transaction state.
8. Notify or inform the seller and winning bidder through the application UI.

The highest bidder should not need a separate seller acceptance step.

### Idempotency

Auction closure must be idempotent.

Running the closure job repeatedly must not:
- Create duplicate reservations.
- Create duplicate transactions.
- Select different winners for the same auction.
- Reopen closed auctions.

The closure logic must check the current state before applying changes.

### Important timing requirement

The closing job is not the authority for whether bidding is allowed. The auction's server-validated deadline is the authority.

If a user submits a bid after the deadline but before the closing job executes, reject the bid.

---

# 11. TRANSACTION AND CAMPUS HANDOVER WORKFLOW

There are no online payments.

Buyers and sellers arrange payment directly and exchange the item physically on campus.

Implement a clear, traceable transaction workflow.

### Transaction states

Use a suitable set of states, including:

- Awaiting Handover Arrangement
- Handover Scheduled
- Completed
- Failed
- Reassigned to Next Bidder

Use separate auction and transaction status fields where appropriate. Do not mix every transaction state into the auction status.

### Step 1: Reservation

When the auction closes with a valid highest bid:
- Reserve the item for the highest bidder.
- Record the buyer and seller.
- Record the winning amount.
- Create the transaction record.
- Display the reservation to both parties.

### Step 2: Handover arrangement

Provide a screen for the seller and buyer to coordinate handover details.

Allow them to record:
- Proposed campus meeting location
- Proposed date and time
- Optional handover notes

For the MVP, this can be a simple form and status flow rather than a real-time chat system.

The seller should confirm the proposed handover details through the application.

The buyer should be able to view the confirmed details.

### Step 3: Handover deadline

Implement a clear, configurable deadline for arranging the handover. Use a sensible default, such as 24 hours after reservation, and make it easy to adjust during testing.

If the seller does not provide or confirm the required handover details within the deadline:
- Mark the transaction as failed.
- Record the reason.
- Do not mark the auction as sold.
- Do not silently delete the transaction.

### Step 4: Physical handover

Once the item has been exchanged, both buyer and seller must confirm the handover.

Display separate buttons:
- Seller: Confirm Handover
- Buyer: Confirm Handover

Only mark the transaction as completed when both parties have confirmed.

Record each confirmation and its timestamp.

Do not allow one party to mark the transaction completed on behalf of the other.

### Step 5: Failed pickup and next bidder

If the winning bidder fails to collect the item within the agreed pickup deadline:

1. Mark the original reservation as failed.
2. Record the reason and timestamp.
3. Identify the next-highest eligible bidder from the auction's recorded bids.
4. Offer the item to that bidder using a new reservation or transaction attempt.
5. Notify the seller and the next eligible bidder through the application UI.
6. Apply a clear response deadline to the next bidder.
7. If the next bidder declines or fails to respond within the deadline, proceed to the next eligible bidder if one exists.

Define eligibility carefully:
- The bidder must have placed a valid bid before the auction closed.
- The bidder must not be the seller.
- The bidder must not already have completed a transaction for the item.
- The bidder must not have an active reservation for that same item.
- The bidder must not be disqualified by a recorded failure rule.

If no eligible bidders remain, mark the auction unsold or transaction failed, as appropriate.

Prevent two bidders from holding simultaneous active reservations for the same item.

Make reassignment idempotent so repeated jobs cannot assign the item multiple times.

### Transaction history

Create a Transactions page showing:
- Item image and title
- Seller and buyer display names
- Winning or offered amount
- Transaction status
- Handover details, when available
- Confirmation status
- Relevant deadlines
- Failure reason, when applicable

Users should only see transactions in which they are the buyer or seller.

---

# 12. MY BIDS PAGE

Create a My Bids page for the authenticated student.

Display every auction the student has bid on.

For each auction, show:
- Item image
- Item title
- Their latest bid
- Current leading bid
- Number of bids
- Auction closing time
- Auction status
- Whether they are currently leading
- Whether they won
- Reservation or transaction status, where relevant

Provide a link to the corresponding auction page.

Use clear status badges such as:
- Leading
- Outbid
- Auction Active
- Auction Ended
- Won
- Lost
- Reserved
- Completed
- Failed

A user should not be described as the winner until the server has determined the final highest valid bid.

If a winner's reservation later fails, show the updated transaction outcome accurately.

---

# 13. USER EXPERIENCE AND DESIGN

The application must look like a polished startup product, not a generic student CRUD project.

### Visual direction

Use a modern, clean, premium marketplace aesthetic.

Suggested design:
- Warm off-white or light neutral background
- Deep navy or charcoal typography
- A confident blue, indigo, or teal accent
- Spacious layouts
- Rounded cards
- Subtle shadows
- Consistent spacing
- Strong typography hierarchy
- Clear and accessible form controls

Avoid:
- Excessive gradients
- Too many competing colors
- Overloaded dashboards
- Unnecessary animations
- Giant empty hero sections
- Excessive emojis in the actual product UI
- Generic-looking placeholder pages
- Inconsistent buttons and status badges

Use Lucide React icons consistently.

### Responsive design

Support:
- Desktop
- Laptop
- Tablet
- Mobile

On mobile:
- Use a compact navigation layout.
- Keep bid controls easy to reach.
- Make images responsive.
- Ensure cards do not overflow.
- Keep tables readable or replace them with responsive cards.

### Interaction quality

Implement:
- Loading indicators
- Disabled button states during submissions
- Success notifications
- Error notifications
- Form validation
- Confirmation dialogs for cancellation
- Helpful empty states
- Clear error messages
- Proper not-found pages
- API error handling

Do not display browser alerts for every action if a consistent toast or dialog system is practical.

### Accessibility

- Use semantic HTML.
- Associate labels with form fields.
- Provide keyboard-accessible controls.
- Use sufficient color contrast.
- Avoid relying on color alone to communicate status.

---

# 14. DATABASE DESIGN

Design suitable Mongoose models with references, indexes, validation, and timestamps.

At minimum, create the following models.

### User

Suggested fields:
- `_id`
- `fullName`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

### Auction

Suggested fields:
- `_id`
- `sellerId`
- `title`
- `description`
- `category`
- `condition`
- `imageIds` or image references
- `startingPrice`
- `minimumBidIncrement`
- `closingAt`
- `status`
- `currentLeadingBid`
- `currentLeadingBidderId`
- `bidCount`
- `createdAt`
- `updatedAt`

Do not treat cached leading-bid fields as the only source of truth. Keep them synchronized with valid bid records and enforce consistency.

### Bid

Suggested fields:
- `_id`
- `auctionId`
- `bidderId`
- `amount`
- `createdAt`

### Transaction

Suggested fields:
- `_id`
- `auctionId`
- `sellerId`
- `buyerId`
- `amount`
- `status`
- `handoverLocation`
- `handoverDateTime`
- `handoverNotes`
- `sellerConfirmedAt`
- `buyerConfirmedAt`
- `reservationDeadline`
- `pickupDeadline`
- `failureReason`
- `createdAt`
- `updatedAt`

Adapt these models where necessary to support reassignment to a later bidder without losing the history of earlier failed reservations.

### Image storage

If using GridFS:
- Store the binary file in GridFS.
- Keep relevant metadata and references.
- Provide authorized upload and retrieval endpoints as appropriate.

### Indexes

Create useful indexes, such as:
- Unique normalized user email
- Auctions by status and closing time
- Auctions by seller and creation time
- Bids by auction and timestamp
- Bids by auction and amount
- Transactions by buyer and creation time
- Transactions by seller and creation time

Choose indexes according to actual query patterns.

Avoid embedding an unlimited number of bids inside an auction document.

---

# 15. BACKEND API DESIGN

Organize the backend into clear modules:
- Authentication
- Users
- Auctions
- Bids
- Transactions
- Images

Use a consistent response format and centralized error handling.

Suggested endpoints:

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Auctions
- `GET /api/auctions`
- `GET /api/auctions/:id`
- `POST /api/auctions`
- `PATCH /api/auctions/:id`
- `DELETE /api/auctions/:id`
- `GET /api/auctions/my-listings`

### Bids
- `POST /api/auctions/:id/bids`
- `GET /api/auctions/:id/bids`
- `GET /api/bids/my-bids`

### Transactions
- `GET /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id/handover`
- `POST /api/transactions/:id/confirm-handover`

Add other endpoints if needed for the next-bidder workflow, seller confirmation, or transaction actions.

These endpoints are suggestions. Implement the actual routes required by the chosen architecture, and ensure the frontend and backend use consistent request and response contracts.

### Backend quality requirements

- Validate request bodies.
- Validate MongoDB IDs.
- Use authentication middleware.
- Use authorization checks.
- Prevent mass assignment.
- Sanitize user input where appropriate.
- Return appropriate HTTP status codes.
- Never expose password hashes.
- Never trust a client-supplied seller ID, bidder ID, winner ID, or timestamp.
- Generate important timestamps on the server.
- Add rate limiting to authentication and other sensitive endpoints where practical.
- Keep secrets in environment variables.
- Add a health-check endpoint.

---

# 16. PROJECT STRUCTURE

Use a clean structure similar to:

`campus-auction/`
- `client/`
  - `src/`
    - `components/`
    - `pages/`
    - `layouts/`
    - `hooks/`
    - `services/`
    - `context/`
    - `types/`
    - `utils/`
- `server/`
  - `src/`
    - `config/`
    - `models/`
    - `routes/`
    - `controllers/`
    - `services/`
    - `middleware/`
    - `validators/`
    - `jobs/`
    - `utils/`
- `.gitignore`
- `README.md`

You may adjust the structure to suit the project, but maintain clear separation of responsibilities.

Do not put the entire backend into one giant file.

---

# 17. SEED DATA AND DEMO PREPARATION

Create a seed script that generates realistic development data.

Include:
- Several student accounts with `@kongu.edu` email addresses.
- Multiple auction listings.
- A mixture of categories and item conditions.
- Listings with no bids.
- Listings with multiple bids.
- Auctions ending soon.
- Ended auctions.
- Appropriate transaction examples for local testing.

Use clearly documented demo credentials.

Never create seed accounts in production automatically.

If sample images are required, use legitimate image URLs or locally available assets. If an image fails to load, provide a graceful fallback.

Create a convenient development command for seeding the local database.

Make the seed script safe to rerun without endlessly duplicating the same demo data.

---

# 18. TESTING REQUIREMENTS

Test the complete user journey rather than only checking whether pages render.

### Authentication tests
- Register with a valid `@kongu.edu` email.
- Reject an email from a different domain.
- Reject duplicate accounts.
- Reject invalid credentials.
- Confirm passwords are hashed.
- Confirm protected endpoints reject unauthenticated requests.

### Listing tests
- Create a valid auction.
- Reject a zero or negative starting price.
- Reject a zero or negative bid increment.
- Reject a closing time in the past.
- Confirm new listings appear in the marketplace.
- Confirm one student cannot edit another student's listing.

### Bidding tests
- Accept the first bid at or above the starting price.
- Reject a bid below the starting price.
- Accept a subsequent bid that satisfies the minimum increment.
- Reject an insufficient subsequent bid.
- Reject a seller's attempt to bid on their own auction.
- Reject bids after closing.
- Confirm valid bids are persisted.
- Confirm the leading bid and bid count are correct.
- Test competing bid submissions for consistency.
- Confirm public bid history does not expose email addresses.

### Editing and cancellation tests
- Allow editing before the first bid.
- Allow cancellation before the first bid.
- Reject cancellation after the first valid bid.
- Reject protected field changes after the first valid bid.
- Reject attempts to bypass restrictions through direct API calls.

### Auction closure tests
- Close an auction with no bids and mark it unsold.
- Close an auction with bids and select the highest valid bidder.
- Confirm the highest bidder receives the reservation.
- Confirm late bids are rejected even before the closure job runs.
- Run closure processing repeatedly and verify that duplicate transactions are not created.

### Transaction tests
- Confirm a seller can record or confirm handover details.
- Confirm both parties must confirm handover.
- Reject unauthorized transaction access.
- Mark a transaction failed when the seller misses the handover-arrangement deadline.
- Offer the item to the next eligible bidder when the winner fails to collect it.
- Ensure only one active reservation exists per item.
- Mark the item unsold when no eligible bidders remain.

### UI tests

Manually verify:
- Registration
- Login
- Marketplace
- Search and filters
- Listing creation
- Auction details
- Bidding
- My Listings
- My Bids
- Transaction management
- Logout
- Responsive layout

Fix any significant runtime errors or broken interactions discovered during testing.

---

# 19. ENVIRONMENT CONFIGURATION

Create `.env.example` files documenting the required environment variables.

For the backend, include suitable variables such as:

`PORT=5000`

`MONGODB_URI=mongodb://127.0.0.1:27017/campus_auction`

`JWT_SECRET=replace_with_a_long_random_secret`

`CLIENT_URL=http://localhost:5173`

`NODE_ENV=development`

Adjust the variables according to the final implementation.

Do not commit actual secrets.

Make sure the frontend and backend configuration is consistent.

Document that local MongoDB must be running before starting the backend.

Provide clear setup instructions for Windows, since the project will be developed locally on a Windows computer.

---

# 20. README AND RUNNING THE APPLICATION

Create a useful README containing:

1. Project overview.
2. Main features.
3. Technology stack.
4. Project structure.
5. Prerequisites.
6. How to install dependencies.
7. How to start local MongoDB.
8. How to configure environment variables.
9. How to seed the database.
10. How to start the backend.
11. How to start the frontend.
12. Demo credentials.
13. Main API endpoints.
14. Known limitations.
15. Future enhancements.

Provide exact terminal commands that work with the files you create.

If appropriate, add root-level development scripts that start the frontend and backend together.

Verify those scripts instead of assuming they work.

---

# 21. DEVELOPMENT PRIORITY FOR THE 24-HOUR HACKATHON

Time is limited. Implement features in the following order.

### Priority 1: Working foundation
- Project setup
- React frontend
- Express backend
- Local MongoDB connection
- Registration and login
- Protected routes

### Priority 2: Marketplace
- Create listings
- Image upload and retrieval
- Marketplace cards
- Search and filters
- Auction details page

### Priority 3: Auction engine
- Bid validation
- Bid persistence
- Current leading bid
- Public bid history
- Countdown
- Auction closing

### Priority 4: Transaction flow
- Automatic winner selection
- Reservation creation
- Handover details
- Two-party handover confirmation
- Failed pickup handling
- Next-bidder reassignment

### Priority 5: Polish
- My Listings
- My Bids
- Transactions
- Responsive UI
- Loading and error states
- Seed data
- README
- Final testing

If time becomes critically limited, finish the earlier priorities before adding optional features.

Do not sacrifice bidding correctness or authorization to add visual effects.

---

# 22. HACKATHON DEMONSTRATION FLOW

Prepare the application so the following demonstration can be performed smoothly.

### Demo scenario

1. Open the Campus Auction homepage.
2. Register or log in as a Kongu student.
3. Create an auction for a used calculator or textbook.
4. Show the listing in the marketplace.
5. Log in as another student.
6. Open the auction details page.
7. Place a valid bid.
8. Show the updated leading bid and public bid history.
9. Attempt an invalid bid and demonstrate that the backend rejects it.
10. Show the seller's My Listings page with the current bid and bid count.
11. Demonstrate the auction-closing workflow using a controlled test auction.
12. Show automatic winner selection and reservation.
13. Demonstrate handover confirmation.
14. Demonstrate a failed pickup and next-bidder reassignment using test data.
15. Show the final transaction status.

Do not wait for a real auction to expire during the demonstration. Provide a safe development-only way to test closing and transaction deadlines without changing production business rules.

Do not expose secret routes or development shortcuts in production.

---

# 23. IMPORTANT IMPLEMENTATION RULES

1. Inspect the existing project directory before making changes.
2. Reuse existing work when appropriate.
3. If the directory is empty, initialize the project.
4. Build actual functionality, not just static mockups.
5. Use TypeScript consistently.
6. Keep components reusable.
7. Keep API logic separate from UI components.
8. Use the database for persistent application data.
9. Never simulate a successful bid if the backend rejected it.
10. Never trust client-side auction calculations.
11. Validate every important operation on the server.
12. Handle concurrent bids and auction closure carefully.
13. Prevent duplicate transactions and reservations.
14. Provide clear errors when MongoDB is unavailable.
15. Do not claim that a feature is complete unless it works.
16. Do not invent credentials or claim to have configured external services without actually doing so.
17. If a required configuration is missing, implement the relevant code where possible and explain exactly what remains to be configured.
18. Do not introduce external services that require paid subscriptions unless essential.
19. Keep the code understandable so a final-year computer science student can explain it to hackathon judges.
20. After implementation, run the available build and test commands, fix failures, and report what has actually been verified.

---

# 24. FINAL DELIVERABLES

At the end, provide:

1. A complete working frontend.
2. A complete working backend.
3. MongoDB models and database configuration.
4. Authentication and authorization.
5. Auction listing and bidding functionality.
6. Automatic auction closure.
7. Transaction and handover management.
8. Image upload and retrieval.
9. Seed data and demo instructions.
10. `.env.example` files.
11. A complete README.
12. A list of implemented features.
13. A list of features that remain incomplete.
14. Exact commands to run the application locally.
15. Results of the build and tests you actually executed.
16. A short explanation of the architecture for the hackathon presentation.

### Definition of done

The project is complete when a student can register with a `@kongu.edu` email address, log in, publish an item, browse another student's listing, place a valid bid, see the correct public bid history, and participate in the automated reservation and campus handover workflow.

The application must persist its data in local MongoDB, enforce auction rules on the backend, and run locally using documented commands.

**Start by inspecting the project directory and setting up the working application. Then implement the features in priority order. Do not stop after generating a plan.**

ensure do the process step by step after each stage i need to push that i n my github

Installing backend dependencies for the server.

Installing client packages (React Router, Tailwind CSS, Lucide icons, Axios, Socket.IO client).

Still installing client packages...

🏛️ Campus Auction — Complete Hackathon MVP Built & Verified

A complete, fully functional, and visually polished Campus-Only Auction Marketplace has been built for Kongu Engineering College.

All 5 stages have been implemented, tested, and committed to Git so that you can push them directly to your GitHub repository.

📦 Git Commits & Stages Ready to Push

The Git repository has been initialized with a clean history structured across all five priority stages:

bash
ac228ec feat: stage 5 - seller dashboard, my bids tracker, rich seed data and comprehensive documentation
d9d1687 feat: stage 4 - automated auction closure, reservation, handover scheduling, two-party confirmation and next-bidder fallback
26a0cd3 feat: stage 3 - bidding engine, concurrency fairness, live countdown and public bid history
ebfdaf2 feat: stage 2 - GridFS image storage, auction creation, filters and marketplace view
92b922d feat: stage 1 - foundation setup, auth with @kongu.edu domain control, models and layout
🚀 How to Push to Your GitHub:

To push these commits to your GitHub repository:

bash
# 1. Add your remote repository URL (replace with your repo link)
git remote add origin https://github.com/<YOUR_USERNAME>/campus-auction.git
# 2. Push all commits to your main branch
git branch -M main
git push -u origin main
🛠️ Summary of Implemented Features
Stage 1: Foundation & Campus Access Control

  
Strict Domain Validation: Registration accepts only institutional email addresses ending in @kongu.edu (e.g., 21csr054@kongu.edu, divya.cse@kongu.edu). All other domains (gmail.com, yahoo.com, etc.) are rejected with clear validation notices.

  
Unified Dual-Role Model: Every student can buy and sell from a single account without separate account types.

  
Secure Authentication: Passwords hashed with bcryptjs (salt 10). Session tokens managed via signed JWTs in HTTP-Only Cookies and Bearer headers.

  
Database Architecture: Mongoose schemas for User.ts, Auction.ts, Bid.ts, and Transaction.ts with compound query indexes.

  
Frontend Core: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + Lucide Icons.

  
Stage 2: MongoDB GridFS Storage & Marketplace

  
GridFS Binary Storage: Binary image storage directly in MongoDB using GridFSBucket with Multer streaming (/api/images/upload and /api/images/:id). Supports JPEG, PNG, and WebP up to 5MB with fallback placeholders.

  
Marketplace Discovery: MarketplacePage.tsx featuring:
  
  

  
Hero banner: "Good Things Deserve a Second Round."

  
8 Campus Categories (Cycles, Electronics, Books, Hostel Essentials, Lab Equipment, Sports, Clothing, Other).

  
Search by keyword in title/description.

  
Multi-filter (Category, Condition, Price range, Status).

  
Smart sorting (Ending Soon, Recently Listed, Lowest Price, Highest Price).

  
Responsive AuctionCard.tsx with live countdowns and transparent starting price/leading bid indicators.

  

  
Listing Creation: CreateListingPage.tsx with instant duration presets (+1 Day, +3 Days, +7 Days), starting price, minimum increment, and image preview/upload.

  
Stage 3: Bidding Engine & Concurrency Fairness

  
Atomic Concurrency Protection: Optimistic atomic conditional matching (Auction.findOneAndUpdate) prevents race conditions between simultaneous bidders. Conflicting bids receive an immediate response showing the updated minimum acceptable bid.

  
Fairness Rules:
  
  

  
Self-bidding prevention (sellers cannot bid on their own listings).

  
First bid 
≥
≥ Starting price.

  
Subsequent bids 
≥
≥ Current Leading Bid + Minimum Increment.

  
Server-authoritative closing deadline (client countdown is display-only).

  
Anti-tampering: once the first bid is accepted, sellers cannot edit starting price, increment, closing time, or cancel the listing.

  

  
Auction Details Page: AuctionDetailsPage.tsx with photo gallery, live countdown with seconds precision, preset increment buttons (+₹20, +₹50, +₹100), and real-time Socket.IO broadcasts.

  
Public Bid History: Chronological timeline displaying student display name and department. Email addresses and passwords are never exposed.

  
Stage 4: Automated Closure & Campus Handover Workflow

  
Authoritative Background Worker: Background scheduler runs every 10 seconds in auctionClosureService.ts to detect expired auctions idempotently (marking unsold if 0 bids, or creating a reservation for the highest bidder).

  
Physical Handover Coordination: TransactionsPage.tsx provides a meeting spot scheduler (location, proposed date/time, and notes).

  
Two-Party Confirmation: Both buyer and seller must click "Confirm Handover Completed" in the UI before a transaction is marked completed and the auction marks sold.

  
Failed Pickup & Next-Bidder Fallback: If the winning bidder fails to show up or collect the item within the deadline, the seller can report the failure. The system automatically marks the initial attempt failed with the recorded reason and reassigns the reservation to the next-highest eligible bidder (Round #2) without losing history.

  
Hackathon Fast-Forward: Development endpoint /api/dev/close-auction/:id allows instantly concluding an auction for smooth hackathon judging demonstrations without altering production rules.

  
Stage 5: Dashboards, Seed Data & Documentation

  
Seller Hub: MyListingsPage.tsx with status filters (Active, Ended, Reserved, Sold, Unsold, Cancelled) and edit/cancel controls.

  
Bidder Tracker: MyBidsPage.tsx displaying student's highest bid, leading status, outbid alerts, won trophies, and direct handover links.

  
Database Seed Script: seed.ts populating 5 Kongu students and 6 varied listings across multiple categories and states.

  
Documentation: Comprehensive README.md with architecture diagram, API reference, demo credentials, and demonstration walkthrough.

  
👥 Demo Student Accounts (Seeded)

All demo accounts share the password: kongupassword123

Student Name	Email Address	Dept & Year	Pre-Seeded Role
Divyabharathi N	divya.cse@kongu.edu	CSE, 3rd Year	Seller (Calculator, Mountain Cycle)
Rahul S	rahul.it@kongu.edu	IT, 2nd Year	Active Bidder & Seller (Arduino Kit)
Priya K	priya.ece@kongu.edu	ECE, 3rd Year	Leading Bidder (Calculator ₹420) & Seller (Maths Book)
Karthik M	karthik.mech@kongu.edu	MECH, 4th Year	Seller (Mini Drafter & Imperial Board)
Sneha R	sneha.aids@kongu.edu	AI & DS, 1st Year	Winner (Drafter Reserved Handover)

(Quick-login buttons are also provided directly on the Login page for 1-click credential filling)

🏃 Commands to Run Locally
1. Re-seed the Database (Optional at any time):
bash
npm run seed
2. Start Both Backend & Frontend Together:
bash
npm run dev

  
Frontend Application: http://localhost:5173

  
Backend API: http://localhost:5000

  
API Health Check: http://localhost:5000/api/health

  
🧪 Build and Test Verification Results

All tests have been executed and verified in this environment:


  
Full Production Build: npm run build executed and passed for both server (tsc) and client (vite build) with 0 errors.

  
Domain Rejection Test: Attempted registration with user@gmail.com 
→
→ Blocked with HTTP 400. Valid @kongu.edu succeeded with HTTP 201.

  
Self-Bidding Prevention: Seller bidding on their own auction 
→
→ Blocked with HTTP 403.

  
Price Validation Test: Bid below starting price or insufficient increment 
→
→ Blocked with calculated minimum acceptable bid.

  
Anti-Tampering Test: Seller attempting to cancel or lower price after first bid 
→
→ Blocked with HTTP 400.

  
Handover Lifecycle Test: Fast-forward closure, reservation creation, meeting scheduling, failed pickup next-bidder fallback, and two-party confirmation 
→
→ All executed with HTTP 200.
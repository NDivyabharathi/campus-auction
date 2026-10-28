import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { CreateListingPage } from './pages/CreateListingPage.js';
import { AuctionDetailsPage } from './pages/AuctionDetailsPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { MyListingsPage } from './pages/MyListingsPage.js';
import { MyBidsPage } from './pages/MyBidsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { MyWantsPage } from './pages/MyWantsPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AssistantFloatingButton } from './components/AssistantFloatingButton.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <div className="flex flex-col min-h-screen bg-[#FFFBF5] font-sans text-[#292524]">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Navigate to="/auctions" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                
                {/* Marketplace & Details (Public to view) */}
                <Route path="/auctions" element={<MarketplacePage />} />
                <Route path="/auctions/:id" element={<AuctionDetailsPage />} />

                {/* Protected Student Routes */}
                <Route
                  path="/create-listing"
                  element={
                    <ProtectedRoute>
                      <CreateListingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-listings"
                  element={
                    <ProtectedRoute>
                      <MyListingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-bids"
                  element={
                    <ProtectedRoute>
                      <MyBidsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-wants"
                  element={
                    <ProtectedRoute>
                      <MyWantsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <TransactionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* 404 Route */}
                <Route
                  path="*"
                  element={
                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
                      <h1 className="text-4xl font-extrabold text-[#292524]">404</h1>
                      <p className="mt-2 text-[#78716C]">Page not found.</p>
                    </div>
                  }
                />
              </Routes>
            </main>
            <Footer />
            <AssistantFloatingButton />
          </div>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

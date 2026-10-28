import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { CreateListingPage } from './pages/CreateListingPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/auctions" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Marketplace & Details (Public to view) */}
              <Route path="/auctions" element={<MarketplacePage />} />
              <Route path="/auctions/:id" element={<div className="p-8 text-center">Auction Details Loading...</div>} />

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
                    <div className="p-8 text-center">My Listings Page Loading...</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bids"
                element={
                  <ProtectedRoute>
                    <div className="p-8 text-center">My Bids Page Loading...</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <div className="p-8 text-center">Transactions Page Loading...</div>
                  </ProtectedRoute>
                }
              />
              
              {/* 404 Route */}
              <Route
                path="*"
                element={
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
                    <h1 className="text-4xl font-extrabold text-slate-800">404</h1>
                    <p className="mt-2 text-slate-500">Page not found.</p>
                  </div>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

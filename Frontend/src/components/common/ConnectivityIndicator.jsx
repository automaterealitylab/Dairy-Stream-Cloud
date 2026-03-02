import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

const ConnectivityIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);

    const handleOffline = () => {
      setIsOnline(false);
    };

    const checkPendingItems = () => {
      try {
        const pendingDeliveries = JSON.parse(
          localStorage.getItem('pendingDeliveries') || '[]'
        );
        const pendingProofs = JSON.parse(
          localStorage.getItem('pendingProofs') || '[]'
        );
        setPendingItems(pendingDeliveries.length + pendingProofs.length);
      } catch (error) {
        console.error('Error checking pending items:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkPendingItems();
    const interval = setInterval(checkPendingItems, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600';
    if (pendingItems > 0) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStatusBgColor = () => {
    if (!isOnline) return 'bg-red-50';
    if (pendingItems > 0) return 'bg-orange-50';
    return 'bg-green-50';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (pendingItems > 0) return `${pendingItems} pending`;
    return 'Online';
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${getStatusBgColor()} ${getStatusColor()}`}
      title={
        isOnline
          ? pendingItems > 0
            ? `${pendingItems} changes are waiting for sync`
            : 'Connected'
          : 'No internet connection. Changes will sync once online.'
      }
    >
      {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
      <span>{getStatusText()}</span>
    </div>
  );
};

export default ConnectivityIndicator;

// Usage in components:
// 1. Add to navigation/header:
//    <ConnectivityIndicator />
//
// 2. For page-level indicator banner:
export const ConnectivityBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkPendingItems = () => {
      try {
        const pendingDeliveries = JSON.parse(
          localStorage.getItem('pendingDeliveries') || '[]'
        );
        const pendingProofs = JSON.parse(
          localStorage.getItem('pendingProofs') || '[]'
        );
        setPendingItems(pendingDeliveries.length + pendingProofs.length);
      } catch (error) {
        console.error('Error checking pending items:', error);
      }
    };

    checkPendingItems();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingItems === 0) {
    return null;
  }

  return (
    <div
      className={`${
        isOnline
          ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
          : 'bg-red-100 border-red-300 text-red-800'
      } border-b px-4 py-3 flex items-center justify-between sticky top-0 z-40`}
    >
      <div className="flex items-center gap-3">
        {isOnline ? (
          <Wifi size={20} />
        ) : (
          <WifiOff size={20} />
        )}
        <div>
          <p className="font-medium">
            {isOnline ? 'You are online' : 'You are offline'}
          </p>
          {isOnline && pendingItems > 0 && (
            <p className="text-sm opacity-80">
              {pendingItems} items waiting to be synced
            </p>
          )}
          {!isOnline && (
            <p className="text-sm opacity-80">
              Changes will be saved locally and synced when online
            </p>
          )}
        </div>
      </div>
      {isOnline && pendingItems > 0 && (
        <button className="px-4 py-2 bg-white rounded font-medium text-sm hover:bg-opacity-90 transition-opacity">
          Sync Now
        </button>
      )}
    </div>
  );
};

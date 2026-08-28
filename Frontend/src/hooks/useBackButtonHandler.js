import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { useAuth } from './useAuth';

const useBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const handleBackButton = async (event) => {
      // 1. Determine the user's home path
      const role = user?.role || localStorage.getItem("userRole");
      const normalizedRole = String(role || "").toUpperCase();

      let homePath = "/";
      if (normalizedRole === "ADMIN") homePath = "/admin/AdminDashboard";
      else if (normalizedRole === "AGENT" || normalizedRole === "STAFF") homePath = "/agent/dashboard";
      else if (normalizedRole === "CUSTOMER") homePath = "/customer/dashboard";
      else if (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(normalizedRole)) homePath = "/super-admin/dashboard";

      const currentPath = location.pathname;

      // 2. Logic: If NOT at home path, go home. If AT home path, ask to exit.
      // Note: We also check for the root "/" as a home path for unauthenticated users
      const isAtHome = currentPath === homePath || currentPath === "/";

      if (!isAtHome && event.canGoBack) {
        console.log("Back button: Navigating to home", homePath);
        navigate(homePath);
      } else {
        console.log("Back button: At home or can't go back, prompting exit");
        const { value } = await Dialog.confirm({
          title: 'Exit App',
          message: 'Do you really want to close the app?',
          okButtonTitle: 'Exit',
          cancelButtonTitle: 'Cancel',
        });

        if (value) {
          App.exitApp();
        }
      }
    };

    const listener = App.addListener('backButton', handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [location, navigate, user]);
};

export default useBackButtonHandler;

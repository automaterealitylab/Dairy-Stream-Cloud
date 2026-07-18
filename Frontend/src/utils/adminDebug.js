/**
 * Admin Authentication Debug Utility
 * Copy this code into your browser console to test the login flow
 */

const BASE_URL = "https://dairy-stream-cloud-backend.onrender.com";
console.log("🚀 DEBUG BASE_URL (Hardcoded Render):", BASE_URL);

export const debugAdmin = {
  // Check backend connection
  async testBackend() {
    console.log("🧪 Testing backend connection...");
    try {
      const res = await fetch(`${BASE_URL}/api/admin/health`);
      const data = await res.json();
      console.log("✅ Backend is running:", data);
      return true;
    } catch (err) {
      console.error("❌ Backend is not responding:", err.message);
      return false;
    }
  },

  // Check localStorage
  checkStorage() {
    console.log("🧪 Checking localStorage...");
    const token = localStorage.getItem("adminToken");
    const user = localStorage.getItem("adminUser");
    const role = localStorage.getItem("userRole");
    
    console.log("📦 localStorage contents:");
    console.log(`  - adminToken: ${token ? '✅ Present (' + token.substring(0, 20) + '...)' : '❌ Missing'}`);
    console.log(`  - adminUser: ${user ? '✅ ' + user : '❌ Missing'}`);
    console.log(`  - userRole: ${role ? '✅ ' + role : '❌ Missing'}`);
    
    return { token, user, role };
  },

  // Test login
  async testLogin(email = "admin@gmail.com", password = "admin123") {
    console.log(`🧪 Testing admin login with ${email}...`);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      console.log("Response status:", res.status);
      console.log("Response text:", text);

      if (!res.ok) {
        console.error("❌ Login failed with status", res.status);
        return null;
      }

      const data = JSON.parse(text);
      console.log("✅ Login successful!", data);
      
      // Store token
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUser", JSON.stringify(data.user));
      localStorage.setItem("userRole", "ADMIN");
      
      console.log("✅ Token stored in localStorage");
      return data;
    } catch (err) {
      console.error("❌ Login error:", err.message);
      return null;
    }
  },

  // Test dashboard fetch
  async testDashboard() {
    console.log("🧪 Testing dashboard fetch...");
    const token = localStorage.getItem("adminToken");
    
    if (!token) {
      console.error("❌ No token found in localStorage");
      return null;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const text = await res.text();
      console.log("Response status:", res.status);
      console.log("Response text:", text);

      if (!res.ok) {
        console.error("❌ Dashboard fetch failed with status", res.status);
        return null;
      }

      const data = JSON.parse(text);
      console.log("✅ Dashboard data fetched!", data);
      return data;
    } catch (err) {
      console.error("❌ Dashboard fetch error:", err.message);
      return null;
    }
  },

  // Full test sequence
  async runFullTest() {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 Running full admin auth test sequence...");
    console.log("=".repeat(50) + "\n");

    // Step 1: Check backend
    console.log("📍 Step 1: Testing backend connection");
    const backendOk = await this.testBackend();
    if (!backendOk) {
      console.error("❌ Backend is not running! Start it with: npm run dev");
      return false;
    }

    // Step 2: Check storage
    console.log("\n📍 Step 2: Checking localStorage");
    this.checkStorage();

    // Step 3: Test login
    console.log("\n📍 Step 3: Testing login");
    const loginResult = await this.testLogin();
    if (!loginResult) {
      console.error("❌ Login failed!");
      return false;
    }

    // Step 4: Test dashboard
    console.log("\n📍 Step 4: Testing dashboard fetch");
    const dashboardResult = await this.testDashboard();
    if (!dashboardResult) {
      console.error("❌ Dashboard fetch failed!");
      return false;
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ All tests passed!");
    console.log("=".repeat(50) + "\n");
    return true;
  },

  // Clear all admin data
  clearAll() {
    console.log("🧹 Clearing all admin data from localStorage...");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("userRole");
    console.log("✅ Cleared!");
  },
};

// Instructions to run
console.log(`
🧪 ADMIN DEBUG UTILITY AVAILABLE

Run these commands in the browser console to test:

1. Check backend: debugAdmin.testBackend()
2. Check localStorage: debugAdmin.checkStorage()
3. Test login: debugAdmin.testLogin()
4. Test dashboard: debugAdmin.testDashboard()
5. Full test: debugAdmin.runFullTest()
6. Clear data: debugAdmin.clearAll()

Or copy this into your browser console:
import { debugAdmin } from './utils/adminDebug.js';
debugAdmin.runFullTest();
`);

export default debugAdmin;

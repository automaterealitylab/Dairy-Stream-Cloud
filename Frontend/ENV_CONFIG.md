# Environment Configuration for Capacitor

## Create `.env` file in Frontend directory:

```env
# API Configuration
VITE_API_URL=https://api.dairystream.com
VITE_SOCKET_URL=https://api.dairystream.com
VITE_APP_NAME=Dairy Stream

# Optional: Environment
VITE_ENV=production
```

## In your API service file (e.g., Frontend/src/api/axiosConfig.js):

Replace relative URLs with absolute URLs:

### ❌ WRONG (Won't work in native app):
```javascript
const API_BASE_URL = '/api'
```

### ✅ RIGHT (Works everywhere):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.dairystream.com'
```

## Full Example (Frontend/src/api/axiosConfig.js):

```javascript
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.dairystream.com'

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default axiosInstance
```

## Socket.IO Configuration:

### ❌ WRONG:
```javascript
import io from 'socket.io-client'
const socket = io('/')
```

### ✅ RIGHT:
```javascript
import io from 'socket.io-client'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://api.dairystream.com'
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
})
```

## Development vs Production:

Create separate env files:

### `.env.development`
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### `.env.production`
```env
VITE_API_URL=https://api.dairystream.com
VITE_SOCKET_URL=https://api.dairystream.com
```

## Usage in Components:

```javascript
import { useEffect, useState } from 'react'
import axiosInstance from '../api/axiosConfig'

export function MyComponent() {
  const [data, setData] = useState([])

  useEffect(() => {
    // This will use VITE_API_URL automatically
    axiosInstance.get('/api/customers')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
  }, [])

  return <div>{data.length} items</div>
}
```

## Backend CORS Configuration (Important!):

Your backend must allow requests from the app. Update Backend/server.js:

```javascript
import cors from 'cors'

app.use(cors({
  origin: [
    'http://localhost:5173',           // Web dev
    'http://localhost:3000',           // Web dev
    'capacitor://localhost',            // iOS
    'http://192.168.x.x:8080',         // Android emulator
    'https://api.dairystream.com',     // Production
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
```

## Testing URLs:

```bash
# Web development
http://localhost:5173

# Android emulator local backend
http://10.0.2.2:5000  # This maps to host's localhost

# Real device on same network
http://192.168.1.X:5000  # Use your actual IP
```

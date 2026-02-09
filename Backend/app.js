const express=require('express')
const cors=require('cors')
require('dotenv').config();
const { connect }=require('./config')
const initializeDatabase=require('./utils/initializeDatabase')
const customerRoutes=require('./routes/CustomerRoutes')
const agentRoutes=require('./routes/agentRoutes')

const app=express()
app.use(express.json())
app.use(cors())


app.use('/api/customer',customerRoutes)
app.use('/api/agent',agentRoutes)



connect()

// Automatic DB initialization disabled by default to avoid network/DNS issues during local development.
// To enable automatic table creation, set SUPABASE_AUTO_INIT=true in your .env file.
if (process.env.SUPABASE_AUTO_INIT === 'true') {
  initializeDatabase();
} else {
  console.log('ℹ️ Automatic DB initialization is disabled. To enable, set SUPABASE_AUTO_INIT=true in your .env file.');
}

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`)
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the process using that port or set a different PORT in your .env file and try again.`);
    process.exit(1);
  }
  console.error(err);
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date()
  });
});

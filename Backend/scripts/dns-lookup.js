import dns from "dns";

const hosts = [
  "drncjxojfmepvsupjaut.supabase.co",
  "db.drncjxojfmepvsupjaut.supabase.co"
];

for (const host of hosts) {
  dns.lookup(host, (err, address, family) => {
    if (err) {
      console.error(`DNS lookup failed for ${host}:`, err.message);
    } else {
      console.log(`DNS lookup for ${host}: ${address} (family: IPv${family})`);
    }
  });
}

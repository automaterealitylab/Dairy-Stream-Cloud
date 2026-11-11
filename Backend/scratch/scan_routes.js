import fs from 'fs';
import path from 'path';

const routeFiles = [
  'admin.routes.js',
  'agent.routes.js',
  'auth.routes.js',
  'customer.routes.js',
  'location.js',
  'propertyHierarchy.routes.js',
  'public.routes.js',
  'superAdmin.routes.js',
];

const basePathMap = {
  'admin.routes.js': '/api/admin',
  'agent.routes.js': '/api/agent',
  'auth.routes.js': '/api/auth',
  'customer.routes.js': '/api/customer',
  'location.js': '/api/location',
  'propertyHierarchy.routes.js': '/api/property-hierarchy',
  'public.routes.js': '/api/public',
  'superAdmin.routes.js': '/api/super-admin',
};

const results = [];

routeFiles.forEach(file => {
  const filePath = path.join('Backend/routes', file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const base = basePathMap[file] || '';

  const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']\s*,\s*(?:([^)]+)\s*,)?\s*([a-zA-Z0-9_]+)\s*\)/g;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const match = /router\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/i.exec(trimmed);
    if (match) {
      results.push({
        file,
        method: match[1].toUpperCase(),
        path: base + (match[2] === '/' ? '' : match[2]),
        line: idx + 1,
        raw: trimmed
      });
    }
  });
});

console.log(JSON.stringify(results, null, 2));
console.log('Total endpoints scanned:', results.length);

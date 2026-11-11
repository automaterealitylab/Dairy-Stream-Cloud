import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') getFiles(fullPath, files);
    } else if (file.endsWith('.js') || file.endsWith('.sql')) {
      files.push(fullPath);
    }
  });
  return files;
}

const files = getFiles('Backend');
const tables = new Set();
const tableRegex = /\.from\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = tableRegex.exec(content)) !== null) {
    tables.add(m[1]);
  }
});

console.log('Tables found in Backend:', Array.from(tables).sort());

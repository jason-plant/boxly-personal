const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'source', 'logo-master.png');
if (!fs.existsSync(p)) { console.error('file not found:', p); process.exit(1); }
const b = fs.readFileSync(p).slice(0,32);
console.log('bytes:', [...b].map(x => x.toString(16).padStart(2,'0')).join(' '));

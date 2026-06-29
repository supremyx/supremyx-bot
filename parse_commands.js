const fs = require('fs');
const path = require('path');

const commandDir = 'commands';
const files = fs.readdirSync(commandDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(commandDir, file), 'utf-8');
  const triggers = new Set();
  
  // Find all strings starting with ! or % that look like triggers
  const triggerRegex = /['"]([!%][a-zA-Z0-9]+)['"]/g;
  let match;
  while ((match = triggerRegex.exec(content)) !== null) {
    const t = match[1];
    if (content.includes(`startsWith('${t}')`) || 
        content.includes(`startsWith("${t}")`) || 
        content.includes(`=== '${t}'`) || 
        content.includes(`=== "${t}"`) ||
        content.includes(`slice('${t}'.length)`) ||
        content.includes(`slice("${t}".length)`)) {
      triggers.add(t);
    }
  }

  if (triggers.size > 0) {
    console.log(`FILE: ${file}`);
    console.log(`TRIGGERS: ${Array.from(triggers).join(', ')}`);
    
    // Check for staff
    const isStaff = content.includes('Administrator') || content.includes('isStaff') || content.includes('LEVELS.ADMIN') || content.includes('Staff uniquement');
    console.log(`STAFF: ${isStaff}`);

    // Try to find subcommands
    const subRegex = /sub === ['"]([a-zA-Z0-9]+)['"]|case ['"]([a-zA-Z0-9]+)['"]:|args\[\d+\] === ['"]([a-zA-Z0-9]+)['"]/g;
    const subs = new Set();
    while ((match = subRegex.exec(content)) !== null) {
      subs.add(match[1] || match[2] || match[3]);
    }
    if (subs.size > 0) {
      console.log(`SUBS: ${Array.from(subs).join(', ')}`);
    }

    // Try to extract usage for description
    const usageMatch = content.match(/Usage : `([^`]+)`/);
    if (usageMatch) {
      console.log(`DESC: ${usageMatch[1]}`);
    } else {
       // Look for a comment at the top
       const topComment = content.match(/\/\*\*?([\s\S]*?)\*\//);
       if (topComment) {
         const descLine = topComment[1].split('\n').find(l => l.includes('—') || l.includes('-'));
         if (descLine) console.log(`DESC: ${descLine.trim().replace(/^\*?\s*/, '')}`);
       }
    }
    console.log('---');
  }
});

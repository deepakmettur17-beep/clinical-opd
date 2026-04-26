const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'app', 'backend', 'services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Look for the export and truncate anything after it that looks like localServer.listen
  const exportMatch = content.match(/module\.exports\s*=\s*{[\s\S]*?};/);
  if (exportMatch) {
    const exportedIndex = content.indexOf(exportMatch[0]) + exportMatch[0].length;
    let newContent = content.substring(0, exportedIndex);
    
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Cleaned up: ${file}`);
    }
  }
});

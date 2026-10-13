const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function dashboard(meta = [], amz = []) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>\s*(const API_URL=[\s\S]*?)<\/script>/)[1]
    .replace(/\nloadData\(\);\s*$/, '');
  const context = vm.createContext({
    window: {}, console: { log() {}, warn() {}, error(e) { throw e; } },
    document: { getElementById() { return { style: {} }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    fetch: async url => ({ text: async () => JSON.stringify(
      url.includes('meta-raw-new') ? meta : url.includes('amz-raw-new') ? amz : []
    ) }),
  });
  vm.runInContext(script, context);
  vm.runInContext('renderMonthPills=()=>{}; refresh=()=>{};', context);
  return context;
}

module.exports = { dashboard };

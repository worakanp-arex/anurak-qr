const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8'],
  '/assets/anurak-logo.png': ['assets/anurak-logo.png', 'image/png'],
  '/assets/anurak-portrait.png': ['assets/anurak-portrait.png', 'image/png'],
};
const clients = new Set();
const reload = '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = files[pathname];
  if (!file) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  fs.readFile(path.join(__dirname, file[0]), (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Unable to read preview file');
      return;
    }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    res.end(file[0] === 'index.html' ? content.toString('utf8').replace('</body>', reload + '</body>') : content);
  });
});

let debounce;
const watcher = fs.watch(__dirname, (_, filename) => {
  if (!['index.html', 'style.css', 'script.js'].includes(String(filename))) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 150);
});
const assetWatcher = fs.watch(path.join(__dirname, 'assets'), () => {
  for (const client of clients) client.write('data: reload\n\n');
});
const heartbeat = setInterval(() => {
  for (const client of clients) client.write(': keep-alive\n\n');
}, 15000);
server.on('error', error => {
  console.error(error.message);
  watcher.close();
  assetWatcher.close();
  clearInterval(heartbeat);
  process.exitCode = 1;
});
server.listen(5500, '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:5500 (auto reload enabled)');
});

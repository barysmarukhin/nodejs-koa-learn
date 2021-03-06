const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const mime = require('mime');
const config = require('config');

module.exports = http.createServer((req, res) => {
  let pathname = decodeURI(url.parse(req.url).pathname);
  let filename = pathname.slice(1);
  let filePath = path.join(config.get('filesRoot'), filename);

  if (filename.includes('/') || filename.includes('..')) {
    res.statusCode = 400;
    res.end('Nested paths are not allowed');
    return;
  }

  if (req.method === 'GET') {
    if (pathname === '/') {
      let markupPath = config.get('publicRoot') + '/index.html';
      sendFile(markupPath, res);
    } else {
      sendFile(filePath, res);
    }
  }
  if (req.method === 'POST') {
    receiveFile(filePath, req, res);
  }
})

function receiveFile(filePath, req, res) {
  let size = 0;
  const writingFile = fs.createWriteStream(filePath, {flags: 'wx'});

  req.on('data', chunk => {
    size += chunk.length;
    console.log(size, config.get('limitFileSize'), size > config.get('limitFileSize'));
    if(size > config.get('limitFileSize')) {
      console.log('too big');
      res.statusCode = 413;
      res.setHeader('connection', 'close');
      res.end('file is too big');
      writingFile.destroy();
      fs.unlink(filePath, () => {});
    }
  })
  .on('close', () => {
    writingFile.destroy();
    fs.unlink(filePath, () =>{});
  })
  .pipe(writingFile);

  writingFile.on('error', err => {
    if(err.code === 'EEXIST') {
      res.statusCode = 409;
      res.end('File already exist')
    } else {
      if (!res.headersSent) {
        res.writeHead(500, {'Connection': 'close'});
        res.write('Internal error');
      }
      fs.unlink(filepath, err => { // eslint-disable-line
        /* ignore error */
        res.end();
      });
    }
  })
  .on('close', () => {
    // Note: can't use on('finish')
    // finish = data flushed, for zero files happens immediately,
    // even before 'file exists' check

    // for zero files the event sequence may be:
    //   finish -> error

    // we must use 'close' event to track if the file has really been written down
    res.end('OK');

  });

  res.on('finish', () => console.log('finish'));

}

function sendFile(path, res) {
  const readingFile = fs.createReadStream(path);
  readingFile.pipe(res);
  readingFile.on('error', err => {
    if(err.code === 'ENOENT') {
      res.statusCode = 404;
      res.end('Not Found');
    } else {
      console.error(err);
    } 
  })
  .on('open', () => {
    res.setHeader('Content-Type', mime.getType(path))
  })
  .on('close', () => {
    readingFile.destroy();
  })
}

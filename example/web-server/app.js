const express = require('express');
const path = require('path');
const http = require('http');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'public'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));
app.set('x-powered-by', false);


app.set('port', 3001);
const server = http.createServer(app);
server.listen(3001);

console.log('Web server has started.\nPlease log on http://127.0.0.1:3001/index.html');

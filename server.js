var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var WebSocketServer = require("ws").Server;

var PORT = process.env.PORT || 3000

// middleware
app.use('/', express.static(path.join(__dirname, 'webApp')));

//sockets 
var wss = new WebSocketServer({ 
    server: http, 
    path: "/node/chatServer"
});


// routes
app.get('/', function (req, res) {

    res.sendFile(__dirname + '/webApp/index.html');
});

http.listen(PORT, function () {
    console.log('Express listening on port + ' + PORT);
    });

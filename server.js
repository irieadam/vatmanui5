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
    path: "/node/process"
});
wss.broadcast = function (data) {
    for (var i in this.clients)
        this.clients[i].send(data);
    console.log("sent: %s", data);
};

wss.on("connection", function (ws) {
    ws.on("message", function (message) {
        console.log("received: %s", message);
        wss.broadcast(message);
    });
    ws.send(JSON.stringify({
        user: "XS",
        text: "Hello from Node.js XS Server"
    }));
});

// routes
app.get('/', function (req, res) {

    res.sendFile(__dirname + '/webApp/index.html');
});

http.listen(PORT, function () {
    console.log('Express listening on port + ' + PORT);
    });

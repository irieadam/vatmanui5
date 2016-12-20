var util = require('./lib/util')
var db = require('./db.js');
var middleware = require('./lib/middleware.js')(db);

var async = require('async');
var path = require('path');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var _ = require('underscore');
var cookieParser = require('cookie-parser');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var WebSocketServer = require("ws").Server;

var PORT = process.env.PORT || 3000

// middleware
app.use(cookieParser());
app.use(bodyParser.json({ limit: '3mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, 'webApp')));

//sockets 
var wss = new WebSocketServer({ 
    server: http, 
    path: "/node/process"
});

/**
wss.broadcast = function (data) {
    for (var i in this.clients)
        this.clients[i].send(data);
    console.log("sent: %s", data);
}; */

var clients = [];
wss.on("connection", function (ws) {
    clients.push(ws);
    


    ws.on("message", function (message) {
        console.log("received: %s", message);
     
      ws.send(message);
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

app.post('/users/login', function (req, res) {
    util.doLogin(req, res, db);
});

app.delete('/logout', middleware.requireAuthentication, function (req, res) {
    util.doLogout(req, res,db);
});

db.sequelize.sync({
    force: true
 }).then(function () {
    http.listen(PORT, function () {

        //create admin
        var body = {
            email: 'admin@vatvision.com',
            password: 'happyday1'
        };
        db.user.create(body).then(function (user) {
            console.log('Express listening on port + ' + PORT);
        }).catch(function (e) {
            console.log('Admin user creation failed ' + e);
        })

    });

});


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
var clients = [];
var wss = new WebSocketServer({ 
    server: http, 
    path: "/node/process"
});
wss.on("connection", function (ws) {
    
    var cookies = {};
    ws._socket._idleTimeout = 6000000;

    if(ws.upgradeReq.headers.cookie!=null) {
        ws.upgradeReq.headers.cookie.split(';').forEach(function (cookie) {
            var parts = cookie.match(/(.*?)=(.*)$/)
            cookies[parts[1].trim()] = (parts[2] || '').trim();
        });
    };

   var client = clients.filter(function(value) { return value.sessionId === cookies.sessionId });
   if (typeof client[0] === 'undefined') {
           clients.push({
             sessionId  : cookies.sessionId,
             ws: ws});   
   } else {
       client[0].ws = ws
   }
    
    ws.on("message", function (message) {
        console.log("received: %s", message);
     
      ws.send(message);
    });

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
    var id = util.getCookies(req).sessionId;
    removeWSClient(id);
});

app.post('/process', middleware.requireAuthentication, function (req, res) {
    var requestId = req.body.requestId;
    var requesterNumber = req.body.requesterVatNumber;
    var requesterCountry = req.body.requesterCountryCode;
    var vatNumbers = req.body.vatNumbers;
    var sessionId = util.getCookies(req).sessionId;
    var oWs = getWSClient(sessionId);

    res.cookie('lastRequest', requestId);
    res.status(200).send();

    util.getSoapClient().then(function(client){

            async.eachLimit(vatNumbers, 28, function (vatRequest, cb) {

                db.request.findOne({
                    where: {
                    itemId: vatRequest.itemId
                    }
                     }).then(function (request) {
            
                        if (request === null) {
                          db.request.create({
                            id: sessionId + requestId + vatRequest.itemId,
                            sessionId: sessionId,
                            requestId: requestId,
                            itemId: vatRequest.itemId,
                            vatNumber: vatRequest.vatNumber,
                            countryCode: vatRequest.countryCode,
                            requesterVatNumber: requesterNumber,
                            requesterCountryCode: requesterCountry,
                            status: '0',
                            retries: 0,
                            error: ""
                         }).then(function (request) {
                            util.callVatService(client,request).then(
                                function () {
                                    oWs.send(JSON.stringify(request));
                                    cb();
                                },function (err) {
                                    oWs.send(JSON.stringify(request));
                                    cb(err);
                                } );
                        }).catch(function (e) {
                            console.log(e);
                            vatRequest.status = 4;
                            oWs.send(JSON.stringify(vatRequest));
                            
                        });
                    } else {
                        if (request.status === '3') {
                            request.update({
                                requestId: requestId,
                            }).then(function () {
                                cb();
                            });
                        } else {
                            request.update({
                                
                                requestId: requestId,
                                requesterVatNumber: requesterNumber,
                                requesterCountryCode: requesterCountry,
                                vatNumber: vatRequest.vatNumber,
                                countryCode: vatRequest.countryCode,
                                retries: request.retries + 1
                                }).then(function (request) {
                                        util.callVatService(client,request).then(
                                            function (request) {  
                                                oWs.send(JSON.stringify(request));
                                                cb();          
                                            },function (err) {
                                                oWs.send(JSON.stringify(request));
                                                cb(err);
                                            });

                        }).catch(function (e) {
                            console.log("?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????!");
                            oWs.send(JSON.stringify(request));
                            console.log(e);
                        });
                    }
                }
            
            });
        }, function (err) {
            if (err) {
                console.log('A file failed to process: ' +  err);
            } else {
                 console.log('Done !!!: ');
                var data = { processed : true} 
                oWs.send(JSON.stringify({ data})); 
            }
        }); //async
    },function(err){
        console.log("could not get soap client!!" + err);
    });
});

app.get('/export', middleware.requireAuthentication, function (req, res) {
    util.doExport(req, res,db);

});

// db init
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

//shizzle
var getWSClient = function (sessionId) {
        // get the ws socket based on the sessionid which the client got when logging in
        for(var i=0 ; i < clients.length; i++ ) {
            if (clients[i].sessionId === sessionId) {
                return clients[i].ws;
            }
        }

    };

var removeWSClient = function (sessionId) {

    for(var i=0 ; i < clients.length; i++ ) {
        if (clients[i].sessionId === sessionId) {
            clients[i].ws.close();
            clients.splice(i, 1);
        }
    }

};
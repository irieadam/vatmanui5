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

var PORT = process.env.PORT || 3000;

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
});

// routes
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/webApp/index.html');
});

app.post('/users/login', function (req, res) {
    util.doLogin(req, res, db);
});

app.post('/users',middleware.requireAuthentication, function(req, res){
    var body = _.pick(req.body,'email','isAdmin','countryCode','vatNumber', 'name','address','password') ;
    
    db.user.create(body).then(function (user) {
        res.json(user.toPublicJSON());
    } ).catch(function (e){
        res.status(400).json(e);
    })

});

app.get('/users',middleware.requireAuthentication, function (req, res) {
    util.getUsers(res, db);
});

app.delete('/users/:id', middleware.requireAuthentication , function (req, res) {
     var userId  = parseInt(req.params.id,10);
        db.user.destroy({
            where : {
                id: userId
            }
        }).then(function (rowsDeleted) {
             if (rowsDeleted === 0) {
                 res.status(404).json({
                     error : 'no user found'
                 });
             } else {
                res.status(200).send();    
             }
        } ,function () {
            res.status(500).send();  
          }
     );  
});


app.post('/users/logout', middleware.requireAuthentication, function (req, res) {
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
    proceed = true;

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
                            vatRequest.updatedAt = "         ";
                            vatRequest.status = "4";
                            vatRequest.valid = "Failed";
                            console.log(vatRequest.toString());
                            oWs.send(JSON.stringify(vatRequest));
                            cb();
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
                            console.log("????????????????????????????!");
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
                var data = { processed : true} 
                oWs.send(JSON.stringify({ data})); 
            }
        }); //async
    },function(err){
        console.log("could not get soap client!!" + err);
    });
});

app.post('/validate', function (req, res) {
    var checkVatApprox = {
        countryCode: req.body.countryCode,
        vatNumber: req.body.vatNumber,
        requesterCountryCode: req.body.requesterCountryCode,
        requesterVatNumber: req.body.requesterVatNumber
    };
    var output = {};
    util.getSoapClient().then(function (client) {
        client.checkVatApprox(checkVatApprox, function (err, result) {
            if (result) {
                res.status(200).send(result);
            } else {
                res.status(501).send(err);
            }
        })
    })
});

app.get('/export', middleware.requireAuthentication, function (req, res) {
    util.doExport(req, res,db);
});

// db init
db.sequelize.sync({
    force: true
 }).then(function () {
    console.log('Starting!');
    http.listen(PORT, function () {

    db.user.findAll({where : {
        id : 1
      }}).then(function (data) {
        
          if (data.length === 0 ) {
            var body = {
                email: 'admin@vatvision.com',
                password: 'happyday1',
                isAdmin: true
            };
          db.user.create(body).then(function (user) {
                clearRequests(db);
                console.log('Started!');
             }).catch(function (e) {
                console.log('Admin user creation failed ' + e);
            }) 

          } else {
              clearRequests(db);
          }

    }).catch(function (e){
        var hello;
    }

    )  
        //create admin
  


    });

});



//shizzle
function getWSClient (sessionId) {
        // get the ws socket based on the sessionid which the client got when logging in
        for(var i=0 ; i < clients.length; i++ ) {
            if (clients[i].sessionId === sessionId) {
                return clients[i].ws;
            }
        }

    };

function removeWSClient (sessionId) {

    for(var i=0 ; i < clients.length; i++ ) {
        if (clients[i].sessionId === sessionId) {
            clients[i].ws.close();
            clients.splice(i, 1);
        }
    }

};
function clearRequests (db) {
        db.request.destroy( {
        where : { id : {$ne : "0"} }
    }).then();
}
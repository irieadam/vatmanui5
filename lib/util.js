var _ = require('underscore');

module.exports = {

getCookies: function (request) {
    var cookies = {};
    request.headers && request.headers.cookie.split(';').forEach(function (cookie) {
        var parts = cookie.match(/(.*?)=(.*)$/)
        cookies[parts[1].trim()] = (parts[2] || '').trim();
    });
    return cookies;
} ,

convertToCSV: function (objArray) {
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    var str = '';

    for (var i = 0; i < array.length; i++) {
        var line = '';
        for (var index in array[i]) {
            if (line != '') line += ';'

            line += array[i][index];
        }

        str += line + '\r\n';
    }
    return str;
},

doLogin : function (req,res,db) {

  var body = _.pick(req.body, 'email', 'password');
  var userInstance;

  db.user.authenticate(body).then(function (user) {
        var token = user.generateToken('authentication');
        userInstance = user;

        return db.token.create({
            token: token
        });
    }).then(function (tokenInstance) {
        var body = {};
        res.cookie('Auth', tokenInstance.token);
        res.cookie('sessionId', guid());
        res.status(200).send(body); //File(__dirname + '/view/ind.html');

    }).catch(function (e) {
        res.status(401).send();
    });

},

doLogout : function(req, res, db) {

    var sessionId = this.getCookies(req).sessionId;
    db.request.destroy({ where: { sessionId: sessionId } })

    res.cookie("Auth", "", { expires: new Date() });
    res.cookie("io", "", { expires: new Date() });
    res.cookie("lastRequest", "", { expires: new Date() });
    res.cookie("sessionId", "", { expires: new Date() })

    req.token.destroy().then(function () {
        //res.status(200).sendFile(__dirname + '/public/login.html');
        //res.redirect('/users/login');
        res.status(204).send();   
    }).catch(function () {
        res.status(500).send();
    });

}



};

var guid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}
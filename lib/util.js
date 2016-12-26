var _ = require('underscore');
var soap = require('soap');
var excel = require('node-xlsx').default;

module.exports = {

    getCookies: function (request) {
        var cookies = {};
        request.headers && request.headers.cookie.split(';').forEach(function (cookie) {
            var parts = cookie.match(/(.*?)=(.*)$/)
            cookies[parts[1].trim()] = (parts[2] || '').trim();
        });
        return cookies;
    },

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

    doLogin: function (req, res, db) {

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

    doLogout: function (req, res, db) {

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

    },

    doExport: function (req, res, db) {
        var sessionId = this.getCookies(req).sessionId;
        var lastRequest = this.getCookies(req).lastRequest;
        var format = req.body.format; //1 = csv ,0 = excel 
        var fileName = '';
        var arrayOfDbResults = [];

        db.request.findAll({
            attributes: { exclude: ['id', 'sessionId', 'requestId', 'itemId', 'createdAt', 'status', 'requestDate', 'userId'] },
            where: { requestId: lastRequest }
        })
            .then(function (requests) {
                var jsonObject;
                var file;
                requests.forEach(function (request) {
                    arrayOfDbResults.push(request);
                }
                );

                fileName = arrayOfDbResults[0].requesterCountryCode + arrayOfDbResults[0].requesterVatNumber + "_" + arrayOfDbResults[0].updatedAt.toISOString().slice(0, 10);;

                for (result in arrayOfDbResults) {
                    delete result.requesterCountryCode;
                    delete result.requesterVatNumber;
                }
                // send csv or excel
                switch (format) {
                    case 0: //xlsx
                        var headers = ["Country Code",
                            "VAT Number",
                            "Name",
                            "Address",
                            "Confirmation",
                            "RequestDate",
                            "Valid",
                            "Retries"];
                        var data = [headers];

                        // for each db result row, get values into array and add array to data array
                        arrayOfDbResults.forEach(function (item) {
                            var dataValues = item.dataValues;
                            var resultValues = [];
                            resultValues.push(dataValues.countryCode);
                            resultValues.push(dataValues.vatNumber);
                            resultValues.push(dataValues.traderName);
                            resultValues.push(dataValues.traderAddress);
                            resultValues.push(dataValues.confirmationNumber);
                            resultValues.push(dataValues.updatedAt);
                            resultValues.push(dataValues.valid);
                            resultValues.push(dataValues.retries);
                            data.push(resultValues);
                        });

                        var file = excel.build([{ name: "results", data: data }]);

                        res.status(200).set({
                            'Content-Type': 'application/vnd.ms-excel',
                            'Content-Transfer-Encoding': 'binary',
                            'Content-Disposition': "attachment; filename=" + "VATValidation_" + fileName + '.xlsx'
                        }).send(file);
                        break;

                    case 1 : //csv
                        jsonObject = JSON.stringify(arrayOfDbResults);
                        file = this.convertToCSV(jsonObject);

                        res.status(200).set({
                            'Content-Type': 'text/csv',//'text/plain',//application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
                            'Content-Disposition': "attachment; filename=" + fileName + '.csv'
                        }).send(file);
                        break;
                    default:

                }

            })
    },

    getSoapClient: function () {

        return new Promise(function (resolve, reject) {

            console.log("getting soap client");
            var vatServiceWSDLUrl = 'http://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl';
            soap.createClient(vatServiceWSDLUrl, function (err, client) {
                console.log('create client call back in');
                if (typeof client === 'undefined') {
                    console.log(err);
                    reject(err);

                } else {
                    console.log("got client");
                    resolve(client);
                }
            });

        });
    },

    callVatService: function (client, request, ws) {
        return new Promise(function (resolve, reject) {
            var checkVatApprox = {
                countryCode: request.countryCode,
                vatNumber: request.vatNumber.replace(/\r/g, ""),
                requesterCountryCode: request.requesterCountryCode,
                requesterVatNumber: request.requesterVatNumber.replace(/\r/g, "")
            };

            request.status = '1';

            //  console.log(">>>>>>>>>>>> REQUEST " + JSON.stringify(checkVatApprox)+ "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");

            client.checkVatApprox(checkVatApprox, function (err, result) {
                // console.log(JSON.stringify(result));
                if (typeof result != 'undefined' && result.valid) {

                    // address 
                    var address = "";
                    if (typeof result.traderAddress != 'undefined') {
                        address = result.traderAddress.replace(/\n/g, " ")
                    }

                    request.update({
                        status: '3',
                        traderName: result.traderName,
                        traderAddress: address,
                        confirmationNumber: result.requestIdentifier,
                        valid: "Valid",
                        requestDate: result.requestDate.toString()
                    });

                } else if (!err && !result.valid) {
                    request.update({
                        status: '5',
                        confirmationNumber: result.requestIdentifier,
                        valid: "Not Valid",
                    });
                } else {
                    request.update({
                        status: '4',
                        valid: "Failed",
                    });
                    console.log(JSON.stringify(result));
                };
                ws.send(JSON.stringify(request));
                resolve(request);
            });
        });
    }

}

var guid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}
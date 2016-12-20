var soap = require('soap');

module.exports = {
    getSoapClient : function (){

    return new Promise(function(resolve, reject) {
         
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

    } );
},

callVatService: function (client, request, ioId) {
    return new Promise(function(resolve, reject){
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
            // NOTIFY the client of the result with WS 
        //   /  io.to(ioId).emit('message', request);
            resolve();
        });
    });
}
}
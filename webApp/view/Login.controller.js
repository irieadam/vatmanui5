var that;
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("vatmanui5.webApp.view.Login", {

        onInit: function () {
            that = this;
        },
        login: function () {
            var userId = this.getView().byId("userId").getValue();
            var pw = this.getView().byId("pw").getValue();
            if (userId == "") {
                MessageToast.show("Please enter your user id");
                return false;
            } else if (pw == "") {
                MessageToast.show("Please enter your password");
                return false;
            } else {
                var cred = { email: userId, password: pw };
                this.doLogin(JSON.stringify(cred));
            }
        },

        doLogin: function (cred) {
            jQuery.ajax({
                type: "POST",
                contentType: "application/json",
                url: "/users/login",
                dataType: "json",
                data: cred,
                error: function () {
                    MessageToast.show("Authentication Failed");
                },
                success: function (data) {
                   var oModel  =  that.getView().getModel("vm");
                   var vm =  oModel.getData()
                   vm.loggedOut = false;
                   vm.isAdmin = data.isAdmin;
                   vm.requesterVatNumber = data.vatNumber ;
                   vm.requesterCountryCode =  data.countryCode;
                   oModel.refresh();
                   connection = new sap.ui.core.ws.WebSocket('/node/process');      
                   // router.getTargets().display("validation");
                   router.navTo("validation",true);
                }
            })
        }
    });
});


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
                success: function () {
                    router.getTargets().display("validation");
                }
            })
        }
    });
});


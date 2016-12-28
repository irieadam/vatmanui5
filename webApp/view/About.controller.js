
sap.ui.define([
    "sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History"
], function (Controller, History) {
    "use strict";

    return Controller.extend("vatmanui5.webApp.view.About", {

        onInit: function () {
     
        },

        onNavBack: function () {
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				oRouter.navTo("validation", true);
			}
		}
    });
});


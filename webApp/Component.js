var router;
sap.ui.define([
   "sap/ui/core/UIComponent",
   "sap/ui/model/json/JSONModel",
   "sap/ui/model/resource/ResourceModel"
], function (UIComponent, JSONModel, ResourceModel) {
   "use strict";
   return UIComponent.extend("vatmanui5.webApp.Component", {
      metadata : {
            //    rootView: "vatmanui5.webApp.view.Validation",
                manifest: "json"
       },
      init : function () {

          // call the init function of the parent
         UIComponent.prototype.init.apply(this, arguments);

            // create the views based on the url/hash
         this.getRouter().initialize();
         router =  this.getRouter();
      }
   });
});
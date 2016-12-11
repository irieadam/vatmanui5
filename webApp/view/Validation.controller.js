var that;
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
   "sap/m/MessageToast",
   "sap/ui/model/resource/ResourceModel"
], function (Controller, JSONModel, MessageToast,ResourceModel) {
    "use strict";

    return Controller.extend("webApp.view.Validation", {
    
        onInit: function () {
            // set data model on view
            that = this;
            var oData = {
                recipient: {
                    name: "World"
                }
            };
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel,"vm");

            // set i18n model on view
            var i18nModel = new ResourceModel({
                bundleName: "webApp.i18n.i18n"
            });
            this.getView().setModel(i18nModel, "i18n");
            
            // ws connection      			
            connection.attachOpen(function (oControlEvent) {
                 sap.m.MessageToast.show("connection opened");
      			}); 

            this.getView().addStyleClass("sapUiSizeCompact"); // make everything inside this View appear in Compact mode      

            // server messages
            connection.attachMessage(function (oControlEvent) {
               var oModel = that.getView().getModel("vm");
               // var vm = that.getView().getModel('vm').getData();

                var data = jQuery.parseJSON(oControlEvent.getParameter("data"));
                console.log("Data!!" + data.vatRequester);
                debugger;
                oModel.setData({recipient : {name : data.vatRequester}}, true); 
        
            });
    
            // error handling
            connection.attachError(function (oControlEvent) {
                sap.m.MessageToast.show("Websocket connection error" );
            }); 
    
            // onConnectionClose
            connection.attachClose(function (oControlEvent) {
                sap.m.MessageToast.show("Websocket connection closed");
            });    


            },



      onShowHello : function () {

                // send message
      		//	var oModel = sap.ui.getCore().getModel();
      		//	var result = oModel.getData();
       			var msg = "TEST MESSAGE";
       			if (msg.length > 0) {
        			connection.send(JSON.stringify(
         				{vatRequester : "NL67321678", vatNumbers : [{ country: "nl", vatNumber : "nmnmklkl" }]}
        			));
        	   // oModel.setData({message: ""}, true);
       			}     
      

         // read msg from i18n model
//         var oBundle = this.getView().getModel("i18n").getResourceBundle();
//         var sRecipient = this.getView().getModel().getProperty("/recipient/name");
//         var sMsg = oBundle.getText("helloMsg", [sRecipient]);
         // show message
 //        MessageToast.show(sMsg);
      }
    });
});

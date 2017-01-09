var that;
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "sap/ui/model/resource/ResourceModel",
   	"sap/ui/core/routing/History"
], function (Controller, JSONModel, Filter, MessageToast, ResourceModel,History) {
    "use strict";

    return Controller.extend("vatmanui5.webApp.view.Validation", {
        
        onInit: function () {
            that = this;
            
            // events for file drop
            this.getView().byId("__page0").attachBrowserEvent("dragenter", dragenter, false);
            this.getView().byId("__page0").attachBrowserEvent("dragover", dragover, false);
            this.getView().byId("__page0").attachBrowserEvent("drop", drop, false);

            // ws connection    
            getWSConnection();
            keepAlive();
            
            // server messages
            connection.attachMessage(function (oControlEvent) {
                var oModel = that.getView().getModel("vm");
                var requests = oModel.getData().vatNumbers;
                var data = jQuery.parseJSON(oControlEvent.getParameter("data"));
              
            //    console.log("Data!!" + JSON.stringify(data));

               // TODO check this loop for use of filter, and the oModel should be vm.
                if(typeof data.itemId !== 'undefined') {

                    for (var i=0; i<requests.length; i++) {

                        if (requests[i].itemId === data.itemId) {
                            requests[i].traderName = data.traderName;
                            requests[i].traderAddress = data.traderAddress;
                            requests[i].confirmation = data.confirmationNumber;
                            requests[i].requestTime = data.updatedAt.toString().substring(0,10);
                            requests[i].valid = data.valid;
                            requests[i].status = data.status;
                            requests[i].retries = data.retries;
                            if (data.status === "3") {
                                requests[i].editable = false;
                            } 
                            oModel.getData().processedCount++;
                            break;
                        }
                    }
                } else {
                    sap.m.MessageToast.show('Processing completed');
                    oModel.getData().exportIsAllowed = true;
                    oModel.getData().validateIsAllowed = true;
                    oModel.getData().fileProcessIsAllowed = true;
                } 

                oModel.getData().validCount = requests.filter(function(value) { return value.status === "3" }).length;
                oModel.getData().notValidCount = requests.filter(function(value) { return value.status === "5" }).length;
                oModel.getData().failedCount = requests.filter(function(value) { return value.status === "4" }).length;
                oModel.refresh(true);            

            });

            // error handling
            connection.attachError(function (oControlEvent) {
                sap.m.MessageToast.show("Server connection error");
            });

            // onConnectionClose
            connection.attachClose(function (oControlEvent) {
                sap.m.MessageToast.show("Connection to server closed");
                if (!that.getView().getModel("vm").getData().loggedOut) {
                    getWSConnection();
                }
            });


        },

        onProcess: function(evt) {
            if(typeof connection === 'undefined' || connection.getReadyState() !== 1 ) {
                getWSConnection();
            }
            var oModel = that.getView().getModel("vm");
            var vm = oModel.getData();
            vm.processedCount = vm.vatNumbers.filter(function(value) { return value.status === "3" }).length;

            if (!vm.fileSelected || vm.requesterCountryCode.length===0 || vm.requesterVatNumber.length===0) {
            var messages = ["Please provide: "];

            if (!vm.fileSelected ) {
                messages.push("vat numbers to process ");
            };
            if (vm.requesterCountryCode.length === 0 || vm.requesterVatNumber.length === 0) {
                that.getView().byId('requestCC').setValueState(sap.ui.core.ValueState.Error);
                that.getView().byId('requestV').setValueState(sap.ui.core.ValueState.Error);
                messages.push(" your vat number");
            };
    
            sap.m.MessageToast.show(messages.toString().replace(","," ")) ;

            } else {


                var batch = {
                    "requestId" : that.guid(),
                    "requesterCountryCode" : vm.requesterCountryCode,
                    "requesterVatNumber" : vm.requesterVatNumber,
                    "vatNumbers" : vm.vatNumbers
                }

                var client = new XMLHttpRequest();
                client.open('POST', '/process', true);
                client.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
                client.onreadystatechange = function () { 
                    if (client.readyState == 4 && client.status == 401) {
                    sap.m.MessageToast.show("Unauthorized");
                    } else if (client.readyState == 4 && client.status == 200) {
                         vm.validateIsAllowed = false;
                         vm.exportIsAllowed = false;
                         vm.fileProcessIsAllowed = false;
                        // alert('Submitted');
                    }
                }
                client.send(JSON.stringify(batch));
            }

        },

        onExport: function(evt) {
       //   var msg = {format : that.getView().byId("formatSelection").getSelectedIndex()};
         var format = that.getView().byId("formatSelection").getSelectedIndex();
            window.open('/export?format='+format);
        },

        onShowHello: function () {

            var msg = "TEST MESSAGE";
            if (msg.length > 0) {
                connection.send(JSON.stringify(
                    { vatRequester: "NL67321678", vatNumbers: [{ country: "nl", vatNumber: "nmnmklkl" }] }
                ));
                // oModel.setData({message: ""}, true);
            }


            // read msg from i18n model
            //         var oBundle = this.getView().getModel("i18n").getResourceBundle();
            //         var sRecipient = this.getView().getModel().getProperty("/recipient/name");
            //         var sMsg = oBundle.getText("helloMsg", [sRecipient]);
            // show message
            //        MessageToast.show(sMsg);
        },

        onMenuAction: function(oEvent) {
            var oItem = oEvent.getParameter("item"),
                sItemPath = "";
            switch (oItem.getText()) {
                case "Logout" : 
                    that.doLogout();
                    break;
                case "About" : 
                 router.navTo("about",true);
                    break;    
            }
        },

        doLogout: function () {
            that.getView().getModel("vm").getData().loggedOut = true;
            jQuery.ajax({
                type: "DELETE",
                contentType: "application/json",
                url: "/logout",
                success: function () {
                   
                    initModel();
                    router.navTo("login");
                }
            })
        },

        handleIconTabBarSelect: function (oEvent) {
            var oBinding = that.getView().byId("requestsTable").getBinding("rows"),
				sKey = oEvent.getParameter("key"),
				oFilter;
			if (sKey === "valid") {
				oFilter = new Filter("status", "EQ", "3");
				oBinding.filter([oFilter]);
			} else if (sKey === "notValid") {
				oFilter = new Filter("status", "EQ", "5");
				oBinding.filter([oFilter]);
			} else if (sKey === "failed") {
				oFilter = new Filter("status", "EQ", "4");
				oBinding.filter([oFilter]);
			} else {
				oBinding.filter([]);
			}
        },

        clear : function (evt) {
            var oModel = that.getView().getModel("vm");
            var vm = oModel.getData();
            vm.validateIsAllowed = false;
            vm.exportIsAllowed = false; 
            vm.fileSelected = false ; 
            vm.validCount = 0;
            vm.notValidCount = 0;
            vm.failedCount = 0;
            vm.processedCount = 0;
            vm.vatNumbers = [];
            that.getView().byId("fileUploader").clear();
            oModel.refresh(true);

        },

        validateText : function (evt) {
            var src =  evt.getSource()
             var value = src.getValue();

            if (value.trim().length === 0) {
                src.setValueState(sap.ui.core.ValueState.Error);
            } else {
                src.setValueState(sap.ui.core.ValueState.None);
            };
        },

        upload: function (evt) {
            if (!this.browserSupportFileUpload()) {
                alert('The File APIs are not fully supported in this browser!');
            } else {
                this.handleFiles(evt.getParameter("files"));
            }
        },

        handleFiles: function (files) {
            var oModel = that.getView().getModel("vm");
            var vm = oModel.getData();
            var data = null;
            var file = files[0];
            var reader = new FileReader();
            var fileType = "";
            var fileName = file.name;
            var csvData;

            if (fileType === "text/csv" || fileName.substring(fileName.length, fileName.length - 3) === 'csv') {
                fileType = 'csv';
            } else { // if (fileType === "application/vnd.ms-excel" || fileType ===  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                fileType = 'xlsx';
            }

            if (fileType === 'csv') {
                reader.readAsText(file);
            } else if (fileType === 'xlsx') {
                reader.readAsBinaryString(file);
            }

            reader.onload = function (event) {

                if (fileType === 'csv') {
                    csvData = event.target.result;

                } else if (fileType === "xlsx") {
                    var data = event.target.result;
                    var cfb = XLSX.read(data, { type: 'binary' });
                    var sheetName = cfb.SheetNames[0];
                    csvData = XLS.utils.make_csv(cfb.Sheets[sheetName]);
                }

                // format input
                var csvTextArray = csvData.split('\n');
                var arrayOfObjects = csvTextArray.map(function (e, i) {

                    var countryCode = e.split(';')[0];
                    var vatNumber = e.split(';')[1];

                    // deal with commas
                    if (typeof vatNumber == 'undefined' || typeof countryCode == 'undefined') {
                        countryCode = e.split(',')[0];
                        vatNumber = e.split(',')[1];
                    };

                    //split if provided in same field
                    if (typeof vatNumber == 'undefined' && typeof countryCode != 'undefined' && countryCode.length > 0) {
                        vatNumber = countryCode.substring(2, countryCode.length);
                        countryCode = countryCode.substring(0, 2);
                    };

                    // remove spaces
                    if (typeof vatNumber != 'undefined' && typeof countryCode != 'undefined') {
                        countryCode = countryCode.replace(/ /g, "");
                        vatNumber = vatNumber.replace(/ /g, "");
                    };

                    //remove line breaks
                    if (typeof vatNumber != 'undefined' && typeof countryCode != 'undefined') {
                        countryCode = countryCode.replace(/\r/g, ""),
                            vatNumber = vatNumber.replace(/\r/g, "")
                    };


                    return {
                        itemId: that.guid(),
                        countryCode: countryCode,
                        vatNumber: vatNumber,
                        traderName: '',
                        traderAddress: '',
                        confirmation: '',
                        requestTime: '',
                        valid: '',
                        status: '1',
                        retries: 0,
                        editable: true
                    };

                });


                var nonEmptyValues = arrayOfObjects.filter(function (i) { return i.countryCode.length > 0 });

                vm.vatNumbers = nonEmptyValues;
                vm.fileSelected = true;
                vm.validateIsAllowed = true;
                oModel.refresh(true);
    
            };
            reader.onerror = function () {
                alert('Unable to read ' + file.fileName);
            };

        },

        browserSupportFileUpload: function () {
            var isCompatible = false;
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                isCompatible = true;
            }
            return isCompatible;
        },

        guid: function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        }

    });
});

function dragenter(e) {
  e.stopPropagation();
  e.preventDefault();
}

function dragover(e) {
  e.stopPropagation();
  e.preventDefault();
}

function drop(e) {

  e.stopPropagation();
  e.preventDefault();
  var dt = e.originalEvent.dataTransfer;
  var files = dt.files;

  that.handleFiles(files);
}

function getWSConnection () {
    if (typeof connection === 'undefined' || connection.getReadyState() !== 1) {   			
        connection = new sap.ui.core.ws.WebSocket('/node/process'); 
        connection.attachOpen(function (oControlEvent) {
        });  
    }
} 

function initModel() {
 that.getView().byId("fileUploader").clear();
 that.getView().getModel("vm").loadData('/model/init.json'); 
}

function keepAlive() {
    setInterval(function() {
        if (connection.getReadyState() === 1) {
           var ping = { ping: "pong"};
           connection.send('ping');
        }
    }, 30000);
}
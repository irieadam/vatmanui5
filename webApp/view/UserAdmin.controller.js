
sap.ui.define([
    "sap/ui/core/mvc/Controller",
   "sap/ui/model/json/JSONModel", 
   	"sap/ui/core/routing/History",
	"sap/m/MessageToast"
], function (Controller, JSONModel, History,MessageToast) {
    "use strict";

    return Controller.extend("vatmanui5.webApp.view.UserAdmin", {

        onInit: function () {
			var that = this;
			getUsers();
        },

		createUserPopover: function (oEvent) {
 
			// create popover
			if (! this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("vatmanui5.webApp.view.CreateUser", this);
				this.getView().addDependent(this._oPopover);
				
			}
 
			// delay because addDependent will do a async rerendering and the actionSheet will immediately close without it.
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.openBy(oButton);
			});
		},

		createUser: function (oEvent) {
			var newUser = this.getView().getModel("um").getData().newUser;
			newUser.isAdmin = false;
			jQuery.ajax({
			type: "POST",
			contentType: "application/json",
			url: "/users",
			dataType: "json",
			data : JSON.stringify(newUser),
			error: function () {
				MessageToast.show("Error creating user");
			},
			success: function (data) {
				sap.ui.getCore().byId('createUserPopover').close();
				var oModel = that.getView().getModel("um");
				oModel.getData().newUser = {};
				oModel.refresh();
				getUsers();
			}
	})
		},

		deleteUser : function (oEvent) {
            var oTable = this.byId("usersTable");
            var aIndices = oTable.getSelectedIndices();
            var oModel = that.getView().getModel("um")
            var oData = oModel.getData().userList;
            var oRow, oRowData, oRemoved;
            if (aIndices.length > 0) {
				if (aIndices.length > 0) {
			// get the selected row data from the (json) model
						for (var j in aIndices) {
								oRow = oTable.getRows()[j];
								oRowData = oRow.getBindingContext("um").getObject();
								deleteUser(oRowData.id);
						}
				}
			}

		},

		processSingle: function (oEvent) {
		  var userModel = this.getView().getModel("um");
		  var um = userModel.getData().newUser;
		  var vm = this.getView().getModel("vm").getData();
		  var request = {
			"countryCode" : um.countryCode,
			"vatNumber" : um.vatNumber,
			"requesterVatNumber" : vm.requesterVatNumber,
			"requesterCountryCode" : vm.requesterCountryCode
			};
		  jQuery.ajax({
			type: "POST",
			contentType: "application/json",
			url: "/validate",
			dataType: "json",
			data : JSON.stringify(request),
			error: function (err) {
				MessageToast.show(err);
			},
			success: function (data) {
				if (data.valid) {
				um.address = data.traderAddress;
				um.valid = data.valid;
				um.name = data.traderName;
		  		userModel.refresh();
				} else {
					MessageToast.show("Vat number is not valid");
				}
			}
		 })
			
		},

        onNavBack: function () {
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();
				var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

			if (sPreviousHash !== undefined) {
			 	window.history.go(-1);
			} else {
				oRouter.navTo("validation", true);
			}
		}
    });
});

function getUsers () {
		jQuery.ajax({
		type: "GET",
		contentType: "application/json",
		url: "/users",
		dataType: "json",
		error: function () {
			MessageToast.show("Error getting users");
		},
		success: function (data) {
			var oModel = that.getView().getModel("um");
			var um =  oModel.getData()
			um.userList = data.userList;
			oModel.refresh();
		}
	})
}

function deleteUser(id) {
	jQuery.ajax({
		type: "DELETE",
		contentType: "text",
		url: "/users/"+id,
		error: function () {
		//	that.MessageToast.show("Error deleting users");
		},
		success: function (data) {
			getUsers();
		}
	})
}
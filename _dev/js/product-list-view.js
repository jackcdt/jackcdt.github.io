(function($) {
	window.CDT = jQuery.extend(window.CDT || {}, {
		list_participants: {
			setupQuantity: function(product) {
				var capture_area = product.find(".capture-details");

				capture_area.prepend('Number of Participants<br/><input type="text" class="productTextInput quantity-field number-of-participants" value="1" /><br/>Participant Names<br/>');
				capture_area.after('<li class="price"><a class="pointer validate-participants"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">BOOK NOW &gt;</a></li>');
			},
			controlFields: function(product) {
				var capture_area = product.find(".capture-details"),
					quantity = Number(capture_area.find(".number-of-participants").val()),
					currentParticipants = new Array();

				if (quantity <= 0 || isNaN(quantity)) {
					quantity = 1;
				}
				capture_area.find(".participant").each(function() {
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();

					currentParticipants.push({
						name: (name != "Name (Required)") ? name : "",
						email: (email != "Email") ? email : ""
					});
				});
				capture_area.find(".participant").remove();
				for (var i = 0; i < quantity; i++) {
					var participant = currentParticipants[i],
						name = "",
						email = "";

					if (participant != null) {
						name = participant.name;
						email = participant.email;
					}

					capture_area.append(
						'<div class="participant cf">\
							<input type="text" class="name" value="' + ((name != "") ? name : "Name (Required)") + '" onblur="if(this.value == \'\'){this.value = \'Name (Required)\';}" onfocus="if(this.value == \'Name (Required)\'){this.value = \'\';}"/>\
							<input type="text" class="email" value="' + ((email != "") ? email : "Email (Optional)") + '"onblur="if(this.value == \'\'){this.value = \'Email (Optional)\';}" onfocus="if(this.value == \'Email (Optional)\'){this.value = \'\';}"/>\
						</div>'
					);
				}
			},
			validateFields: function() {
				var capture_area = jQuery(".capture-details"),
					valid = true;

				capture_area.find(".participant input.name").each(function() {
					var thisValue = jQuery(this).val();

					if (thisValue == "" || thisValue == "Name (Required)") {
						valid = false;
						return false;
					}
				});

				return valid;
			},
			concatenateFields: function() {
				var capture_details = jQuery(".capture-details"),
					concatString = "";

				capture_details.find(".participant").each(function() {
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();

					concatString = concatString + ((concatString != "") ? ", " : "") + name + ((email != "" && email != "Email (Optional)") ? " (" + email + ")" : "");
				});

				return (concatString + ".");
			},
			init: function() {
				jQuery("[data-applyMultipleParticipants]").each(function() {
					var product = jQuery(this);

					product.find(".product-quantity").hide();
					CDT.list_participants.setupQuantity(product);
					CDT.list_participants.controlFields(product);
					product.find(".number-of-participants").on("change", function() {
						CDT.list_participants.controlFields(product);
					});
					product.find(".validate-participants").on("click", function(e) {
						e.preventDefault();
						e.stopPropagation();

						var numParticipants = Number(product.find(".number-of-participants").val());

						if (numParticipants > 0) {
							var valid = CDT.list_participants.validateFields(product);
							if (valid) {
								product.find(".capture-details-input").val(CDT.list_participants.concatenateFields(product));
								product.find("input[name=AddToCart_Amount]").val(numParticipants);
								product.find(".product-quantity img").click();
							} else {
								alert("- Please ensure that a name has been entered for each participant");
							}
						} else {
							alert("- Please enter Number of Participants");
						}
					});
				});
			}
		}
	});
})(jQuery);

jQuery(function() {
	CDT.list_participants.init();

	jQuery("body").on("change", "select[name=AddToCart_Grouping]", function() {
		CDT.list_participants.init();
	});
});

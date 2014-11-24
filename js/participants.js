(function($) {
    window.CDT = jQuery.extend(window.CDT || {}, {
        participants: {
			setupQuantity: function(){
				var container = jQuery("#Capture-Details");
				
				container.prepend('Number of Participants<br/><input type="text" id="Number-Of-Participants" class="productTextInput quantity-field" value="1" />');
				container.after('<li class="price"><a id="Validate-Participants" class="pointer"><img src="/images-dist/shopping-cart/book-now.png"></a></li>');
			},
			controlFields: function(){
				var container = jQuery("#Capture-Details"),
					quantity = Number(container.find("#Number-Of-Participants").val()),
					currentParticipants = new Array();
				
				if(quantity <= 0 || isNaN(quantity)){quantity = 1;	}
				
				// Store Currently Entered Participants
				container.find(".participant").each(function(){
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();
						
					currentParticipants.push({
						name: (name != "Name (Required)") ? name : "",
						email: (email != "Email") ? email : ""
					});
				});
				
				// Remove existing fields
				container.find(".participant").remove();
				
				// Setup new fields
				for(var i = 0;i < quantity;i++){
					var participant = currentParticipants[i],
						name = "",
						email = "";
					
					if(participant != null){
						name = participant.name;
						email = participant.email;
					}
					
					container.append(
						'<div class="participant cf">\
							<input type="text" class="name" value="' + ((name != "") ? name : "Name (Required)") + '" onblur="if(this.value == \'\'){this.value = \'Name (Required)\';}" onfocus="if(this.value == \'Name (Required)\'){this.value = \'\';}"/>\
							<input type="text" class="email" value="' + ((email != "") ? email : "Email (Optional)") + '"onblur="if(this.value == \'\'){this.value = \'Email (Optional)\';}" onfocus="if(this.value == \'Email (Optional)\'){this.value = \'\';}"/>\
						</div>'
					);
				}
			},
			validateFields: function(){
				var container = jQuery("#Capture-Details"),
					valid = true;
					
				container.find(".participant input.name").each(function(){
					var thisValue = jQuery(this).val();
					
					if(thisValue == "" || thisValue == "Name (Required)"){
						valid = false;
						return false;
					}
				});
					
				return valid;
			},
			concatenateFields: function(){
				var container = jQuery("#Capture-Details"),
					concatString = "";
				
				container.find(".participant").each(function(){
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();
						
					concatString = concatString + ((concatString != "") ? ", " : "") + name + ((email != "" && email != "Email (Optional)") ? " (" + email + ")" : "");
				});
				
				return (concatString + ".");
			},
			init: function(){
				var container = jQuery("#Capture-Details");
				if(container.find("textarea").length > 0){
					container.find("textarea").hide();
					jQuery("#Product-Quantity").hide();
					CDT.participants.setupQuantity();
					CDT.participants.controlFields();
					
					container.find("#Number-Of-Participants").on("change",function(){
						CDT.participants.controlFields();
					});
					jQuery("#Validate-Participants").on("click",function(e){
						e.preventDefault();
						e.stopPropagation();
						
						var numParticipants = Number(container.find("#Number-Of-Participants").val());
						
						if(numParticipants > 0){
							var valid = CDT.participants.validateFields();
						
							if(valid){
								container.find("textarea").val(CDT.participants.concatenateFields());
								jQuery("#Product-Quantity").find("input[name=AddToCart_Amount]").val(numParticipants);
								jQuery("#Product-Quantity").find("img").click();
							}
							else{
								alert("- Please ensure that a name has been entered for each participant");
							}
						}
						else{
							alert("- Please enter Number of Participants");
						}
					});
				}
			}
        }
    });
})(jQuery);

jQuery(function(){
	CDT.participants.init();
});
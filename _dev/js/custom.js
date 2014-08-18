$(function(){
	// Landing page courses home-accordion: manage "+"/"-"
	function toggleGlyphicon(e) {
		$(e.target)
			.prev('.panel-heading')
			.find("i.indicator")
			.toggleClass('glyphicon-plus glyphicon-minus');
	}
	
	$('#accordion').on('hidden.bs.collapse', toggleGlyphicon);
	$('#accordion').on('shown.bs.collapse', toggleGlyphicon);
	
	// Landing page banner carousel - loop through all slides twice, then pause the carousel
	function manageCarouselMovement() {
		++manageCarouselMovement.count;
		
		if (manageCarouselMovement.count == 14){
			$('#myCarousel').carousel('pause');
		}
	}
	manageCarouselMovement.count = 0;

	$('#myCarousel').on('slid.bs.carousel', manageCarouselMovement);
});
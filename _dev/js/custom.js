function toggleGlyphicon(e) {
	$(e.target)
		.prev('.panel-heading')
		.find("i.indicator")
		.toggleClass('glyphicon-plus glyphicon-minus');
}

$('#accordion').on('hidden.bs.collapse', toggleGlyphicon);
$('#accordion').on('shown.bs.collapse', toggleGlyphicon);

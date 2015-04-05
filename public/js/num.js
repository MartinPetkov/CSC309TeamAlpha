$(document).on('change', '#star_rating', function () {
    $('#temp').hide();
    $('#star_rating').after('<span class="rating" id="temp">rating submitted!</span>');
});

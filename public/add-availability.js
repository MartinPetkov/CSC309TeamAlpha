$(function(){
        $("#submit-availability").click(function(){
        $('#temp').hide();
        $(".error").hide();
        var hasError = false;
        var spaceVal = $('#spaceId').prop('checked');;
        var fromVal = $("#datepicker-13").datepicker("getDate");
        var toVal = $("#datepicker-14").datepicker("getDate");
            
            
        if (spaceVal == false) {
            $('#spaceId').before('<span id="temp" class="glyphicon glyphicon-remove" style="color:red"/><span class="error" style="color:red">Please enter an email.</span>');
            hasError = true;
        }
        else if (fromVal == null) {
            $('#datepicker-13').after('<span class="error" style="color:red">Please enter a from date.</span>');
            hasError = true;
        } else if (toVal == null) {
            $("#datepicker-14").after('<span class="error" style="color:red">Please enter a to date.</span>');
            hasError = true;
        }
        if(hasError == true) {return false;}
    });
});
$(function(){
        $("#submit-availability").click(function(){
        $('#temp').hide();
        $(".error").hide();
        var hasError = false;
        //var spaceVal = $('#spaceId').prop('checked');
        var radios = document.getElementsByTagName('spaceId');
        var fromVal = $("#datepicker-13").datepicker("getDate");
        var toVal = $("#datepicker-14").datepicker("getDate");
            
            
        /*if (spaceVal == false) {
            $('#spaceId').before('<span id="temp" class="glyphicon glyphicon-remove" style="color:red"/><span class="error" style="color:red">Please select a space ID</span>');
            hasError = true;
        }*/
            
        var value;
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].type === 'radio' && radios[i].checked) {
                value = radios[i].value;
            }
        }
        if (value == "") {
            $('#spaceId').before('<span id="temp" class="glyphicon glyphicon-remove" style="color:red"/><span class="error" style="color:red">Please select a space ID</span>');
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
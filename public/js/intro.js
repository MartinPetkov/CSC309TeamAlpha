$(function(){
        $("#submit-login").click(function(){
        $('#temp').hide();
        $(".error").hide();
        var hasError = false;
        var emailVal = $('#email').val();
        var passVal = $('#password').val();
            
        if (emailVal == '') {
            $('#email').after('<span class="error" style="color:red"> Please enter your email </span>');
            hasError = true;
        }
        else if (passVal == '') {
            $('#password').after('<span class="error" style="color:red"> Please enter your password </span>');
            hasError = true;
        } 
        if(hasError == true) {return false;}
    });
});
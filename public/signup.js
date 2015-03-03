$(function(){
        $("#create-acc").click(function(){
        $('#temp').hide();
        $(".error").hide();
        var hasError = false;
        var emailVal = $('#email').val();
        var passwordVal = $("#password").val();
        var checkVal = $("#password-check").val();
        if (emailVal == '') {
            $('#email').after('<span id="temp" class="glyphicon glyphicon-remove" style="color:red"/><span class="error" style="color:red">Please enter an email.</span>');
            hasError = true;
        }
        else if (passwordVal == '') {
            $('#password').after('<span class="error" style="color:red">Please enter a password.</span>');
            hasError = true;
        } else if (checkVal == '') {
            $("#password-check").after('<span class="error" style="color:red">Please re-enter your password.</span>');
            hasError = true;
        } else if (passwordVal != checkVal ) {
            $("#password-check").after('<span class="error" style="color:red">Passwords do not match.</span>');
            hasError = true;
        }
        if(hasError == true) {return false;}
    });
});
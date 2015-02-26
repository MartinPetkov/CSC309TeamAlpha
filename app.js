var express = require('express');
/*var path = require('path');
//var favicon = require('serve-favicon');
//var logger = require('morgan');
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
*/
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended:true
	}));

app.get('/', function(req, res){
	res.sendFile('./intro.html',{root:__dirname});
	console.log('Page Loaded');
});

app.get('/signup.html', function(req, res){
	res.sendFile('./signup.html',{root:__dirname});
	
});

//Log in Post
app.post('/login', function(req, res){
  var userEmail = req.body.email;
  var userPass = req.body.password;
  res.send('Username ' + userEmail + '\n password '+ userPass);
  console.log('login: ' + userEmail + ' from IP ' + req.connection.remoteAddress);
});	

//New User Creation Post
app.post('/newUser', function(req, res){
	var newEmail = req.body.email;
	var newPass0 = req.body.pw;
	var newPass1 = req.body.retype_pw;
	if (req.body.signup_type=="Leasing my own space"){
		var newUserType = "Owner"
	}else{
		var newUserType = "Tenant"
	}
	
	var checkPass = newPass0 == newPass1;
	
	if (checkPass){
		res.send('Passwords Matched, new user is a(n)' + newUserType);
		//Create the new user
	}else{
		res.send('Passwords do not match');
		//Do not create the new user
	}

});



app.listen(3000);

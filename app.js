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
var cookieParser = require('cookie-parser');
var session = require('express-session');
var pg = require('pg');
var app = express();
var morgan = require('morgan');


var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";

app.use(bodyParser.json());
app.use(cookieParser());

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(express.static(__dirname + '/public'));

app.use(session({secret: '123', resave: 'false', saveUninitialized: 'false'}));

app.use(morgan('dev'));
//app.use(bodyParser());

app.set('views', __dirname + '/public/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


app.get('/dbtest', function (req, res) {

	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err, done) {
        if(err) {
            return console.error('could not connect to postgres', err);
	        res.send('sorry, there was an error', err);
        }
        //client.query("INSERT into \"Users\" values (3, 'b', 'c', 'd', 4, 'aboutsuff', 'interests')");    
  	
	     var query = client.query('select * from \"User\"');
	
	     query.on('row', function(row){
             result.push(row);
	     });
        
	     query.on('end', function(){
             client.end();
            res.json(result);
	     });
    });
});

app.get('/HTML', function(req, res){
	res.sendFile('./first.html',{root:__dirname});
});

app.get('/', function(req, res){
	res.sendFile('./intro.html',{root:__dirname});
	console.log('Page Loaded!');
	if (req.session.user){
		console.log('current session: '+req.session.user);
	}
});

app.get('/signup.html', function(req, res){
	res.sendFile('./public/views/signup.html',{root:__dirname});
	
});

app.get('/postings.html', function(req, res){
	res.sendFile('./public/views/postings.html',{root:__dirname});
    	console.log("Postings page loaded");
});


//Log in Post
app.post('/postings.html', function(req, res){
	var userEmail = req.body.email;
	var userPass = req.body.password;
    
    var passFound = false;
	//res.send('Username ' + userEmail + '\n password '+ userPass);
	console.log('login: ' + userEmail + ' from IP ' + req.connection.remoteAddress);
	var client = new pg.Client(conString);
	var dbPass = [];
	
	client.connect(function(err, done) {
	if(err) {
		return console.error('could not connect to postgres', err);
		res.send('sorry, there was an error', err);
	}
	console.log('Connected to db User: ' + userEmail);
	
	var query = client.query('SELECT "Password"	FROM "User" WHERE "Email"=$1', [userEmail]);
	
	query.on('error', function(err){
		res.send('Query Error '+err);
	});
	query.on('row', function(row){
		dbPass.push(row.Password);
		passFound = true;
		console.log('a user with that email was found ' + dbPass[0]);
	});
	query.on('end', function(){
		client.end();
		console.log('client ended');
		if (passFound == false){
			res.send('There was no user with that email');
		}else if (dbPass[0] == userPass){
			//Login Success!
			
			req.session.user = userEmail;	
			console.log('session log for user '+req.session.user);
			
            res.render('postings.html', {username: userEmail, password:userPass});
			//res.send('success');
		}else if (dbPass[0]!=userPass){
			res.send('there was an error in log in ' + dbPass[0] + ' != ' + userPass);
		}
	});
	
	});
  
  //res.send('Username ' + userEmail + '\n password '+ userPass);
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
		//res.send('Passwords Matched, new user is a(n)' + newUserType);
		//Create the new user
		var client = new pg.Client(conString);
		client.connect(function(err, done) {
		if(err) {
			return console.error('could not connect to postgres', err);
			res.send('sorry, there was an error', err);
		}
	
		var query = client.query("INSERT INTO \"User\" VALUES (DEFAULT, $1,$2,'placeHolder', 0, 'placeHolder', 'placeHolder')", [newEmail, newPass0]);
	
		query.on('error', function(err){
			res.send('Query Error '+err);
		});
		query.on('end', function(){
			client.end();
			req.session.user = newEmail;
			res.render('postings.html', {username: newEmail, password: newPass0});
		});
		});
	}else{
		res.send('Passwords do not match');
		//Do not create the new user
	}

});



app.listen(3000);

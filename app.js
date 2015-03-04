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
	res.sendFile('./public/intro.html',{root:__dirname});
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

// Database interaction endpoints, add future functions here
/* User */
// Create new user
app.post('/addUser', function (req, res) {
    var values = [];
    values.push(req.body.firstName);
    values.push(req.body.lastName);
    values.push(req.body.email);
    values.push(req.body.password);
    values.push(req.body.homeLocation);
    values.push(req.body.reputation);
    values.push(req.body.about);
    values.push(req.body.projectInterests);
    // No photo yet, don't wanna deal with that

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "User"("FirstName", "LastName", "Email", "Password", "HomeLocation", "Reputation", "About", "ProjectInterests") VALUES(' + params + ') RETURNING "UserId"';

    var insertSuccessMessage = 'Successfully inserted user';
    var insertFailedMessage = 'Failed to insert user';
    executeQuery(res, insertSuccessMessage, insertFailedMessage, insertQuery, values);
});

// Update user info
app.post('/updateUserInfo', function (req, res) {
	var userEmail = req.body.email;
	var valuesObj = {
    	'FirstName': req.body.firstName,
    	'LastName': req.body.lastName,
    	'Email': userEmail,
    	'Password': req.body.password,
    	'HomeLocation': req.body.homeLocation,
    	'Reputation': req.body.reputation,
    	'About': req.body.about,
    	'ProjectInterests': req.body.projectInterests
	};
    // No photo yet, don't wanna deal with that

    var updateColumns = [];
    var values = [];
    var i = 1;
    for(var property in valuesObj) {
    	if((valuesObj.hasOwnProperty(property))
    		&& (typeof valuesObj[property] != 'undefined')) {

    		updateColumns.push('"' + property + '" = $' + i);
    		values.push(valuesObj[property]);
    		i++;
    	}
    }
    values.push(userEmail);

    var updateQuery = 'UPDATE "User" SET ' + updateColumns.join(', ') + ' WHERE "Email"=$' + (updateColumns.length + 1);

    var updateSuccessMessage = 'Successfully updated info for user';
    var updateFailedMessage = 'Failed to update info for user';
    executeQuery(res, updateSuccessMessage, updateFailedMessage, updateQuery, values);
});

// Get all users
app.get('/getAllUsers', function (req, res) {
    var getQuery = 'SELECT * FROM "User"';

    var getSuccessMessage = 'Successfully retrieved all user info';
    var getFailedMessage = 'Could not retrieve all user info';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery);
});

// Get user info
app.get('/getUserInfo', function (req, res) {
    var values = [];
    values.push(req.get('userId'));

    var getQuery = 'SELECT * FROM "User" WHERE "UserId" = $1';

    var getSuccessMessage = 'Successfully retrieved user info';
    var getFailedMessage = 'Could not retrieve user info';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery, values);
});

// Delete user
app.post('/deleteUser', function (req, res) {
    var values = [];
    values.push(req.body.userId);

    var deleteQuery = 'DELETE FROM "User" WHERE "UserId" = $1';

    var deleteSuccessMessage = 'Successfully deleted user';
    var deleteFailedMessage = 'Could not delete user';
    executeQuery(res, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});


/* Space */
// Create new space
app.post('/addSpace', function (req, res) {
    var values = [];
    values.push(req.body.ownerId);
    values.push(req.body.location);
    values.push(req.body.description)
    values.push(req.body.spaceType);
    values.push(req.body.area);
    values.push(req.body.rooms);
    values.push(req.body.pricePerDay);
    values.push(req.body.vacancyAmount);

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "Space"("OwnerId", "Location", "Description", "SpaceType", "Area", "Rooms", "PricePerDay", "VacancyAmount") VALUES(' + params + ') RETURNING "SpaceId"';

    var insertSuccessMessage = 'Successfully inserted space';
    var insertFailedMessage = 'Failed to insert space';
    executeQuery(res, insertSuccessMessage, insertFailedMessage, insertQuery, values);
});

// Update space
app.post('/updateSpaceInfo', function (req, res) {
	var spaceId = req.body.spaceId;
	var valuesObj = {
    	'OwnerId': req.body.ownerId,
    	'Location': req.body.location,
    	'Description': req.body.description,
    	'SpaceType': req.body.spaceType,
    	'Area': req.body.area,
    	'Rooms': req.body.rooms,
    	'PricePerDay': req.body.pricePerDay,
    	'VacancyAmount': req.body.vacancyAmount
	};

    var updateColumns = [];
    var values = [];
    var i = 1;
    for(var property in valuesObj) {
    	if((valuesObj.hasOwnProperty(property))
    		&& (typeof valuesObj[property] != 'undefined')) {

    		updateColumns.push('"' + property + '" = $' + i);
    		values.push(valuesObj[property]);
    		i++;
    	}
    }
    values.push(spaceId);

    var updateQuery = 'UPDATE "Space" SET ' + updateColumns.join(', ') + ' WHERE "SpaceId"=$' + (updateColumns.length + 1);

    var updateSuccessMessage = 'Successfully updated info for space';
    var updateFailedMessage = 'Failed to update info for space';
    executeQuery(res, updateSuccessMessage, updateFailedMessage, updateQuery, values);
});

// Get all spaces
app.get('/getAllSpaces', function (req, res) {
    var getQuery = 'SELECT * FROM "Space"';

    var getSuccessMessage = 'Successfully retrieved all space info';
    var getFailedMessage = 'Could not retrieve all space info';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery);
});

// Get space info
app.get('/getSpaceInfo', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "Space" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery, values);
});

// Delete space
app.post('/deleteSpace', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);

    var deleteQuery = 'DELETE FROM "Space" WHERE "SpaceId" = $1';

    var deleteSuccessMessage = 'Successfully deleted space';
    var deleteFailedMessage = 'Could not delete space';
    executeQuery(res, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});


/* Availability */
// Create new availability

// Update availability

// Get availability

// Get all availabilities

// Get filtered availabilities

// Delete availability


/* Leasing */
// Create new leasing
app.post('/addLeasing', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.tenantId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);
    values.push(req.body.negotiatedPricePerDay);

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "Leasing"("SpaceId", "TenantId", "FromDate", "ToDate", "NegotiatedPricePerDay") VALUES(' + params + ') RETURNING "SpaceId", "TenantId"';

    var insertSuccessMessage = 'Successfully inserted leasing';
    var insertFailedMessage = 'Failed to insert leasing';
    executeQuery(res, insertSuccessMessage, insertFailedMessage, insertQuery, values);
});

// Update leasing
app.post('/updateLeasingInfo', function (req, res) {
	var spaceId = req.body.spaceId;
	var tenantId = req.body.tenantId;
	var valuesObj = {
    	'FromDate': req.body.fromDate,
    	'ToDate': req.body.toDate,
    	'NegotiatedPricePerDay': req.body.negotiatedPricePerDay
	};

    var updateColumns = [];
    var values = [];
    var i = 1;
    for(var property in valuesObj) {
    	if((valuesObj.hasOwnProperty(property))
    		&& (typeof valuesObj[property] != 'undefined')) {

    		updateColumns.push('"' + property + '" = $' + i);
    		values.push(valuesObj[property]);
    		i++;
    	}
    }
    values.push(spaceId);
    values.push(tenantId);

    var updateQuery = 'UPDATE "Leasing" SET ' + updateColumns.join(', ') + ' WHERE "SpaceId"=$' + (updateColumns.length + 1) + ' AND "TenantId"=$' + (updateColumns.length + 2);

    var updateSuccessMessage = 'Successfully updated info for leasing';
    var updateFailedMessage = 'Failed to update info for leasing';
    executeQuery(res, updateSuccessMessage, updateFailedMessage, updateQuery, values);
});

// Get leasing info
app.get('/getLeasingInfo', function (req, res) {
	var valuesObj = {
		'SpaceId': req.get('spaceId'),
		'TenantId': req.get('tenantId'),
    	'FromDate': req.get('fromDate'),
    	'ToDate': req.get('toDate'),
    	'NegotiatedPricePerDay': req.get('negotiatedPricePerDay')
	};

    var updateColumns = [];
    var values = [];
    var i = 1;
    for(var property in valuesObj) {
    	if((valuesObj.hasOwnProperty(property))
    		&& (typeof valuesObj[property] != 'undefined')) {

    		updateColumns.push('"' + property + '" = $' + i);
    		values.push(valuesObj[property]);
    		i++;
    	}
    }

    var getQuery = 'SELECT * FROM "Leasing"';
    if(updateColumns.length > 0) {
    	getQuery += ' WHERE ' + updateColumns.join(' AND ');
    }

    var getSuccessMessage = 'Successfully retrieved leasing info';
    var getFailedMessage = 'Could not retrieve leasing info';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery, values);
});

// Delete a leasing
app.post('/deleteLeasing', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.tenantId);

    var deleteQuery = 'DELETE FROM "Leasing" WHERE "SpaceId" = $1 AND "TenantId" = $2';

    var deleteSuccessMessage = 'Successfully deleted leasing';
    var deleteFailedMessage = 'Could not delete leasing';
    executeQuery(res, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});

/* ForumPost */
// Add forum post
app.post('/addForumPost', function (req, res) {
    var values = [];
    values.push(req.body.userId);
    values.push(req.body.spaceId);
    values.push(req.body.text);
    values.push(req.body.dateTimePosted);
    values.push(req.body.projectTag);

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "ForumPost"("UserId", "SpaceId", "Text", "DateTimePosted", "ProjectTag") VALUES(' + params + ') RETURNING "ForumPostId"';

    var insertSuccessMessage = 'Successfully inserted forum post';
    var insertFailedMessage = 'Failed to insert forum post';
    executeQuery(res, insertSuccessMessage, insertFailedMessage, insertQuery, values);
});
// Get forum posts for space
app.get('/getForumPostsForSpace', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "ForumPost" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved forum posts for space';
    var getFailedMessage = 'Could not retrieve forum posts for space';
    executeQuery(res, getSuccessMessage, getFailedMessage, getQuery, values);
});

// Delete forum post
app.post('/deleteForumPost', function (req, res) {
    var values = [];
    values.push(req.body.forumPostId);

    var deleteQuery = 'DELETE FROM "ForumPost" WHERE "ForumPostId" = $1';

    var deleteSuccessMessage = 'Successfully deleted forum post';
    var deleteFailedMessage = 'Could not delete forum post';
    executeQuery(res, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});

/* Other */
// Verify credentials


// Helper functions
// Return a list of $i for query parametrization, to escape bad characters
function createParams(len) {
    var params = [];
    for(var i = 1; i <= len; i++) {
        params.push('$' + i);
    }
    return params.join(',');
}

// Execute a query, return the given messages when appropriate
// The argument 'values' can be omitted if the query takes no parameters
function executeQuery(res, successMessage, failedMessage, dbQuery, values) {
    var client = new pg.Client(conString);
    var result = [];
    client.connect(function (err, done) {
        if(err) {
            console.error('Could not connect to the database', err);
            res.writeHead(500);
            res.end('A server error occurred' + err);
        }

        var query = client.query(dbQuery, values);

        query.on('error', function (error) {
        	res.writeHead(500);
        	console.log(failedMessage);
        	console.log(error);
			res.end();
        });

        query.on('row', function (row){
            result.push(row);
        });

        query.on('end', function (){
            client.end();
            console.log(successMessage);
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write(JSON.stringify(result) + "\n");
            res.end();
        });
    });
}







app.listen(3000);

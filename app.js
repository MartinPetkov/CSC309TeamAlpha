var express = require('express');
var app = express();

var pg = require('pg');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var sha1 = require('sha1');
var https = require('https');
var fs = require('fs');
var sanitizer = require('sanitizer');

// Needed for HTTPS functionality
/*var options = {
	key: fs.readFileSync('key.pem'),
	cert: fs.readFileSync('cert.pem')
};*/

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

app.get('/logout', function (req, res) {
    console.log(req.session.user);
    req.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    });
});


app.get('/', function (req, res) {

	console.log('Page Loaded!');
	if (req.session.user) {
		console.log('current session: ' + req.session.user);
        res.redirect('/postings.html');
	} else {
        res.sendFile('./public/intro.html', {root:__dirname});

    }
});


app.get('/signup.html', function (req, res) {
	res.render('signup.html');
});


//User Profile Viewing
app.get('/user:id?', function (req, res) {
	var id = req.params.id;
	var dbQuery = 'SELECT ("Email", "HomeLocation", "Reputation", "About", "ProjectInterests", "FirstName", "LastName") FROM "User" WHERE "UserId"=$1';
	var successMessage = 'User Succesfully Retreived';
	var failedMessage = 'User Not Retreived';
	res.send(id);

});

app.get('/postings.html', function (req, res) {
	//res.sendFile('./public/views/postings.html',{root:__dirname});
    //res.render('postings.html', );
    //res.redirect('back');
    if (req.session.user) {
        get_availability(req,res, false);
        console.log("Postings page loaded");
    } else {
        res.redirect('/');
    }
});


//Log in Post
app.post('/postings.html', function (req, res) {
	var userEmail = req.body.email;
	var userPass = req.body.password;
	var result = [];
    var passFound = false;
	//res.send('Username ' + userEmail + '\n password '+ userPass);
	//console.log('login: ' + userEmail + ' from IP ' + req.connection.remoteAddress);
	var client = new pg.Client(conString);
	var dbPass = [];

	client.connect(function (err, done) {
        if (err) {
            return console.error('Could not connect to postgres', err);
            res.send('Sorry, there was an error', err);
        }
        console.log('Connected to db User: ' + userEmail);
		//var queryString = 'SELECT "Password", "UserII FROM "User" WHERE "Email"='+ userEmail + 'RETURNING "UserId"'

        var query = client.query('SELECT "Password", "UserId" FROM "User" WHERE "Email"=$1', [userEmail]);
		//var query = client.query(queryString);

        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        query.on('row', function (row) {
            dbPass.push(row.Password);
			result.push(row.UserId);
            passFound = true;
            //console.log('a user with that email was found ' + dbPass[0]);
        });
        query.on('end', function () {
            client.end();
            //console.log('client ended');
            if (passFound == false) {
                res.send('There was no user with that email');
            } else if (dbPass[0] == sha1(userPass)) {
                //Login Success!

                req.session.user = userEmail;
				req.session.uid = result[0];

				console.log('Session log for userid ' + req.session.uid);
                res.redirect('postings.html');

                //res.render('postings.html', {username: userEmail, password:userPass});
            } else if (dbPass[0] != userPass) {
                res.send('There was an error in log in ' + dbPass[0] + ' != ' + sha1(userPass));
            }
        });
	});

  //console.log('login: ' + userEmail + ' from IP ' + req.connection.remoteAddress);
});


app.get('/getOwnerSpace', function (req, res) {
    var values = [];
    if (req.session.user) {
        values.push(req.session.uid);

        var getQuery = 'SELECT * FROM "Space" WHERE "OwnerId" = $1'; 
        var getSuccessMessage = 'Successfully retrieved all owner spaceIDs';
        var getFailedMessage = 'Could not retrieve owner space info';
        console.log('In owner space');
        executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, true, renderOwnerSpace);
    } else {
        res.redirect('/');
    }
    
});


function renderOwnerSpace(result, res, req) {
    console.log('Getting Owner spaces');
    console.log(result.rows);

    res.render('add-availability.html', {space: result.rows, tenantId:req.session.user});
    res.end();
}


// Database interaction endpoints, add future functions here
/* User */
// Create new user
app.post('/addUser', function (req, res) {
    var values = [];
    values.push(req.body.firstName);
    values.push(req.body.lastName);
    values.push(req.body.email);
    values.push(sha1(req.body.password));
	//values.push(req.body.password);
    values.push(req.body.homeLocation);
    values.push(0);
    values.push(" ");
    values.push(" ");
    //values.push(req.body.reputation);
    //values.push(req.body.about);
    //values.push(req.body.projectInterests);
    // No photo yet, don't wanna deal with that

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "User"( "FirstName", "LastName", "Email", "Password", "HomeLocation", "Reputation", "About", "ProjectInterests") VALUES(' + params + ') RETURNING "UserId"';

    var insertSuccessMessage = 'Successfully inserted user';
    var insertFailedMessage = 'Failed to insert user';
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values, false);
	req.session.user = req.body.email;
});


// Update user info
app.post('/updateUserInfo', function (req, res) {
	var userEmail = req.body.email;
	var valuesObj = {
    	'FirstName': req.body.firstName,
    	'LastName': req.body.lastName,
    	'Email': userEmail,
    	'Password': sha1(req.body.password),
		//'Password': req.body.password,
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
		console.log('looking at property '+property + ' value = '+valuesObj[property]);
    	if((valuesObj.hasOwnProperty(property))
    		&& (typeof valuesObj[property] != 'undefined')) {

    		updateColumns.push('"' + property + '" = $' + i);
    		values.push(valuesObj[property]);
    		i++;
    	}
    }
    values.push(userEmail);
	//console.log(req.sess

    var updateQuery = 'UPDATE "User" SET ' + updateColumns.join(', ') + ' WHERE "Email"=$' + (updateColumns.length + 1);
    var updateSuccessMessage = 'Successfully updated info for user';
    var updateFailedMessage = 'Failed to update info for user';
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values, false, update_userInfo);

});
function update_userInfo(result, res, req){
	console.log('update user info func callback');
	res.redirect('/getUserInfo');
	res.end();
}

// Get all users
app.get('/getAllUsers', function (req, res) {
    var getQuery = 'SELECT * FROM "User"';

    var getSuccessMessage = 'Successfully retrieved all user info';
    var getFailedMessage = 'Could not retrieve all user info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, [], true);
});


// Get user info
//app.get('/getUserInfo:id?', function (req, res) {
app.get('/getUserInfo', function (req, res) {
    var values = [];
	 if (req.session.user) {
         values.push(req.session.user);
		var getQuery = 'SELECT * FROM "User" WHERE "Email" = $1';

		var getSuccessMessage = 'Successfully retrieved user info';
		var getFailedMessage = 'Could not retrieve user info';
		executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values, true, get_thisUserInfo);
    } else {
        res.redirect('/');
    }
	//var id = req.params.id;
    //values.push(req.get('userId'));
	//values.push(id);

});

app.get('/getUserInfo:id?', function(req, res){
	var values = [];
	var id = req.params.id;
	//values.push(req.get('userId'));
	values.push(id);
	var getQuery = 'SELECT * FROM "User" WHERE "UserId" = $1';

	var getSuccessMessage = 'Successfully retrieved user info';
	var getFailedMessage = 'Could not retrieve user info';
	executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values, true, get_userInfo);

});

function get_thisUserInfo(result, res, req){
	var spaceResult =[];
	var currUser = req.session.uid;
	var client = new pg.Client(conString);
	var currSpace = '';
	client.connect(function (err, done) {
		if (err) {
			return console.error('could not connect to postgres', err);
			res.send('sorry, there was an error', err);
		}
	    var query = client.query('SELECT * FROM "Leasing" WHERE "TenantId"=$1', [currUser]);
		query.on('error', function (err) {
            res.send('Query Error ' + err);
        });

		var spaceFound = false;
        query.on('row', function (row) {
            spaceFound = true;
			currSpace = row.SpaceId;
		});
		
        query.on('end', function () {
			if (spaceFound){
				//The user is currently occupying a space
				var innerQuery = client.query('Select * FROM "Space" WHERE "SpaceId"=$1',[currSpace]);
				console.log('innerQuery for spaceId= '+currSpace);
				innerQuery.on('error', function (err) {
					res.send('Query Error ' + err);
				});
				innerQuery.on('row', function(row){
					spaceResult.push(row);
					console.log('space Result push', row);
				});
				innerQuery.on('end', function(){
					client.end();
					var opt = {currUser:true,spaceFound:true};
					console.log(spaceResult[0]);
					get_userOwnerInfo(res, req, result.rows, spaceResult[0], opt, currUser);
					//res.render('profile.html', {profile:result.rows, opt:opt, Space:spaceResult[0]});
					//res.end();
				});
			}else{
				//The user is not occupying a space
				client.end();
				var opt = {currUser:true,spaceFound:false};
				console.log('No Space found');
				get_userOwnerInfo(res, req, result.rows, [], opt, currUser);

				//res.render('profile.html', {profile:result.rows, opt:opt, Space:[]});
				//res.end();
			}
		});
	});
}

function get_userOwnerInfo(res, req, profileResult, tenantSpace, opt, user){
	var ownerResult = [];
	var isOwner = false;
	var client = new pg.Client(conString);
	client.connect(function(err, done){
		if (err){
			res.send('sorry, there was an connection error', err);
		}
		var ownerQuery = client.query('Select * FROM "Space" WHERE "OwnerId"=$1',[user]);
		ownerQuery.on('error', function(err){
			res.send('Query Error ' + err);
		});
		ownerQuery.on('row', function(row){
			ownerResult.push(row);
			isOwner = true;
		});
		ownerQuery.on('end', function(){
			res.render('profile.html', {profile:profileResult, opt:opt, tennantSpace:tenantSpace, ownerSpace:ownerResult,Owner:isOwner});
			res.end();
		});
	});
};

function get_userInfo(result, res, req){
	//var currEmail = req.session.email;
	var viewUser = result.rows[0].UserId;
	console.log('get user info func');
	//var opt = {currUser:false};
	var spaceResult = [];
	var client = new pg.Client(conString);
	var currSpace = '';
	client.connect(function (err, done) {
		if (err) {
			return console.error('could not connect to postgres', err);
			res.send('sorry, there was an error', err);
		}
	    var query = client.query('SELECT * FROM "Leasing" WHERE "TenantId"=$1', [viewUser]);
		query.on('error', function (err) {
            res.send('Query Error ' + err);
        });

		var spaceFound = false;
        query.on('row', function (row) {
            spaceFound = true;
			currSpace = row.SpaceId;

		});
		query.on('end', function(){
			if (spaceFound){
				//The user is currently occupying a space
				var innerQuery = client.query('Select * FROM "Space" WHERE "SpaceId"=$1',[currSpace]);
				//console.log('innerQuery for spaceId= '+currSpace);
				innerQuery.on('error', function (err) {
					res.send('Query Error ' + err);
				});
				innerQuery.on('row', function(row){
					spaceResult.push(row);
					console.log('space Result push', row);
				});
				innerQuery.on('end', function(){
					client.end();
					var opt = {currUser:true,spaceFound:true};
					console.log(spaceResult[0]);
					get_userOwnerInfo(res, req, result.rows,spaceResult[0],opt, viewUser);
					//res.render('profile.html', {profile:result.rows, opt:opt, Space:spaceResult[0]});
					//res.end();

				});
			}else{
				//The user is not occupying a space
				client.end();
				var opt = {currUser:true,spaceFound:false};
				console.log('No Space found');
				get_userOwnerInfo(res, req, result.rows,[],opt, viewUser);
				//res.render('profile.html', {profile:result.rows, opt:opt, Space:[]});
				//res.end();
			}
		});
		});



	console.log('looking at user with id '+ result.rows[0].UserId);
	//res.render('profile.html', {profile:result.rows, opt:opt});
	//res.end();
}

// Delete user
app.post('/deleteUser', function (req, res) {
    var values = [];
    values.push(req.body.userId);

    var deleteQuery = 'DELETE FROM "User" WHERE "UserId" = $1';

    var deleteSuccessMessage = 'Successfully deleted user';
    var deleteFailedMessage = 'Could not delete user';
    executeQuery(res,req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values, false);
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
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values, false);
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
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values, false);
});


// Get all spaces
app.get('/getAllSpaces', function (req, res) {
    var getQuery = 'SELECT * FROM "Space"';

    var getSuccessMessage = 'Successfully retrieved all space info';
    var getFailedMessage = 'Could not retrieve all space info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, [], true);
});


// Get space info
app.get('/getSpaceInfo', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "Space" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, true);
});

function renderSpaceInfo(result, res, req) {
    res.render('space-info.html', {spaceInfo: result.rows[0]});
    res.end();
}

app.get('/space-info.html', function (req, res) {
    if(typeof req.query.spaceId == 'undefined') {
        res.end();
    }
    var values = [];
    values.push(req.query.spaceId);

    var getQuery = 'SELECT * FROM "Space" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, true, renderSpaceInfo);
});


// Delete space
app.post('/deleteSpace', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);

    var deleteQuery = 'DELETE FROM "Space" WHERE "SpaceId" = $1';

    var deleteSuccessMessage = 'Successfully deleted space';
    var deleteFailedMessage = 'Could not delete space';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values, false);
});


/* Availability */
// Create new availability
app.post('/addAvailability', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);
    console.log(values);
    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "Availability"("SpaceId", "FromDate", "ToDate") VALUES(' + params + ') RETURNING "SpaceId", "FromDate", "ToDate"';

    var insertSuccessMessage = 'Successfully inserted availability';
    var insertFailedMessage = 'Failed to insert availability';
    executeQuery(res, req, insertSuccessMessage, insertFailedMessage, insertQuery, values, false);
});


// Get availabilities (can be filtered)
app.get('/getAvailabilities', function (req, res) {
    get_availability(req, res, true);
});


// Delete availability
app.post('/deleteAvailability', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);

    var deleteQuery = 'DELETE FROM "Availability" WHERE "SpaceId" = $1 AND "FromDate" = $2 AND "ToDate" = $3';

    var deleteSuccessMessage = 'Successfully deleted availability';
    var deleteFailedMessage = 'Could not delete availability';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values, false);
});


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
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values, false);
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
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values, false);
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
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values, true);
});


// Delete a leasing
app.post('/deleteLeasing', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.tenantId);

    var deleteQuery = 'DELETE FROM "Leasing" WHERE "SpaceId" = $1 AND "TenantId" = $2';

    var deleteSuccessMessage = 'Successfully deleted leasing';
    var deleteFailedMessage = 'Could not delete leasing';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values, false);

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
    executeQuery(res, req, insertSuccessMessage, insertFailedMessage, insertQuery, values, false);
});


// Get forum posts for space
app.get('/getForumPostsForSpace', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "ForumPost" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved forum posts for space';
    var getFailedMessage = 'Could not retrieve forum posts for space';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, true);
});


// Delete forum post
app.post('/deleteForumPost', function (req, res) {
    var values = [];
    values.push(req.body.forumPostId);

    var deleteQuery = 'DELETE FROM "ForumPost" WHERE "ForumPostId" = $1';

    var deleteSuccessMessage = 'Successfully deleted forum post';
    var deleteFailedMessage = 'Could not delete forum post';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values, false);
});


/* Other */
// Verify credentials
app.get('/validateCredentials', function (req, res) {
    var email = req.get('email');
    var given_password = sha1(req.get('password'));

    // Admin credentials
    if(email == 'admin' && req.get('password') == 'wowsuchsecret') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('admin');
        res.end();
        return;
    }

    var client = new pg.Client(conString);
    var result = [];
    client.connect(function (err, done) {
        if(err) {
            console.error('Could not connect to the database', err);
            res.writeHead(500);
            res.end('A server error occurred' + err);
        }

        var getPassQuery = 'SELECT "Password" FROM "User" WHERE "Email" = $1';
        var query = client.query(getPassQuery, [email]);

        query.on('error', function (error) {
        	res.writeHead(500);
        	console.log(error);
			res.end();
        });

        query.on('row', function (row){
            result.push(row);
        });

        query.on('end', function (){
            client.end();
            res.writeHead(200, {'Content-Type': 'text/plain'});

            var validity = 'invalid';
            if(result.length > 0) {
            	var true_password = result[0].Password;
            	if(given_password == true_password) {
            		validity = 'valid';
            	}
            }

            res.write(validity);
            res.end();
        });
    });
});


// Helper functions
// Return a list of $i for query parametrization, to escape bad characters
function createParams(len) {
    var params = [];
    for(var i = 1; i <= len; i++) {
        params.push('$' + i);
    }
    return params.join(',');
}


function get_availability(req, res, get_bool) {
    var valuesObj = {
		'SpaceId': req.get('spaceId'),
    	'FromDate': req.get('fromDate'),
    	'ToDate': req.get('toDate')
	};

    var updateColumns = [];
    var values = [];
    var i = 1;
    if(typeof valuesObj['SpaceId'] != 'undefined') {
		updateColumns.push('"SpaceId" = $' + i);
		values.push(valuesObj['SpaceId']);
		i++;
	}
	if(typeof valuesObj['FromDate'] != 'undefined') {
		updateColumns.push('"Date" >= $' + i);
		values.push(valuesObj['FromDate']);
		i++;
	}
	if(typeof valuesObj['ToDate'] != 'undefined') {
		updateColumns.push('"Date" <= $' + i);
		values.push(valuesObj['ToDate']);
		i++;
	}
    //var getQuery = 'SELECT * FROM "Availability";
    var getQuery = 'SELECT * FROM "Availability" NATURAL JOIN "Space"';
    if(updateColumns.length > 0) {
    	getQuery += ' WHERE ' + updateColumns.join(' AND ');
    }
    
    var getSuccessMessage = 'Successfully retrieved availabilities';
    var getFailedMessage = 'Could not retrieve availabilities';
    var query = executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, get_bool);

}


// Execute a query and return the results
// The argument 'values' can be omitted if the query takes no parameters
function executeQuery(res,req, successMessage, failedMessage, dbQuery, values, get_bool, results_handler) {
    var client = new pg.Client(conString);
    var result = [];
    var result_rows = [];
    client.connect(function (err, done) {
        if(err) {
            console.error('Could not connect to the database', err);
            res.writeHead(500);
            res.end('A server error occurred' + err);
        }

        // Prevent XSS
        for(var i = 0; i < values.length; i++) {
        	if(typeof values[i] == 'string') {
        		values[i] = sanitizer.escape(values[i]);
        	}
        }

        var query = client.query(dbQuery, values, function(err, result){

                                 //console.log('RESULT ' +result);

                                 //console.log('RESULT ROWS ' + result.rows);

                                });


        query.on('error', function (error) {
        	res.writeHead(500);
        	console.log(failedMessage);
        	console.log(error);
			res.end();
        });


        query.on('row', function (row){
            result.push(row);
        });
        //return res.json(result);
        query.on('end', function (result){

            client.end();
            console.log(successMessage);
            if(!(typeof results_handler == 'undefined')) {
                results_handler(result, res, req);
                //res.end();
                //return;
            } else {

                if (successMessage == 'Successfully inserted user' && !get_bool){
                    req.session.uid = result.rows[0].UserId;
                    console.log('inserted user with ID= '+result.rows[0].UserId)
                    res.redirect('/postings.html');
                    res.end();

                }
                else if(successMessage == 'Successfully updated info for user'){
                    console.log('user update query');
                }
                else if (successMessage == 'Successfully retrieved user info' && get_bool){
                    console.log(result.rows[0]);
                    //res.render('profile.html', {profile:result.rows});

                    //res.end();
                }
                else if (successMessage == 'Successfully retrieved availabilities' && !get_bool) {
                    console.log(result.rows);
                    res.render('postings.html', {postings:result.rows});
                    res.end();
                } else {

                    res.writeHead(200, {'Content-Type': 'text/plain'});
                    res.write(JSON.stringify(result.rows) + "\n");

                    res.end();

                }
            }
        });
    });

}
// Used for heroku host
//app.use(express.static(__dirname + '/app'));

//app.configure(function(){
//    app.set('port', process.env.PORT || 3000);
//})
var port = Number(process.env.PORT || 3000);
var server = app.listen(port, function() { console.log('Listening on port %d', server.address().port); });

//app.listen(3000);
//https.createServer(options, app).listen(3000);

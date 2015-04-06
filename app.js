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


var SPACE_TYPES = [
    'Office',
    'Loft',
    'Apartment',
    'Studio',
    'Dungeon',
    'Asteroid',
    'Manos\' Nomad Outpost'
]

var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(__dirname + '/public/css'));
app.use(express.static(__dirname + '/public/js'));

app.use(session({secret: '123', resave: 'false', saveUninitialized: 'false'}));
app.use(morgan('dev'));

app.set('views', __dirname + '/public/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var logout = require("./routes/logout")(app),
    login = require("./routes/login")(app),
    admin = require("./routes/admin")(app),
    likedislike = require("./routes/likedislike")(app),
	profile = require("./routes/profile")(app),
	space = require("./routes/space")(app),
	team = require("./routes/teams")(app),
	application = require("./routes/applications")(app),
    profile = require("./routes/profile")(app),
    availabilities = require("./routes/availabilities")(app);



/* Home page */
// Redirects user to log in page if they are signed in
app.get('/', function (req, res) {
    if (req.session.user) {
        res.redirect('/postings.html');
    } else {
        res.sendFile('./public/views/intro.html', {root:__dirname});
    }
});

app.get('/getSpaceTypesGlobalVar', function (req, res) {
    res.send(SPACE_TYPES);
});


/* Sign up page */
app.get('/signup.html', function (req, res) {
    res.render('signup.html');
});



/* User Profile Viewing */
app.get('/user:id?', function (req, res) {
    var id = req.params.id;
    var dbQuery = 'SELECT ("Email", "HomeLocation", "Reputation", "About", "ProjectInterests", "FirstName", "LastName") FROM "User" WHERE "UserId"=$1';
    var successMessage = 'User Succesfully Retreived';
    var failedMessage = 'User Not Retreived';
    res.send(id);

});

/* Main Menu - List of all postings */
app.get('/postings.html', function (req, res) {
    // Postings is actually handled by get_availability function

    if (req.session.user) {
        res.redirect('/getAvailabilities');
    } else {
        res.redirect('/');
    }
});




/* Retreive list of spaces the user owns for add-availability.html */
app.get('/getOwnerSpace', function (req, res) {
    var values = [];
    if (req.session.user) {
        values.push(req.session.uid);

        var getQuery = 'SELECT * FROM "Space" WHERE "OwnerId" = $1';
        var getSuccessMessage = 'Successfully retrieved all owner spaceIDs';
        var getFailedMessage = 'Could not retrieve owner space info';
        executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, renderOwnerSpace);
    } else {
        res.redirect('/');
    }

});

/* Helper function: Renders the spaces for add-availability.html */
function renderOwnerSpace(result, res, req) {
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
    values.push(req.body.homeLocation);

    // Place holder Reputation
    values.push(0);
    // Place holder for about and project Interests
    values.push(" ");
    values.push(" ");

    // No photo yet, don't wanna deal with that

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "User"( "FirstName", "LastName", "Email", "Password", "HomeLocation", "Reputation", "About", "ProjectInterests") VALUES(' + params + ') RETURNING "UserId"';

    var insertSuccessMessage = 'Successfully inserted user';
    var insertFailedMessage = 'Failed to insert user';
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values, redirectToPostings);

    // Log the User's email in the session
    // We log their UserId in execute-query (admittedly not the prettiest)
    req.session.user = req.body.email;
});

function redirectToPostings(result, res, req) {
    req.session.uid = result.rows[0].UserId;
    res.redirect('/postings.html');
    res.end();   
}


// Update user info
app.post('/updateUserInfo', function (req, res) {
    //Get necessary values from form and session
    var userEmail = req.session.user;
    var valuesObj = {
        'FirstName': req.body.firstName,
        'LastName': req.body.lastName,

        /* TBC IN PHASE 4 */
        /* 'Email': userEmail,
           'Password': sha1(req.body.password),
           'Password': req.body.password, */
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
        //console.log('looking at property '+property + ' value = '+valuesObj[property]);
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
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values, update_userInfo);

});

// Helper function: Callback for updateUserInfo post, just redirects to userProfile
function update_userInfo(result, res, req){
    res.redirect('/getUserInfo');
    res.end();
}

// Get all users
app.get('/getAllUsers', function (req, res) {
    var getQuery = 'SELECT * FROM "User"';

    var getSuccessMessage = 'Successfully retrieved all user info';
    var getFailedMessage = 'Could not retrieve all user info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, []);
});




// Pls don't modify this function, we need some way to get simple data rather than a web page as the result
app.get('/getUserInfoPlain:id?', function(req, res){
    var values = [];
    var id = req.params.id;
    values.push(id);
    //console.log(id);
    var getQuery = 'SELECT * FROM "User" WHERE "UserId" = $1';

    var getSuccessMessage = 'Successfully retrieved user info';
    var getFailedMessage = 'Could not retrieve user info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});





//Get all user occupying this space AJAX
app.get('/getAllSpaceUserInfo', function(req, res){
    console.log('here in getallspaceuserinfo');
    var values = [];
    if(typeof req.query.spaceId == 'undefined') {
        res.end();
    }
    var id = req.query.spaceId;
    //values.push(req.get('userId'));
    values.push(id);
    var getQuery = 'SELECT * FROM "Leasing" JOIN "User" ON "Leasing"."TenantId" = "User"."UserId" WHERE "SpaceId" = $1';

    console.log(req.query.id);
    var getSuccessMessage = 'Successfully retrieved user info';
    var getFailedMessage = 'Could not retrieve user info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});

//Get all teams associated to this space AJAX
app.get('/getAllSpaceTeamInfo', function(req, res){
    console.log('here in getallspaceteaminfo with id = '+req.query.spaceId);
    var values = [];
    if(typeof req.query.spaceId == 'undefined') {
        res.end();
    }
    var id = req.query.spaceId;
    //values.push(req.get('userId'));
    values.push(id);
    var getQuery = 'SELECT * FROM "Space" NATURAL JOIN "Teams" WHERE "SpaceId" = $1';

    console.log(id);
    var getSuccessMessage = 'Successfully retrieved Team info';
    var getFailedMessage = 'Could not retrieve Team info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});

//Get all members associated to this team AJAX
app.get('/getAllTeamMemberInfo', function(req, res){
    console.log('here in get all team member info with team id = '+req.query.teamId);
    var values = [];
    if(typeof req.query.teamId == 'undefined') {
        res.end();
    }
    var id = req.query.teamId;
    //values.push(req.get('userId'));
    values.push(id);
    var getQuery = 'SELECT * FROM "TeamMembers" NATURAL JOIN "User" WHERE "TeamId" = $1';

    console.log(id);
    var getSuccessMessage = 'Successfully retrieved team member  info';
    var getFailedMessage = 'Could not retrieve team member info';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values);

});

//Get Lease info about specific User and Space
app.get('/getUserLeaseInfo', function(req, res){
    console.log('here in getUserLeaseInfo');
    var values = [];
    if(typeof req.query.spaceId == 'undefined') {
        console.log('no spaceId');
        res.end();
    }
    if(typeof req.query.user == 'undefined') {
        console.log('no user');
        res.end();
    }
    var id = req.query.spaceId;
    var user = req.query.user;
    //values.push(req.get('userId'));
    values.push(id);
    values.push(user);
    var getQuery = 'SELECT * FROM "Leasing" WHERE "SpaceId" = $1 AND "TenantId"=$2';

    console.log('values for getUserLEaseInfo '+id + ' '+user);
    var getSuccessMessage = 'Successfully retrieved user Lease info';
    var getFailedMessage = 'Could not retrieve user Lease info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});

//Get Team info about specific User and Team
app.get('/getUserTeamInfo', function(req, res){
    console.log('here in getUserLeaseInfo');
    var values = [];
    if(typeof req.query.teamId == 'undefined') {
        console.log('no teamId');
        res.end();
    }
    if(typeof req.query.user == 'undefined') {
        console.log('no user');
        res.end();
    }
    var id = req.query.teamId;
    var user = req.query.user;
    //values.push(req.get('userId'));
    values.push(id);
    values.push(user);
    var getQuery = 'SELECT * FROM "TeamMembers" WHERE "TeamId" = $1 AND "UserId"=$2';

    console.log('values for getUserLEaseInfo '+id + ' '+user);
    var getSuccessMessage = 'Successfully retrieved user Lease info';
    var getFailedMessage = 'Could not retrieve user Lease info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});

//Get Team info about this
app.get('/getUserTeams', function(req, res){
    console.log('here in getUserTeams');
    var values = [];
    if(typeof req.query.user == 'undefined') {
        console.log('no user');
        res.end();
    }
    var user = req.query.user;
    //values.push(req.get('userId'));
    values.push(user);
    var getQuery = 'SELECT * FROM "TeamMembers" JOIN "Teams" ON "Teams"."TeamId" = "TeamMembers"."TeamId" WHERE "TeamMembers"."UserId"=$1';

    console.log('values for get user Teams '+user);
    var getSuccessMessage = 'Successfully get teams info';
    var getFailedMessage = 'Could not retrieve teams info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);

});


// Delete user
app.post('/deleteUser', function (req, res) {
    var values = [];
    values.push(req.body.userId);

    var deleteQuery = 'DELETE FROM "User" WHERE "UserId" = $1';

    var deleteSuccessMessage = 'Successfully deleted user';
    var deleteFailedMessage = 'Could not delete user';
    executeQuery(res,req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});


/* Space */
// Create new space
app.post('/addSpace', function (req, res) {
    var values = [];
    values.push(req.session.uid);
    values.push(req.body.spaceName);
    values.push(req.body.location);
    values.push(req.body.description)
    values.push(req.body.spaceType);
    console.log(req.body.spaceType);
    values.push(req.body.area);
    values.push(req.body.rooms);
    values.push(req.body.pricePerDay);
    values.push(req.body.vacancyAmount);

    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "Space"("OwnerId", "SpaceName", "Location", "Description", "SpaceType", "Area", "Rooms", "PricePerDay", "VacancyAmount") VALUES(' + params + ') RETURNING "SpaceId"';

    var insertSuccessMessage = 'Successfully inserted space';
    var insertFailedMessage = 'Failed to insert space';
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values,
        function(result, res, req) {
            res.redirect('/postings.html');
        });
});

app.get('/getAddSpace', function (req, res) {
    res.redirect('/addSpace.html');
});

app.get('/addSpace.html', function (req, res) {
    if (req.session.user) {
        res.render('addSpace.html');
    } else {
        res.redirect('/');
    }
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
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values);
});


// Get all spaces
app.get('/getAllSpaces', function (req, res) {
    var getQuery = 'SELECT * FROM "Space"';

    var getSuccessMessage = 'Successfully retrieved all space info';
    var getFailedMessage = 'Could not retrieve all space info';
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, []);
});


// Get space info
app.get('/getSpaceInfo', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "Space" WHERE "SpaceId" = $1';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values);
});


// Delete space
app.post('/deleteSpace', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);

    var deleteQuery = 'DELETE FROM "Space" WHERE "SpaceId" = $1';

    var deleteSuccessMessage = 'Successfully deleted space';
    var deleteFailedMessage = 'Could not delete space';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
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
    executeQuery(res,req, insertSuccessMessage, insertFailedMessage, insertQuery, values);
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
    executeQuery(res,req, updateSuccessMessage, updateFailedMessage, updateQuery, values);
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
    executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values);
});


// Delete a leasing
app.post('/deleteLeasing', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.tenantId);

    var deleteQuery = 'DELETE FROM "Leasing" WHERE "SpaceId" = $1 AND "TenantId" = $2';
    var deleteSuccessMessage = 'Successfully deleted leasing';
    var deleteFailedMessage = 'Could not delete leasing';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);

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
    executeQuery(res, req, insertSuccessMessage, insertFailedMessage, insertQuery, values);
});


// Get forum posts for space
app.get('/getForumPostsForSpace', function (req, res) {
    var values = [];
    values.push(req.get('spaceId'));

    var getQuery = 'SELECT * FROM "ForumPost" WHERE "SpaceId" = $1';
    var getSuccessMessage = 'Successfully retrieved forum posts for space';
    var getFailedMessage = 'Could not retrieve forum posts for space';
    executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values);
});

// Delete forum post
app.post('/deleteForumPost', function (req, res) {
    var values = [];
    values.push(req.body.forumPostId);

    var deleteQuery = 'DELETE FROM "ForumPost" WHERE "ForumPostId" = $1';

    var deleteSuccessMessage = 'Successfully deleted forum post';
    var deleteFailedMessage = 'Could not delete forum post';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});


app.get('/isOwner', function (req, res) {
    var dbQuery = 'SELECT * FROM "Space" WHERE "OwnerId"= $1 AND "SpaceId"= $2';
    var successMessage = 'Successfully checked whether the owner owns the space';
    var failedMessage = 'Could not check whether the owner owns the space';
    
    if(typeof req.query.spaceId == 'undefined') {
        res.end();
    }
    
    executeQuery(res,req, successMessage, failedMessage, dbQuery, [req.session.uid, req.query.spaceId]);
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

// Execute a query and return the results
// The argument 'values' can be omitted if the query takes no parameters
function executeQuery(res,req, successMessage, failedMessage, dbQuery, values, results_handler) {
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

        var query = client.query(dbQuery, values, function(err, result){});

        query.on('error', function (error) {
            res.writeHead(500);
            console.log(failedMessage);
            console.log(error);
            res.end();
        });

        query.on('row', function (row){
            result.push(row);
        });

        query.on('end', function (result){
            client.end();
            console.log(successMessage);
            
            if(!(typeof results_handler == 'undefined')) {
                results_handler(result, res, req);

            } else {
                res.writeHead(200, {'Content-Type': 'text/plain'});

                var jsonShit = {};
                jsonShit.results = result.rows;
                console.log(jsonShit.results);
                res.write(JSON.stringify(jsonShit, 0, 4));
                res.end();
            }
        });
    });
}

// Used for Heroku host
var port = Number(process.env.PORT || 3000);
var server = app.listen(port, function() { console.log('Listening on port %d', server.address().port); });


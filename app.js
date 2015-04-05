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
    profile = require("./routes/profile")(app);


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


//Get space info, requires a space Id to be passed in
app.get('/space-info.html', function (req, res) {
    if(typeof req.query.spaceId == 'undefined' || typeof req.query.joined == 'undefined') {
        res.end();
    }
    console.log(req.query.joined);
    req.session.joined = req.query.joined;
    console.log(req.session.joined);
    //var values = [];
    //values.push(req.query.spaceId);

    var getQuery = 'SELECT *, $1::integer AS LikeDislike FROM "Space" WHERE "SpaceId" = $2';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    
    var getRatingQuery = 'SELECT * FROM "SpaceRating" WHERE "UserId"= $1 AND "SpaceId"= $2';
    var client = new pg.Client(conString);
    var result = [];

    client.connect(function (err, done) {
        
        /* Unable to connect to postgreSQL server */
        if (err) {
            res.writeHead(500);
            console.log('Unable to connect to database');
        }
        
        // Query to check if the user exists
        var query = client.query(getRatingQuery, [req.session.uid, req.query.spaceId], function(err, result){});
        
        /* Unable to execute query */
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
        });
        
        query.on('end', function () {
            client.end();
            console.log(result);
            console.log(result[0]);
            var currentRating;
            if (typeof result[0] == 'undefined') {
                console.log('empty');
                currentRating = null;
            } else {
                console.log(result.rows);
                currentRating = result[0].LikeDislike;
            }
            console.log('Rating: ' + currentRating);
            
            var values = [];
            values.push(currentRating);
            values.push(req.query.spaceId);
            console.log(values)

            console.log(getQuery);
            executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, renderSpaceInfo);

        });
    });
});


// Helper function: Renders for space-info.html GET
function renderSpaceInfo(spaceResult, res, req) {
    var client = new pg.Client(conString),
        result = [],
        dbQuery = 'SELECT * FROM "Space" NATURAL JOIN "Teams" WHERE "SpaceId"=$1';
    var spaceId = spaceResult.rows[0].SpaceId;
    
    client.connect(function (err, done) {
        /* Unable to connect to postgreSQL server */
        if (err) {
            res.writeHead(500);
            console.log('Unable to connect to database');
        }
        
        var query = client.query(dbQuery, [spaceId], function(err, result){});
        console.log("InsertQuery");

        /* Unable to connect to database */
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
        });

        // Update Applications
        query.on('end', function () {
            var selectQuery = 'Select * FROM "Leasing" WHERE "TenantId"=$1 AND "SpaceId"=$2';
            var query2 = client.query(selectQuery, [req.session.uid,spaceId], function(err, result){});
            var occupying=false;
            query2.on('error', function (err) {
                res.send('Query Error ' + err);
            });
            
            query2.on('row', function (row) {
                result.push(row);
                occupying=true;
            });

            // Update Applications
            query2.on('end', function () {
                client.end();
                console.log("occupying= "+occupying);
                res.render('space-info.html', {occupying:occupying,spaceInfo: spaceResult.rows[0], teamsInfo : result, currentUser: req.session.joined, user:req.session.uid});
            //res.end();
            });
        });
        
    });
  
};

app.get('/getTeam:id?',function(req, res){
    var teamId = req.params.id;
    var selectQuery = 'Select * FROM "Teams" NATURAL JOIN "User" NATURAL JOIN "Space" where "TeamId"=$1';
    values=[teamId];
    
    var successMessage = 'Succesfully Selected from Teams',
        failedMessage  = 'Could not select from teams;';

    executeQuery(res, req, successMessage, failedMessage, selectQuery, values, renderTeam);
});
function renderTeam(teamResult, res, req){
    res.render('team-info.html', {teamInfo:teamResult.rows[0], user:req.session.uid});
    
};

app.post('/apply-team', function(req, res){
    //res.send("applying with user = "+req.body.user + " for space= "+req.body.teamId);
    var client = new pg.Client(conString),
        result = [],
        dbQuery = 'INSERT INTO "TeamMembers" ("TeamId", "UserId") SELECT $1, $2 WHERE NOT EXISTS (SELECT "TeamId","UserId" FROM "TeamMembers" WHERE "TeamId" = $1 AND "UserId"= $2)';
    
    client.connect(function (err, done) {
        /* Unable to connect to postgreSQL server */
        if (err) {
            res.writeHead(500);
            console.log('Unable to connect to database');
        }
        
        var query = client.query(dbQuery, [req.body.teamId, req.body.user], function(err, result){});
        console.log("InsertQuery");

        /* Unable to connect to database */
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
        });

        // Update Applications
        query.on('end', function () {
            client.end();
            var link = '/getTeam'+req.body.teamId;
            res.redirect(link);
        });
    });
});

//Post to leave team
app.post('/leave-team', function(req, res){
    var values = [];
    values.push(req.body.user);
    values.push(req.body.teamId);
    var dbQuery = 'DELETE FROM "TeamMembers" WHERE "UserId"=$1 AND "TeamId"=$2';
    
    var successMessage = 'Successfully removed from TeamMembers',
    failedMessage = 'Culd not remove from TeamMembers';
    
    executeQuery(res, req, successMessage, failedMessage, dbQuery, values, leaveTeam);
});

function leaveTeam (result, res, req){
    res.redirect('/');
};
//Post for space occupation application, enters request in the "Applications" Table 
app.post('/apply-space', function(req, res){
    var user = req.session.uid;
    var space = req.body.spaceId;
    var values = [];
    values.push(req.session.uid)
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);
    console.log('applying to space with values = '+values)

    var client = new pg.Client(conString),
        result = [],
        result2 = [],
        dbQuery = 'INSERT INTO "Applications" ("UserId", "SpaceId", "FromDate", "ToDate") SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT "UserId","SpaceId" FROM "Applications" WHERE "UserId" = $5 AND "SpaceId"= $6) RETURNING "SpaceId"';
    
    client.connect(function (err, done) {
        /* Unable to connect to postgreSQL server */
        if (err) {
            res.writeHead(500);
            console.log('Unable to connect to database');
        }
        
        var query = client.query(dbQuery, [req.session.uid, req.body.spaceId, req.body.fromDate, req.body.toDate, req.session.uid, req.body.spaceId], function(err, result){});
        console.log("InsertQuery");

        /* Unable to connect to database */
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
        });

        // Update Applications
        query.on('end', function () {
            
            var updateQuery = 'UPDATE "Applications" SET "UserId"=$1, "SpaceId"=$2, "FromDate"=$3, "ToDate"=$4 WHERE "UserId" = $1 AND "SpaceId" = $2 RETURNING "SpaceId"';
            var query2 = client.query(updateQuery, [req.session.uid, req.body.spaceId, req.body.fromDate, req.body.toDate], function(err, result){});

            query2.on('error', function (err) {
                res.send('Query Error ' + err);
            });
        
            query2.on('row', function (row) {
                result2.push(row);
            })
            query2.on('end', function () {
                client.end();
                res.redirect('/postings.html');
            });
        });
    });
});

//View applications to spaces you own
app.get('/getApplications',function(req, res){
     var values = [];
     values.push(req.session.uid);
     //("FromDate", "ToDate", "Location", "PricePerDay", "SpaceName", "FirstName", "LastName", "Reputation", "UserTotalRating")
    var appQuery = 'SELECT * FROM "Applications" NATURAL JOIN "Space" NATURAL JOIN "User" WHERE "OwnerId"=$1';
    var successMessage = 'Succesfully selected from Applications';
    var failedMessage = 'Could not select from Applications';
    
     executeQuery(res, req, successMessage, failedMessage, appQuery, values, renderApplications);   
});

function renderApplications (results, res, req){
    //console.log(results.rows[0]);
    
    res.render('getApplications.html', {appInfo:results.rows});
    
};

//TODO UPDATE QUERIES
app.post('/updateApplication', function(req, res){
    var user = req.session.uid;
    var space = req.body.spaceId;
    var values = [];
    values.push(req.body.tenant)
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);
    values.push(req.body.price);
    values.push(req.body.response);
    
    console.log(req.body.fromDate);
    console.log('Updating Application with values = '+values)

    var client = new pg.Client(conString),
        result = [],
        result2 = [],
        result3 = [],
        result4 = [],
        getQuery = 'SELECT * FROM "Applications" WHERE "UserId"=$1 AND "SpaceId"=$2';
    var toDate,fromDate;
    var dateHack1, dateHack2;
    
       // getQuery = 'INSERT INTO "Applications" ("UserId", "SpaceId", "FromDate", "ToDate") SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT "UserId","SpaceId" FROM "Applications" WHERE "UserId" = $5 AND "SpaceId"= $6) RETURNING "SpaceId"';

    client.connect(function (err, done) {
        //Unable to connect to postgreSQL server 
        if (err) {
            res.writeHead(500);
            console.log('Unable to connect to database');
        }
        //FIND DATES IN APPLICATIONS
        var query = client.query(getQuery, [req.body.tenant,req.body.spaceId], function(err, result){});
        console.log("InsertQuery");

        // Unable to connect to database 
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
            toDate   = row.ToDate;
            fromDate = row.FromDate;
                
                        
        });

        // UPDATE LEASING TODO
        query.on('end', function () {
            //client.end();
            //res.send(toDate+fromDate);
            var updateQuery = 'DELETE FROM "Applications" WHERE "UserId" = $1 AND "SpaceId" = $2';
            var query2 = client.query(updateQuery, [req.body.tenant, req.body.spaceId], function(err, result){});
            
            console.log("DeleteQuery");
            
            query2.on('error', function (err) {
                res.send('Query Error ' + err);
            });
        
            query2.on('row', function (row) {
                result2.push(row);
            })
            query2.on('end', function () {
                console.log("response = "+req.body.response);
                if (req.body.response=="accepted"){
                    var fromDate1 = new Date(fromDate);
                    var toDate1  = new Date(toDate);
                    //fromDate1.format('YYYY-MM-DD');
                    dateHack1 =''+(fromDate1.getYear()-100+2000)+'-'+(fromDate1.getMonth()+1)+'-'+fromDate1.getDate();
                    dateHack2 =''+(toDate1.getYear()-100+2000)+'-'+(toDate1.getMonth()+1)+'-'+toDate1.getDate();
                    //console.log(dateHack);
                    var insertQuery = 'INSERT INTO "Leasing" ("SpaceId", "FromDate", "TenantId", "ToDate", "NegotiatedPricePerDay") SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT "TenantId", "SpaceId" FROM "Leasing" WHERE "TenantId" = $3 AND "SpaceId"= $1)';
                    var query3 = client.query(insertQuery, [req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price], function(err, result){});
                    
                    console.log('INSERTQUERY'+ [req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price]);
                    
                    query3.on('error', function (err) {
                        res.send('Query Error ' + err);
                    });
                
                    query3.on('row', function (row) {
                        result3.push(row);
                        console.log('insert push row');
                    })
                    query3.on('end', function(){
                        console.log(dateHack1+' '+dateHack2);
                        var updateQuery = 'UPDATE "Leasing" SET "SpaceId"=$1, "FromDate"=$2, "TenantId"=$3, "ToDate"=$4, "NegotiatedPricePerDay"=$5 WHERE "TenantId" = $3 AND "SpaceId" = $1';
                        var query4 = client.query(updateQuery, [req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price], function(err, result){});
                        
                        console.log('UPDATEQUERY'+[req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price]);
                        
                        query4.on('error', function (err) {
                            res.send('Query Error ' + err);
                        });
                    
                        query4.on('row', function (row) {
                            result4.push(row);
                        })
                        query4.on('end', function(){
                            console.log('done!');
                            client.end();
                            res.redirect('/getApplications');
                        });
                    });
                }else if(req.body.response=="rejected"){
                    client.end();
                    res.redirect('/getApplications');
                }
                
            });
            
        });
    });
    
    
});

function redirectApplySpace(result, res, req){
    //console.log('redirecting from apply space');
    res.redirect('/postings.html');
};

// Delete space
app.post('/deleteSpace', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);

    var deleteQuery = 'DELETE FROM "Space" WHERE "SpaceId" = $1';

    var deleteSuccessMessage = 'Successfully deleted space';
    var deleteFailedMessage = 'Could not delete space';
    executeQuery(res, req, deleteSuccessMessage, deleteFailedMessage, deleteQuery, values);
});


/* Availability */
// Create new availability
app.post('/addAvailability', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);
    //console.log(values);
    var params = createParams(values.length);
    var insertQuery = 'INSERT INTO "Availability"("SpaceId", "FromDate", "ToDate") VALUES(' + params + ') RETURNING "SpaceId", "FromDate", "ToDate"';

    var insertSuccessMessage = 'Successfully inserted availability';
    var insertFailedMessage = 'Failed to insert availability';
    executeQuery(res, req, insertSuccessMessage, insertFailedMessage, insertQuery, values, redirectCreateTeam);
});


// Get availabilities (can be filtered)
app.get('/getAvailabilities', function (req, res) {
    var valuesObj = {
        'SpaceId': req.get('spaceId'),
        'FromDate': req.get('fromDate'),
        'ToDate': req.get('toDate'),

        'keywords': req.query['keywords'],
        'price-range': req.query['price-range'],
        'space-type': req.query['space-type'],
        'fromDate': req.query['fromDate'],
        'toDate': req.query['toDate'],
        'sort-by': req.query['sort-by']
    };

    var updateColumns = [];
    var values = [];
    var i = 1;

    //Check if values make sense
    if(typeof valuesObj['SpaceId'] != 'undefined') {
        updateColumns.push('"SpaceId" = $' + i);
        values.push(valuesObj['SpaceId']);
        i++;
    }
    if(typeof valuesObj['FromDate'] != 'undefined') {
        updateColumns.push('"FromDate" >= $' + i);
        values.push(valuesObj['FromDate']);
        i++;
    }
    if(typeof valuesObj['ToDate'] != 'undefined') {
        updateColumns.push('"ToDate" <= $' + i);
        values.push(valuesObj['ToDate']);
        i++;
    }

    if(valuesObj['keywords']) {
        // Trip spaces
        var keywordsList = valuesObj['keywords'].replace(/^\s+|\s+$/g, '');
        keywordsList = keywordsList.replace(/ +/g, ',').split(',');
        console.log(keywordsList);

        var keywordColumns = '(';
        var kwLength = keywordsList.length;
        for(var k = 0; k < kwLength; k++) {
            var keyword = keywordsList[i-1];

            var likeVal = '';
            if(k > 0) likeVal = ' OR ';
            likeVal += '"Description" LIKE $' + i + ' OR "SpaceName" LIKE $' + i;

            keywordColumns += likeVal;
            values.push('%' + keyword + '%');
            i++;
        }
        keywordColumns += ')';

        updateColumns.push(keywordColumns);
    }
    if(valuesObj['price-range']) {
        if(valuesObj['price-range'][0]) {
            updateColumns.push('"PricePerDay" >= $' + i);
            values.push(valuesObj['price-range'][0]);
            i++;
        }
        if(valuesObj['price-range'][1]) {
            updateColumns.push('"PricePerDay" <= $' + i);
            values.push(valuesObj['price-range'][1]);
            i++;
        }
    }
    if(valuesObj['space-type']) {
        updateColumns.push('"SpaceType" LIKE $' + i);
        values.push('%' + valuesObj['space-type'] + '%');
        i++;
    }if(valuesObj['fromDate']) {
        updateColumns.push('"FromDate" >= $' + i);
        values.push(valuesObj['fromDate']);
        i++;
    }if(valuesObj['toDate']) {
        updateColumns.push('"ToDate" <= $' + i);
        values.push(valuesObj['toDate']);
        i++;
    }
    var getQuery = 'SELECT * FROM "Availability" NATURAL JOIN "Space"';
    if(updateColumns.length > 0) {
        getQuery += ' WHERE ' + updateColumns.join(' AND ');
    }

    if(valuesObj['sort-by']) {
        getQuery += ' ORDER BY ';
        if(valuesObj['sort-by'] == 'PLH') {
            getQuery += '"PricePerDay" ASC';
        } else if(valuesObj['sort-by'] == 'PHL') {
            getQuery += '"PricePerDay" DESC';
        } else if(valuesObj['sort-by'] == 'FDA') {
            getQuery += '"FromDate" ASC';
        } else if(valuesObj['sort-by'] == 'FDD') {
            getQuery += '"FromDate" DESC';
        }
    }

    getQuery += ';';

    var getSuccessMessage = 'Successfully retrieved availabilities';
    var getFailedMessage = 'Could not retrieve availabilities';
    var query = executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, renderPostings);

});

function renderPostings(result, res, req) {
    res.render('postings.html', {postings:result.rows});
    res.end();   
}


// Delete availability
app.post('/deleteAvailability', function (req, res) {
    var values = [];
    values.push(req.body.spaceId);
    values.push(req.body.fromDate);
    values.push(req.body.toDate);

    var deleteQuery = 'DELETE FROM "Availability" WHERE "SpaceId" = $1 AND "FromDate" = $2 AND "ToDate" = $3';

    var deleteSuccessMessage = 'Successfully deleted availability';
    var deleteFailedMessage = 'Could not delete availability';
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

//Create a Team
app.get('/create-team', function(req, res){
 var values = [];
    if (req.session.user) {
        values.push(req.session.uid);

        var getQuery = 'SELECT * FROM "Leasing" NATURAL JOIN "Space" WHERE "TenantId" = $1';
        var getSuccessMessage = 'Successfully retrieved all tenant spaceIDs';
        var getFailedMessage = 'Could not retrieve tenant space info';
        executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, renderCreateTeams);
    } else {
        res.redirect('/');
    }
});

function renderCreateTeams(result, res, req){
    res.render('create-team.html', {space:result.rows, currUser:req.session.uid});
    res.end();
};

app.post('/create-team', function(req, res){
    var values = [];
    values.push(req.body.userId);
    values.push(req.body.spaceId);
    values.push(req.body.teamName);
    values.push(req.body.teamDescription);
    
    var createTeamQuery = 'INSERT INTO "Teams" VALUES($1,$2,$3,$4)'
    
    var createSuccessMessage = 'Successfully created a Team';
    var createFailedMessage = 'Could not create a team';
    executeQuery(res,req, createSuccessMessage, createFailedMessage, createTeamQuery,values, redirectCreateTeam);
});

function redirectCreateTeam(req, res){
    res.redirect('/postings.html');
};

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


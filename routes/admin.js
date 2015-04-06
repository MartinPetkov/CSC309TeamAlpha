var express = require('express');
var pg = require('pg');
var sha1 = require('sha1');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');

var https = require('https');
var fs = require('fs');
var sanitizer = require('sanitizer');

var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";

var adminUser = "admin"

var adminPass = "adminpass"

module.exports = function (app) {
    /* Log in Admin */
    app.get('/admin.html', function (req, res) {
        console.log("admin logged in");  
        res.render('admin.html');
    });

    app.post('/changeLeaseType', function (req, res) {
        var restrict_space_types = req.body['restrict-space-types'];

        // Trim spaces and turn into list
        var add_space_types =  req.body['add-space-types'].replace(/^\s+|\s+$/g, '').replace(/( *, *)|( +)/g, ',').split(',');


        var updatedSpaceTypes = [];
        if(add_space_types[0]) {
            updatedSpaceTypes = add_space_types;
        }
        
        var stLen = SPACE_TYPES.length;
        for(var i = 0; i < stLen; i++) {
            var keepType = SPACE_TYPES[i];

            // Keep only types that haven't been restricted
            if(!restrict_space_types || restrict_space_types.indexOf(keepType) == -1) {
                updatedSpaceTypes.push(keepType);
            }
        }

        SPACE_TYPES = updatedSpaceTypes;
        console.log(SPACE_TYPES);

        res.redirect('/admin.html');
    });
    
    //queries used for stats
    app.get('/getSpaces?', function (req, res) {
        successMessage = "retrieved teams count";
        failedMessage = "failed to retrieve teams count";
        dbQuery = 'SELECT count("SpaceName") as "spaceCount" FROM "Space"';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
        
    });
    
    app.get('/getMembers?', function (req, res) {
        successMessage = "retrieved members count";
        failedMessage = "failed to retrieve members count";
        dbQuery = 'SELECT count("Email") as "emailCount" FROM "User"';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
        
    app.get('/getTeams?', function (req, res) {
        successMessage = "retrieved teams count";
        failedMessage = "failed to retrieve teams count";
        dbQuery = 'SELECT count("TeamName") as "teamCount" FROM "Teams"';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getAvgTeam?', function (req, res) {
        successMessage = "retrieved avg team";
        failedMessage = "failed to retrieve avg team";
        dbQuery = 'SELECT round(avg(count), 2) as "maxTeam" FROM (SELECT count("UserId") as count FROM "TeamMembers" GROUP BY "TeamId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getMaxTeam?', function (req, res) {
        successMessage = "retrieved largest team";
        failedMessage = "failed to retrieve largest team";
        dbQuery = 'SELECT round(max(count), 2) as "maxTeam" FROM (SELECT count("UserId") as count FROM "TeamMembers" GROUP BY "TeamId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getAvgMem?', function (req, res) {
        successMessage = "retrieved avg occupancy";
        failedMessage = "failed to retrieve avg occupancy";
        dbQuery = 'SELECT round(avg(count), 2) as "avgMem" FROM (SELECT count("TenantId") as count FROM "Leasing" GROUP BY "SpaceId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getMaxMem?', function (req, res) {
        successMessage = "retrieved highest occupancy";
        failedMessage = "failed to retrieve highest occupancy";
        dbQuery = 'SELECT round(max(count), 2) as "maxMem" FROM (SELECT count("TenantId") as count FROM "Leasing" GROUP BY "SpaceId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getAvgCrtn?', function (req, res) {
        successMessage = "retrieved avg # of spaces created";
        failedMessage = "failed to retrieve avg # of spaces created";
        dbQuery = 'SELECT round(avg(count), 2) as "avgCrtn" FROM (SELECT count("SpaceId") as count FROM "Space" GROUP BY "OwnerId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
    app.get('/getMaxCrtn?', function (req, res) {
        successMessage = "retrieved max # of spaces created";
        failedMessage = "failed to retrieve max # of spaces created";
        dbQuery = 'SELECT round(max(count), 2) as "maxCrtn" FROM (SELECT count("SpaceId") as count FROM "Space" GROUP BY "OwnerId") as counts';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
    
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
            //console.log('executing a query '+values);

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

                    var jsonString = {};
                    jsonString.results = result.rows;
                    res.write(JSON.stringify(jsonString, 0, 4));
                    res.end();
                }
            });
        });
    }

};
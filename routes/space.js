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

module.exports = function (app) {

	
	/*
		Get to view space info, gets both space info and rating info
		And then send the results to renderSpace
	*/
	app.get('/space-info.html', function (req, res) {
    if(typeof req.query.spaceId == 'undefined' || typeof req.query.joined == 'undefined') {
        res.end();
    }
    req.session.joined = req.query.joined;

    var getQuery = 'SELECT *, $1::integer AS LikeDislike FROM "Space" WHERE "SpaceId" = $2';

    var getSuccessMessage = 'Successfully retrieved space info';
    var getFailedMessage = 'Could not retrieve space info';
    
	//Rating Query
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
            var currentRating;
            if (typeof result[0] == 'undefined') {
                currentRating = null;
            } else {
                currentRating = result[0].LikeDislike;
            }
            
            var values = [];
            values.push(currentRating);
            values.push(req.query.spaceId);

            executeQuery(res, req, getSuccessMessage, getFailedMessage, getQuery, values, renderSpaceInfo);

        });
	});
});


// Helper function: Renders for space-info.html GET
// Does some queries before rendering data
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

        /* Unable to connect to database */
        query.on('error', function (err) {
            res.send('Query Error ' + err);
        });
        
        query.on('row', function (row) {
            result.push(row);
        });

		//Get leasing info
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
				res.render('space-info.html', {occupying:occupying,spaceInfo: spaceResult.rows[0], teamsInfo : result, currentUser: req.session.joined, user:req.session.uid});
			//res.end();
			});
		});
		
	});
  
	};
	
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
            
            if(!(typeof results_handler == 'undefined')) {
                results_handler(result, res, req);

            } else {
                res.writeHead(200, {'Content-Type': 'text/plain'});

                var jsonStuff = {};
                jsonStuff.results = result.rows;
                console.log(jsonStuff.results);
                res.write(JSON.stringify(jsonStuff, 0, 4));
                res.end();
            }
        });
    });
}
}
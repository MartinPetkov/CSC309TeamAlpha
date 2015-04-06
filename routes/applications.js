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

/* User can express preference in favour or against a space (like or dislike function) */
module.exports = function (app) {

	//Post for space occupation application, enters request in the "Applications" Table 
	app.post('/apply-space', function(req, res){
		var user = req.session.uid;
		var space = req.body.spaceId;
		var values = [];
		values.push(req.session.uid)
		values.push(req.body.spaceId);
		values.push(req.body.fromDate);
		values.push(req.body.toDate);

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
				
				
				query2.on('error', function (err) {
					res.send('Query Error ' + err);
				});
			
				query2.on('row', function (row) {
					result2.push(row);
				})
				query2.on('end', function () {
					if (req.body.response=="accepted"){
						var fromDate1 = new Date(fromDate);
						var toDate1  = new Date(toDate);
						dateHack1 =''+(fromDate1.getYear()-100+2000)+'-'+(fromDate1.getMonth()+1)+'-'+fromDate1.getDate();
						dateHack2 =''+(toDate1.getYear()-100+2000)+'-'+(toDate1.getMonth()+1)+'-'+toDate1.getDate();
						var insertQuery = 'INSERT INTO "Leasing" ("SpaceId", "FromDate", "TenantId", "ToDate", "NegotiatedPricePerDay") SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT "TenantId", "SpaceId" FROM "Leasing" WHERE "TenantId" = $3 AND "SpaceId"= $1)';
						var query3 = client.query(insertQuery, [req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price], function(err, result){});
						
						
						query3.on('error', function (err) {
							res.send('Query Error ' + err);
						});
					
						query3.on('row', function (row) {
							result3.push(row);
						})
						query3.on('end', function(){
							var updateQuery = 'UPDATE "Leasing" SET "SpaceId"=$1, "FromDate"=$2, "TenantId"=$3, "ToDate"=$4, "NegotiatedPricePerDay"=$5 WHERE "TenantId" = $3 AND "SpaceId" = $1';
							var query4 = client.query(updateQuery, [req.body.spaceId, dateHack1, req.body.tenant, dateHack2, req.body.price], function(err, result){});
							
							
							query4.on('error', function (err) {
								res.send('Query Error ' + err);
							});
						
							query4.on('row', function (row) {
								result4.push(row);
							})
							query4.on('end', function(){
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
		res.redirect('/postings.html');
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
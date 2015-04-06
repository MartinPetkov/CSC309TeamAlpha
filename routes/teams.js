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
	
	/*
		Get a team with the given ID, and pass the results into renderTeam helper function
	*/
	app.get('/getTeam:id?',function(req, res){
		var teamId = req.params.id;
		var selectQuery = 'Select * FROM "Teams" NATURAL JOIN "User" NATURAL JOIN "Space" where "TeamId"=$1';
		values=[teamId];
		
		var successMessage = 'Succesfully Selected from Teams',
			failedMessage  = 'Could not select from teams;';

		executeQuery(res, req, successMessage, failedMessage, selectQuery, values, renderTeam);
	});
	
	//Render Team Info
	function renderTeam(teamResult, res, req){
		res.render('team-info.html', {teamInfo:teamResult.rows[0], user:req.session.uid});
		
	};
	/*
		Post to Apply to a team, redirects to the team the user applied to
	*/
	app.post('/apply-team', function(req, res){
	
		//Insert into TeamMembers if this user isn't already part of the team
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
				
				//Create the link using the teamId from the application link
				var link = '/getTeam'+req.body.teamId;
				res.redirect(link);
			});
		});
	});

	/*
		Post to leave a team, delete the user from the "TeamMembers" table in the DB
	*/
	app.post('/leave-team', function(req, res){
		var values = [];
		values.push(req.body.user);
		values.push(req.body.teamId);
		var dbQuery = 'DELETE FROM "TeamMembers" WHERE "UserId"=$1 AND "TeamId"=$2';
		
		var successMessage = 'Successfully removed from TeamMembers',
		failedMessage = 'Culd not remove from TeamMembers';
		
		executeQuery(res, req, successMessage, failedMessage, dbQuery, values, leaveTeam);
	});
	
	/*
		Callback to handle leave team, redirect to postings.html
	*/
	function leaveTeam (result, res, req){
		res.redirect('/');
	};
	
	/*
		Initial get to create a team
		Gets info from Leasing Join Space and sends the result to renderCreateTeams
	*/
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
	
	/*
		Callback to render results from create-team get (displays about teams user is leasing
	*/
	function renderCreateTeams(result, res, req){
		res.render('create-team.html', {space:result.rows, currUser:req.session.uid});
		res.end();
	};
	
	/*
		Post to create a team
		inserts the team into the table "Teams" in the db
	*/
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

	/*
		Redirect after creating a team, to postings
	*/
	function redirectCreateTeam(req, res){
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

                var jsonShit = {};
                jsonShit.results = result.rows;
                console.log(jsonShit.results);
                res.write(JSON.stringify(jsonShit, 0, 4));
                res.end();
            }
        });
    });
}
}
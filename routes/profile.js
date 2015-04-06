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
   /* Get user info
   This one has the specific function of being for viewing only YOUR info (including spaces)
   And allowing the user to change their information
   If no ID is provided, the app assumes you are trying to view/change your info */
	app.get('/getUserInfo', function (req, res) {
		var values = [];

		// Check if user is logged in
		 if (req.session.user) {
			// User is logged in, do queries
			values.push(req.session.user);
			var getQuery = 'SELECT * FROM "User" WHERE "Email" = $1';

			var getSuccessMessage = 'Successfully retrieved user info';
			var getFailedMessage = 'Could not retrieve user info';
			executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values, get_thisUserInfo);

		// If not redirect to home page
		} else {
			res.redirect('/');
		}
	});
	
	/* This getUserInfo is for when a user wants to view another user's info
   Just displays their basic user info and spaces
   So user's cant edit other user's info */
	app.get('/getUserInfo:id?', function(req, res){
		var values = [];
		var id = req.params.id;
		//values.push(req.get('userId'));
		values.push(id);
		var getQuery = 'SELECT * FROM "User" WHERE "UserId" = $1';

		var getSuccessMessage = 'Successfully retrieved user info';
		var getFailedMessage = 'Could not retrieve user info';
		executeQuery(res,req, getSuccessMessage, getFailedMessage, getQuery, values, get_userInfo);

	});
	
	
	/* Helper function: Callback for getting/changing your own user info
	   There is another callback for viewing another users info and they both
	   converge on getting the info about spaces the user owns
	   Gets info about the spaces they are leasing */
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

			//Find the info on spaces the user is currently leasing
			var query = client.query('SELECT * FROM "Leasing" NATURAL JOIN "Space" WHERE "TenantId"=$1', [currUser]);
			query.on('error', function (err) {
				res.send('Query Error ' + err);
			});

			var spaceFound = false;
			query.on('row', function (row) {
				spaceFound = true;
				currSpace = row.SpaceId;
				spaceResult.push(row);
			});

			query.on('end', function () {
				//If the user is occupying a space
				if (spaceFound){
					client.end();
					var opt = {currUser:true,spaceFound:true};

					//Pass info on spaces user is currently leasing to convergent get_userOwnerInfo
					get_userOwnerInfo(res, req, result.rows, spaceResult, opt, currUser);

				}else{
					//The user is not occupying a space
					client.end();
					var opt = {currUser:true,spaceFound:false};

					//Pass info on spaces user is currently leasing to convergent get_userOwnerInfo
					get_userOwnerInfo(res, req, result.rows, [], opt, currUser);

				}
			});
		});
	}

	/* Helper function: Both callbacks for getting your user info and getting someones else user info converge
	   here, this is where we actually render the page with all the relevant data
	   This is also where we get info on spaces the user owns */

	function get_userOwnerInfo(res, req, profileResult, tSpace, opt, user){
		var ownerResult = [],
			result = [];
		var isOwner = false;
		var client = new pg.Client(conString);
		
		var getRatingQuery = 'SELECT * FROM "UserRating" WHERE "UserId"= $1 AND "FriendUserId"= $2';
		
		
		client.connect(function(err, done){
			if (err){
				res.send('sorry, there was an connection error', err);
			}
			
			var query = client.query(getRatingQuery,[req.session.uid, user]);
			query.on('error', function(err){
				res.send('Query Error ' + err);
			});
			
			query.on('row', function(row){
				result.push(row);
			});
			query.on('end', function(){
				client.end();
		
				var currentRating;
				if (typeof result[0] == 'undefined') {
					console.log('empty');
					currentRating = null;
				} else {
					console.log(result.rows);
					currentRating = result[0].LikeDislike;
				}
				console.log('Rating: ' + currentRating);
				
				var client2 = new pg.Client(conString);
				client2.connect(function(err, done){
					if (err){
						res.send('sorry, there was an connection error', err);
					}
					var ownerQuery = client2.query('Select * FROM "Space" WHERE "OwnerId"=$1',[user]);
					ownerQuery.on('error', function(err){
						res.send('Query Error ' + err);
					});
					ownerQuery.on('row', function(row){
						ownerResult.push(row);
						isOwner = true;
					});
					ownerQuery.on('end', function(){
						client2.end();
						console.log('owner space likedislike: ' + ownerResult.likedislike);
						res.render('profile.html', {profile:profileResult, opt:opt, tennantSpace:tSpace, ownerSpace:ownerResult,Owner:isOwner, likedislike: currentRating});
						res.end();
					});
				});
			});
		});
	}


	/* Helper function: Callback for viewing another user's info
	   Gets info about the spaces they are leasing */
	function get_userInfo(result, res, req){
		//var currEmail = req.session.email;
		var viewUser = result.rows[0].UserId;
		//console.log('get user info func');
		//var opt = {currUser:false};
		var spaceResult = [];
		var client = new pg.Client(conString);
		var currSpace = '';
		client.connect(function (err, done) {
			if (err) {
				return console.error('could not connect to postgres', err);
				res.send('sorry, there was an error', err);
			}
			var query = client.query('SELECT * FROM "Leasing" NATURAL JOIN "Space" WHERE "TenantId"=$1', [viewUser]);
			query.on('error', function (err) {
				res.send('Query Error ' + err);
			});

			var spaceFound = false;
			query.on('row', function (row) {
				spaceFound = true;
				currSpace = row.SpaceId;
				spaceResult.push(row);
			});
			query.on('end', function(){
				if (spaceFound){
					var opt = {currUser:false,spaceFound:true};
					client.end();
					get_userOwnerInfo(res, req, result.rows,spaceResult,opt, viewUser);


				}else{
					//The user is not occupying a space
					client.end();
					var opt = {currUser:false,spaceFound:false};
					get_userOwnerInfo(res, req, result.rows,[],opt, viewUser);

				}
			});
		});
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
}
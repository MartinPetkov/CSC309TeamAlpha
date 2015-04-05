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
    app.post('/addUpdateRating', function (req, res) {
        console.log('In addUpdateRating' + req.body.rating);

        var client = new pg.Client(conString),
            result = [],
            result2 = [],
            dbQuery = 'INSERT INTO "SpaceRating" ("UserId", "SpaceId", "LikeDislike") SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT "UserId","SpaceId" FROM "SpaceRating" WHERE "UserId" = $4 AND "SpaceId"= $5) RETURNING "SpaceId"';

        client.connect(function (err, done) {
            /* Unable to connect to postgreSQL server */
            if (err) {
                res.writeHead(500);
                console.log('Unable to connect to database');
            }

            var query = client.query(dbQuery, [req.session.uid, req.body.spaceId, req.body.rating, req.session.uid, req.body.spaceId], function(err, result){});

            /* Unable to connect to database */
            query.on('error', function (err) {
                res.send('Query Error ' + err);
            });

            query.on('row', function (row) {
                result.push(row);
            });

            // Update ratings
            query.on('end', function () {
                client.end();

                /* No new likes/dislikes were added -- user already previously selected a choice */
                if (result.length == 0) {
                    console.log('The like/dislikes were updated not added');


                    /* Update the user's choice of either like or dislike for this particular idea */
                    var values2 = [];
                    values2.push(req.body.rating);
                    values2.push(req.session.uid);
                    values2.push(req.body.spaceId);

                    var updateQuery = 'UPDATE "SpaceRating" SET "LikeDislike" = $1 WHERE "UserId"=$2 AND "SpaceId"=$3  RETURNING "SpaceId"';

                    var client2 = new pg.Client(conString);
                    client2.connect(function (err, done) {
                        /* Unable to connect to postgreSQL server */
                        if (err) {
                            res.writeHead(500);
                            console.log('Unable to connect to database');
                        }

                        var query2 = client2.query(updateQuery, values2, function(err, result2){});

                        /* Unable to connect to database */
                        query2.on('error', function (err) {
                            res.send('Query Error ' + err);
                        });

                        query2.on('row', function (row) {
                            result2.push(row);
                        });

                        query2.on('end', function () {
                            client2.end();
                            updateTotalLikesDislikes(res, req, req.body.rating, req.body.spaceId);
                        });
                    });
                } else {
                    console.log('It is a new like/dislike');
                    updateTotalLikesDislikes(res, req, req.body.rating, req.body.spaceId);
                }            
            });
        });    
    });


    /* Update the aggregated likes/dislikes assuming they cannot choose the same choice as previously  */

    function updateTotalLikesDislikes (res, req, rating, spaceId) {
        var updateAllLikesQuery;
        console.log('In updateTotalLikesDislikes. Rating: ' + rating + ' ' + spaceId); 
        if (rating == 0) {
            console.log('Decrement space rating');
            // Decrement total likes   
            var updateAllLikesQuery = 'UPDATE "Space" SET "SpaceTotalRating" = "SpaceTotalRating" - 1 WHERE "SpaceId"=$1 RETURNING "SpaceId"';
        } else {
            // Increment total likes 
            var updateAllLikesQuery = 'UPDATE "Space" SET "SpaceTotalRating" = "SpaceTotalRating" + 1 WHERE "SpaceId"=$1 RETURNING "SpaceId"';

        }

        var successMessage = 'Successfully updated aggregated space rating';
        var failedMessage = 'Could not update aggregated space rating';

        executeQuery(res, req, successMessage, failedMessage, updateAllLikesQuery, [spaceId], reloadSpacePage);
    }



    /* User like/dislike system */
    app.post('/addUpdateRatingUser', function (req, res) {
        console.log('In addUpdateRatingUser' + req.body.rating);

        var client = new pg.Client(conString),
            result = [],
            result2 = [],
            dbQuery = 'INSERT INTO "UserRating" ("UserId", "FriendUserId", "LikeDislike") SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT "UserId","FriendUserId" FROM "UserRating" WHERE "UserId" = $4 AND "FriendUserId"= $5) RETURNING "FriendUserId"';

        client.connect(function (err, done) {
            /* Unable to connect to postgreSQL server */
            if (err) {
                res.writeHead(500);
                console.log('Unable to connect to database');
            }

            var query = client.query(dbQuery, [req.session.uid, req.body.friendId, req.body.rating, req.session.uid, req.body.friendId], function(err, result){});
            console.log([req.session.uid, req.body.friendId, req.body.rating, req.session.uid, req.body.friendId]);
            /* Unable to connect to database */
            query.on('error', function (err) {
                res.send('Query Error ' + err);
            });

            query.on('row', function (row) {
                result.push(row);
            });

            // Update ratings
            query.on('end', function () {
                client.end();

                /* No new likes/dislikes were added -- user already previously selected a choice */
                if (result.length == 0) {
                    console.log('The like/dislikes were updated not added');


                    /* Update the user's choice of either like or dislike for this particular idea */
                    var values2 = [];
                    values2.push(req.body.rating);
                    values2.push(req.session.uid);
                    values2.push(req.body.friendId);

                    var updateQuery = 'UPDATE "UserRating" SET "LikeDislike" = $1 WHERE "UserId"=$2 AND "FriendUserId"=$3  RETURNING "FriendUserId"';

                    var client2 = new pg.Client(conString);
                    client2.connect(function (err, done) {
                        /* Unable to connect to postgreSQL server */
                        if (err) {
                            res.writeHead(500);
                            console.log('Unable to connect to database');
                        }

                        var query2 = client2.query(updateQuery, values2, function(err, result2){});

                        /* Unable to connect to database */
                        query2.on('error', function (err) {
                            res.send('Query Error ' + err);
                        });

                        query2.on('row', function (row) {
                            result2.push(row);
                        });

                        query2.on('end', function () {
                            client2.end();
                            updateTotalLikesDislikesUser(res, req, req.body.rating, req.body.friendId);
                        });
                    });
                } else {
                    console.log('It is a new like/dislike');
                    updateTotalLikesDislikesUser(res, req, req.body.rating, req.body.friendId);
                }            
            });
        });    
    });

    /* Update the aggregated likes/dislikes assuming they cannot choose the same choice as previously  */
    function updateTotalLikesDislikesUser (res, req, rating, friendId) {
        var updateAllLikesQuery;
        console.log('In updateTotalLikesDislikes. Rating: ' + rating + ' ' + friendId); 
        if (rating == 0) {
            console.log('Decrement user rating');
            // Decrement total likes   
            var updateAllLikesQuery = 'UPDATE "User" SET "UserTotalRating" = "UserTotalRating" - 1 WHERE "UserId"=$1 RETURNING "UserId"';
        } else {
            // Increment total likes 
            var updateAllLikesQuery = 'UPDATE "User" SET "UserTotalRating" = "UserTotalRating" + 1 WHERE "UserId"=$1 RETURNING "UserId"';

        }

        var successMessage = 'Successfully updated aggregated user rating';
        var failedMessage = 'Could not update aggregated user rating';

        executeQuery(res, req, successMessage, failedMessage, updateAllLikesQuery, [friendId], reloadUserPage);
    }


    function reloadUserPage(result, res, req) {
        res.redirect('/getUserInfo' + result.rows[0].UserId);
        res.end();
    }



    function reloadSpacePage(result, res, req) {

        console.log('In reloadIdeaPage: ' + result);
        console.log(result.rows[0].SpaceId);

        res.redirect('/space-info.html?spaceId=' + result.rows[0].SpaceId + '&joined=true');
        res.end();

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
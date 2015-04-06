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
        executeQuery(res, req, insertSuccessMessage, insertFailedMessage, insertQuery, values, redirectPostings);
    });

    
    function redirectPostings(req, res){
		res.redirect('/postings.html');
	};
    
    
    // Helper functions
    // Return a list of $i for query parametrization, to escape bad characters
    function createParams(len) {
        var params = [];
        for(var i = 1; i <= len; i++) {
            params.push('$' + i);
        }
        return params.join(',');
    }

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
            keywordsList = keywordsList.replace(/( *, *)|( +)/g, ',').split(',');
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
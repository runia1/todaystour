/**
 * Created by mar on 12/20/16.
 */
let jwtKey = require('../keys/jwt.json');
let facebookKey = require('../keys/facebook.json');
let express = require('express');
let jwt = require('express-jwt');
let bodyParser = require('body-parser');
let cors = require('cors');
let fs = require('fs');
let util = require('util');
let requestPromise = require('request-promise-native');
let tz = require('tz-lookup');
let moment = require('moment-timezone');
let EventSearch = require("facebook-events-by-location-core");

let headerMiddleware = (req, res, next) => {
  if(req.header('content-type') === 'application/json') {
    if(req.header('accept') === 'application/json') {
      next();
    } else {
      res.status(406).send({
        status: 406,
        result: "error",
        reason: "Accept header not set to application/json"
      });
    }
  } else {
    res.status(415).send({
      status: 415,
      result: "error",
      reason: "Content-Type header not set to application/json"
    });
  }
};

let errorHandlerMiddlware = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send({
      status: 401,
      result: "error",
      reason: "Authorization header not set with a valid JWT"
    });
  } else {
    res.status(502).send({
      status: 502,
      result: "error",
      reason: err.message
    });
  }
};

let getTimeFromDate = (dateString, timezone) => {
  let d = moment(dateString).tz(timezone);
  return d.hours()+":"+d.minutes();
};

let mongoClient = require('mongodb').MongoClient;
let mongoCredentials = require('../keys/mongoDB.json');
let mongoUrl = 'mongodb://'+mongoCredentials.user+':'+mongoCredentials.pwd+'@localhost:27017/todaystour?authMechanism='+mongoCredentials.authMechanism+'&authSource='+mongoCredentials.authSource;
let runQuery = (cb) => {
  mongoClient.connect(mongoUrl, (err, db) => {
    if(err) {
      console.log('Error connecting to database.');
    } else {
      cb(db);
    }
  });
};

module.exports = () => {
  let router = express.Router();

  //handle all request method types and paths that come in to the api with these middlewares
  router.all('/*',
    cors(),                             //handle cross origin requests
    /*jwt({secret: keys.jwt_key }),       //make sure it has a valid jwt */
    headerMiddleware,                   //make sure headers sent are correct
    bodyParser.json()                   //parse body as JSON
  );

  // define the home page route
  router.get('/', (req, res) => {
    res.send('api/v1 is active');
  });

  // define the stops route
  router.route('/stops')
    .get((req, res, next) => {
      let lat = req.query.lat;
      let lng = req.query.lng;
      let distance = req.query.distance || 10;
      let city = req.query.city;
      let state = req.query.state;

      let getStops = (lat, lng) => {
        let clientTimezone = tz(lat, lng);
        let now = moment.utc(); //now in UTC time
        now.tz(clientTimezone); //convert to the time in the provided timezone
        let clientTimezoneOffset = now.utcOffset() * 60; //client timezone offset in seconds
        let clientsSecondsOffset = now.hours() * 3600 + now.minutes() * 60; //how many seconds from beginning of day in clients time
        let nowUTCOffset = clientsSecondsOffset + clientTimezoneOffset; //the current time in the clients timezone offsetted to UTC time.
        let todaysDate = new Date(now.format('YYYY-MM-DD'));

        //Get events from database
        let dbEvents = false;
        runQuery((db) => {
          db.collection('stops').find({
            $and: [
              /*{startTimeUTCOffset: {$lte: nowUTCOffset}}, we want events going on later today to be returned */
              {endTimeUTCOffset: {$gte: nowUTCOffset}},
              {startDate: {$lte: todaysDate}},
              {endDate: {$gte: todaysDate}},
              {loc:{$near:{$geometry: {type: "Point", coordinates: [Number(lng), Number(lat)]}, $maxDistance: distance * 1609.34}}}
            ]
          }).toArray((err, docs) => {
            if(err) {
              console.log(err);
              next(new Error('Unable to get tour stops from database.'));
            } else {
              dbEvents = docs;
              sendResults();
            }
            db.close();
          });
        });

        //Get events from facebook
        let facebookEvents = null;
        let fes = new EventSearch({
          "lat": lat,
          "lng": lng,
          "accessToken": facebookKey.appId+'|'+facebookKey.appSecret,
          "distance": distance * 1609.34, //meters per mile
          "since": now.subtract(3, 'hours').unix(),
          "until": now.endOf('day').unix()
        });

        fes.search().then((result) => {
          facebookEvents = result.events;
          sendResults();
        }).catch((error) => {
          console.log(error);
          next(new Error('Unable to get tour stops from facebook.'));
        });

        let sendResults = () => {
          //if both results are back, combine and send.
          if(facebookEvents && dbEvents) {
            //format facebook events to look like db events.
            let formattedFBEvents = [];
            for(let i=0; i<facebookEvents.length; i++) {
              let fbe = facebookEvents[i];
              formattedFBEvents.push({
                title: fbe.name || '',
                description: fbe.description || '',
                startDate: fbe.startTime,
                endDate: fbe.endTime,
                startTime: getTimeFromDate(fbe.startTime, clientTimezone),
                endTime: getTimeFromDate(fbe.endTime, clientTimezone),
                name: fbe.venue.name,
                address: fbe.venue.location.street,
                city: fbe.venue.location.city,
                state: fbe.venue.location.state,
                zip: fbe.venue.location.zip,
                loc: {
                  type: "Point",
                  coordinates: [fbe.venue.location.longitude, fbe.venue.location.latitude]
                },
                startTimeUTCOffset: 0,
                endTimeUTCOffset: 0
              });
            }

            res.send({
              "result": "success",
              "data": dbEvents.concat(formattedFBEvents)
            });
          }
        };
      };

      if(city && state) {
        //grab the lat + lng from google's api.
        let geocodingEndpoint = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDpzZOg6yUToT3eDzfk-vd1hXB-2APIdv4&address="+ encodeURI(city+", "+state);
        requestPromise.get(geocodingEndpoint).then((response) => {
          response = JSON.parse(response);
          if(!response.results.length) {
            next(new Error('No city with this name found.'));
          } else {
            let result = response.results[0];
            getStops(result.geometry.location.lat, result.geometry.location.lng);
          }
        });
      } else if(lat && lng) {
        getStops(lat, lng);
      } else {
        //TODO: try to get their lat+lng by ip lookup?
      }
    })
    .put(function(req, res, next) {
      //TODO: implement
    });

  router.route('/stop')
    .get((req, res, next) => {
      //TODO: hook up to mongoDB
      res.send([{"id": 1, "title": "Max's House"}]);
    })
    .post((req, res, next) => {
      let data = req.body;

      //validate that they sent all the required data.
      let required = ['title','description','startDate','endDate','startTime','endTime','name','address','city','state','zip'];
      required.forEach((key) => {
        if(!data.hasOwnProperty(key) || !data[key]) {
          next(new Error('The provided data is missing the key: ' + key));
        }
      });

      //grab the lat + lng from google's api.
      let geocodingEndpoint = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDpzZOg6yUToT3eDzfk-vd1hXB-2APIdv4&address="+ encodeURI(data.address+", "+data.city+", "+data.state);
      requestPromise.get(geocodingEndpoint).then((response) => {
        response = JSON.parse(response);
        if(!response.results.length) {
          next(new Error('No location with this address found.'));
        }

        let result = response.results[0];
        data.loc = {
          type: "Point",
          coordinates: [result.geometry.location.lng, result.geometry.location.lat]
        };

        let timezone = tz(result.geometry.location.lat, result.geometry.location.lng); //use tz-lookup to find the timezone.
        let localStartTime = moment.tz(data.startDate+"T"+data.startTime+":00", timezone);
        let clientTimezoneOffset = localStartTime.utcOffset() * 60;
        let clientsSecondsOffset = localStartTime.hours() * 3600 + localStartTime.minutes() * 60; //how many seconds from beginning of day in local time
        data.startTimeUTCOffset = clientsSecondsOffset + clientTimezoneOffset;


        let localEndTime = moment.tz(data.startDate+"T"+data.endTime+":00", timezone);
        clientTimezoneOffset = localEndTime.utcOffset() * 60;
        clientsSecondsOffset = localEndTime.hours() * 3600 + localEndTime.minutes() * 60; //how many seconds from beginning of day in local time
        data.endTimeUTCOffset = clientsSecondsOffset + clientTimezoneOffset;

        data.startDate = new Date(data.startDate);
        data.endDate = new Date(data.endDate);

        //Insert into the database.
        runQuery((db) => {
          db.collection('stops').insert(data, (err, result) => {
            if(err) {
              next(new Error('Unable to insert tour stops in database.'));
            } else {
              res.send({"result": "success"});
            }
            db.close();
          });
        });
      }).catch((error) => {
        next(new Error('No location with this address found.'));
      });
    })
    .put((req, res) => {

    })
    .delete((req, res) => {

    });

  //handle any errors thrown
  router.use(errorHandlerMiddlware);

  return router;
};
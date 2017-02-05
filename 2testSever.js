/**
 * Created by mar on 1/15/17.
 */

let EventSearch = require("facebook-events-by-location-core");
let moment = require('moment-timezone');
let now = moment.utc(); //now in UTC time
now.tz("America/Boise"); //convert to the time in the provided timezone
let start = now.unix();
let end = now.endOf('day').unix();


let getTimeFromDate = (dateString, timezone) => {
  let d = moment(dateString).tz(timezone);
  return d.hours()+":"+d.minutes();
};

let prettyTime = (time) => {
  let tArray = time.split(':');
  let suffix = tArray[0] < 12 ? "AM" : "PM";
  let hour = tArray[0] > 12 ? tArray[0] - 12 : (tArray[0] ? tArray[0] : 12);
  return hour+":"+tArray[1]+" "+suffix;
};

let es = new EventSearch({
  "lat": 43.6274050,
  "lng": -116.2256850,
  "accessToken": "1332010643522643|49450dce166f214bede8b335424a2e53",
  "distance": Math.round(10 * 1609.34), //meters per mile
  "since": start,
  "until": end
});
es.search().then((result) => {
  let events = result.events;
  for(let i=0; i<events.length; i++) {
    let fbe = events[i];
    console.log(fbe.name);

    let start = fbe.startTime,
      end = fbe.endTime;
    console.log(start);
    console.log(end);

    //get the time.
    start = getTimeFromDate(start, "America/Boise");
    end = getTimeFromDate(end, "America/Boise");
    console.log(start);
    console.log(end);

    //pretty format time
    start = prettyTime(start);
    end = prettyTime(end);
    console.log(start);
    console.log(end);

    console.log();
  }

}).catch((error) => {
  console.error(error);
});
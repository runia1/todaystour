/**
 * Created by mar on 12/27/16.
 */

/*
* MongoDB index values
*  1 : orders items in ascending order
* -1 : orders items in descending order
*
*
*
*
*/

db.stops.createIndex({city: "text"});
db.stops.createIndex({city: "text", state: "text"});
db.stops.createIndex({ loc : "2dsphere" });
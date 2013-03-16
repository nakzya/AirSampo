var mongoose = require('mongoose');
var db = mongoose.connect('mongodb://localhost/airsampo');

function validator(v) {
  return v.length > 0;
}

var User = new mongoose.Schema({
  name     : {type: String, required: true},
  email    : {type: String, required: true},
  password : {type: String, required: true},
  created  : {type: Date, default: Date.now}
});
exports.User = db.model("User", User);

// 位置情報
var Position = new mongoose.Schema({
  lat      : {type: Number, required: false},
  lng      : {type: Number, required: false},
  heading  : {type: Number, required: false},
  pitch    : {type: Number, required: false},
  zoom     : {type: Number, required: false},
  distance : {type: Number, required: true}
});
exports.Position = db.model("Position", Position);

// コース情報
var Course = new mongoose.Schema({
  owner         : {type: String, required: true, default: "anonymous"},
  title         : {type: String, required: true},
  description   : {type: String, required: false, default: ""},
  position      : {type: [Position]},
  firstPosition : {type: [Position]},  // Modelをネストする場合は配列にする必要あり
  tag           : {type: [String]},
  link          : {type: [String]},
  playCount     : {type: Number, min: 0, default: 0},
  created       : {type: Date, default: Date.now}
});
exports.Course = db.model("Course", Course);

// 再生履歴情報
var PlayHistory = new mongoose.Schema({
  course_id : {type: String, required: true},
  datetime  : {type: Date, default: Date.now},
  playedby  : {type: String, required: true}
});
exports.PlayHistory = db.model("PlayHistory", PlayHistory);

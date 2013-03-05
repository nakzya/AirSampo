
/*
 * GET home page.
 */
 
var url = require("url");

exports.index = function(req, res) {
  res.render('index', {});
};

exports.play = function(req, res) {
  res.render('play', {no: req.query.no});
}

exports.record = function(req, res) {
  res.render('record', {});
}
var url = require("url");
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var model = require("../model");
var Course = model.Course;
var PlayHistory = model.PlayHistory;
var util = require("../util");


//////////////////////////////////////////////////////////////////////////////////////////////
// 再生画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.play = function(req, res) {
  var _id = req.query._id;
  res.render("play", {userName: util.getUserNameFromSession(req), _id: _id});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生回数をインクリメント
//////////////////////////////////////////////////////////////////////////////////////////////
exports.incrementPlayCount = function(req, res) {
  var _id = req.query._id;
  Course.findOne({_id: new ObjectId(_id)}, function(err, course) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      Course.update(
        {'_id': new ObjectId(_id)},
        {$set: {playCount: course.playCount + 1}},
        {upsert: false},
        function (err, updateCnt) {
          if (err){
            console.log('err : ' + err);
          }
        }
      );
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生履歴を登録
//////////////////////////////////////////////////////////////////////////////////////////////
exports.playHistory = function(req, res) {
  var _id = req.query._id;
  if (_id) {  // 記録確定前の場合、undefinedのため再生履歴を登録しない
    var playHistory = new PlayHistory({
      course_id: _id,
      playedby : 'anonymous'  // TODO 暫定
    });

    playHistory.save(function(err, course) {
      if (err) {
        console.log(err);
        res.redirect('back');
      }
    });
  }
}
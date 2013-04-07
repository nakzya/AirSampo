var url = require("url");
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var model = require("../model");
var Course = model.Course;
var Position = model.Position;
var Category = model.Category;
var PlayHistory = model.PlayHistory;
var util = require("../util");


//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.index = function(req, res) {
  res.render("index", {userName: util.getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面 - マップ検索用のコースを修得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.mapSearch = function(req, res) {
  Course.find(
    {privateFlg: false},  // private以外の全件、ただし件数が多い場合は要検討
    util.getCourseWithoutPositions(),  // positions以外
    {},
    function(err, courses) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json(courses);
      }
    }
  );
}

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面 - ランダムなコースの再生画面を表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.randomCourse = function(req, res) {
  Course.count(  // private以外の全件の件数を取得
    {privateFlg: false},
    function(err, count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        // ランダム番目のコースの_idを取得し、再生画面を表示
        var randomIdx = Math.floor(Math.random() * Number(count) + 1);
        var options = {skip: randomIdx, limit: 1};
        Course.find(
          {privateFlg: false}, {"_id": 1}, options, function(err, courses) {
            if (err) {
              console.log(err);
              res.redirect('back');
            } else {
              var course = courses[0];
              res.redirect("/play?_id=" + course._id);
            }
          }
        );
      }
    }
  );
}

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面 - コースのサムネイルを取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.courseThumbnail = function(req, res) {
  // 過去30日間の再生回数を集計し、その結果を以下のcallback関数に渡す
  util.playHistoryCount(30, function(err, data) {
    if (err) {
      console.log("error: " + err);
    }
    if (!data || data.length == 0) return;

    // countの降順にsort
    data.sort(function(data1, data2){
      if (data1.value.count < data2.value.count) return 1;
      if (data1.value.count > data2.value.count) return -1;
      return 0;
    });

    //for (var i = 0; i < data.length; i++) {
    //  console.log("courseThumbnail_" + i + " : " + data[i]._id + " : " + data[i].value.count);
    //}

    var conditions = '{"$or": [';
    for (var i = 0; i < data.length - 1; i++) {
      conditions += '{"_id": "' + data[i]._id + '"},';
    }
    conditions += '{"_id": "' + data[data.length - 1]._id + '"}], "privateFlg": false}';  // privateFlgはBooleanのためfalseを""で囲ってはいけない
    conditions = JSON.parse(conditions);

    var page = req.query.page;
    if (!page) page = 1;
    var skip = (page - 1) * 4;

    Course.find(
      conditions,
      util.getCourseWithoutPositions(),  // positions以外
      {skip: skip, limit: 4},
      function(err, courses) {
        if (err) {
          console.log(err);
          res.redirect('back');
        } else {
          res.json(courses);
        }
      }
    );
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 新着（サイドバー）
//////////////////////////////////////////////////////////////////////////////////////////////
exports.newArrivalSB = function (req, res) {
  // 直近1週間で登録されたコース
  var today = new Date();
  var targetDate = util.computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), -7);
  conditions = {created: {$gte: targetDate}, privateFlg: false};

  Course.find(
    conditions,
    util.getCourseWithoutPositions(),  // positions以外
    {sort: {"created": -1}, limit: 5},
    function(err, courses) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json(courses);
      }
    }
  );
};

//////////////////////////////////////////////////////////////////////////////////////////////
// おすすめ（サイドバー）
//////////////////////////////////////////////////////////////////////////////////////////////
exports.recommendSB = function(req, res) {
  Course.find(
    {privateFlg: false},
    util.getCourseWithoutPositions(),  // positions以外
    {"sort": {"playCount": -1}, "limit": 5},
    function(err, courses) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json(courses);
      }
    }
  );
}

//////////////////////////////////////////////////////////////////////////////////////////////
// プライバシーポリシー画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.privacy = function(req, res) {
  res.render('privacy', {userName: util.getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 利用規約画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.rules = function(req, res) {
  res.render("rules", {userName: util.getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 「このサイトについて」画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.about = function(req, res) {
  res.render("about", {userName: util.getUserNameFromSession(req)});
};





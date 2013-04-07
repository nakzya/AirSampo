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
// カウント
//////////////////////////////////////////////////////////////////////////////////////////////
exports.count = function(req, res) {
  var mode = req.query.mode;
  var count = 0;

  // modeによってカウントを取得する条件を変更
  if (mode == "top") {
    if (!req.query.back) return;
    var back = req.query.back;  // 直近何日間の件数を取得するか

    // 過去N日間の再生回数を集計し、その結果を以下のcallback関数に渡す
    util.playHistoryCount(back, function(err, data) {
      if (err) {
        console.log("error: " + err);
      }
      if (!data || data.length == 0) return;

      //for (var i = 0; i < data.length; i++) {
      //  console.log("ranking_" + i + " : " + data[i]._id + " : " + data[i].value.count);
      //}

      // privateをremoveしてcount
      var conditions = '{"$or": [';
      for (var i = 0; i < data.length - 1; i++) {
        conditions += '{"_id": "' + data[i]._id + '"},';
      }
      conditions += '{"_id": "' + data[data.length - 1]._id + '"}], "privateFlg": false}';  // privateFlgはBooleanのためfalseを""で囲ってはいけない
      conditions = JSON.parse(conditions);

      Course.count(conditions, function(err, count) {
        if (err) {
          console.log(err);
          res.redirect('back');
        } else {
          res.json({"count": count});
        }
      })
    });

  // 検索結果件数を取得
  } else if (mode == "search") {
    if (!req.query.searchWord) return;
    var searchWord = req.query.searchWord;
    Course.count({$or: [{title           : new RegExp('.*' + searchWord + '.*', "i")},  // タイトルと中間一致、または
                       {description      : new RegExp('.*' + searchWord + '.*', "i")},  // 説明文と中間一致、または
                       {tag              : {$all: searchWord}},                         // タグに含まれる、または
                       {link             : {$all: searchWord}},                         // リンクに含まれる
                       {"category.place" : new RegExp('.*' + searchWord + '.*', "i")},  // カテゴリ（場所）に含まれる
                       {"category.kind"  : new RegExp('.*' + searchWord + '.*', "i")}   // カテゴリ（種類）に含まれる
                      ],
                  privateFlg: false},
                function(err, count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json({"count": count});
      }
    });

  // トップ画面の新着件数表示
  } else if (mode == "newArrival") {
    // 直近1週間で登録されたコース
    var today = new Date();
    var targetDate = util.computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), -7);
    conditions = {created: {$gte: targetDate}, privateFlg: false};

    Course.count(conditions, function(err, count) {
        if (err) {
          console.log(err);
          res.redirect('back');
        } else {
          res.json({"count": count});
        }
    })

  // ランキング画面で表示する特定期間の再生回数
  } else if (mode == "ranking") {
    var _id = req.query._id;
    var back = req.query.back;  // 直近何日間の件数を取得するか
    var no = req.query.no;  // レスポンスを返してクライアント側で何番目に表示するか

    var today = new Date();
    var targetDate = util.computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), Number(back) * -1);
    var conditions = {course_id: _id, playedDate: {$gte: targetDate}};

    PlayHistory.count(conditions, function(err,count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json({no: no, count: count});
      }
    });

  // カテゴリーの件数取得
  } else if (mode == "category") {
    var categoryStr = req.query.category;
    if (categoryStr) {
      Course.count(
        {$or: [{"category.place": categoryStr}, {"category.kind": categoryStr}], privateFlg: false},
        function(err, count) {
          if (err) {
            console.log(err);
            res.redirect('back');
          } else {
            res.json({"count": count});
          }
        }
      );
    }

  // マイコースの件数取得
  } else if (mode == "myCourse") {
    var userName = util.getUserNameFromSession(req);
    if (!userName) {  // ログインせずにURL直叩きで記録画面を開こうとした場合
      res.redirect("/");
    }
    if (userName) {
      Course.count(
        {owner: userName},
        function(err, count) {
          if (err) {
            console.log(err);
            res.redirect('back');
          } else {
            res.json({"count": count});
          }
        }
      );
    } else {
      res.redirect('/');
    }

  } else if (mode == "all") {
    Course.count({}, function(err, count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json({"count": count});
      }
    });

  } else if (mode == "allWithoutPrivate") {
    Course.count({privateFlg: false}, function(err, count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json({"count": count});
      }
    });
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 移動位置情報をDBからロード
//////////////////////////////////////////////////////////////////////////////////////////////
exports.loadCourse = function(req, res) {
  var _id = req.query._id;
  var idx = req.query.idx;
  if (_id) {
    loadCourseById(_id, res);
  } else if (idx) {
    loadCourseWithSkip(idx - 1, res);
  }

  /////////////////////////////////////////////////
  // _idでCourseを取得
  /////////////////////////////////////////////////
  function loadCourseById(_id, res) {
    Course.findOne({_id: new ObjectId(_id)}, function(err, course) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json(course);
      }
    });
  }

  /////////////////////////////////////////////////
  // skip指定でCourseを取得
  /////////////////////////////////////////////////
  function loadCourseWithSkip(skip, res) {
    Course.find(
      {privateFlg: false}, null, {skip: skip, limit: 1}, function(err, courses) {
        if (err) {
          console.log(err);
          res.redirect('back');
        } else {
          res.json(courses);
        }
      }
    );
  }
}
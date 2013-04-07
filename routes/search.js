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
// 検索画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.search = function(req, res) {
  res.render('searchResult', {userName: util.getUserNameFromSession(req), searchWord: req.body.txtNavSearch});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 検索処理
//////////////////////////////////////////////////////////////////////////////////////////////
exports.searchResult = function(req, res) {
  var searchWord = req.query.searchWord;
  var page = req.query.page;
  var skip = (page - 1) * 10;
  Course.find({$or: [{title            : new RegExp('.*' + searchWord + '.*', "i")},  // タイトルと中間一致、または
                     {description      : new RegExp('.*' + searchWord + '.*', "i")},  // 説明文と中間一致、または
                     {tag              : {$all: searchWord}},                         // タグに含まれる、または
                     {link             : {$all: searchWord}},                         // リンクに含まれる
                     {"category.place" : new RegExp('.*' + searchWord + '.*', "i")},  // カテゴリ（場所）に含まれる
                     {"category.kind"  : new RegExp('.*' + searchWord + '.*', "i")}   // カテゴリ（種類）に含まれる
                    ],
               privateFlg: false},
              util.getCourseWithoutPositions(),  // positions以外
              {sort: {playCount: -1}, skip: skip, limit: 10},
              function(err, courses) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.json(courses);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.mycourse = function(req, res) {
  var userName = util.getUserNameFromSession(req);
  if (!userName) {  // ログインせずにURL直叩きで記録画面を開こうとした場合
    res.redirect("/");
  }
  res.render("mycourse", {userName: util.getUserNameFromSession(req)});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース結果表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.mycourseResult = function(req, res) {
  var userName = util.getUserNameFromSession(req);
  if (!userName) {  // ログインせずにURL直叩きで記録画面を開こうとした場合
    res.redirect("/");
  }
  var page = req.query.page;
  var skip = (page - 1) * 10;

  if (userName) {
    Course.find(
      {owner: userName},
      util.getCourseWithoutPositions(),  // positions以外
      {sort: {created: -1}, skip: skip, limit: 10},
      function(err, courses) {
        if (err) {
          console.log(err);
          res.redirect('back');
        } else {
          res.json(courses);
        }
      }
    );
  } else {
    res.redirect('/');
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキング画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.ranking = function(req, res) {
  var back = req.query.back;
  res.render('ranking', {userName: util.getUserNameFromSession(req), back: back});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキング画面 - ランキングデータ取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.rankingResult = function(req, res) {
  var back = req.query.back;

  // 過去back日間の再生回数を集計し、その結果を以下のcallback関数に渡す
  util.playHistoryCount(back, function(err, data) {
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
    //  console.log("ranking_" + i + " : " + data[i]._id + " : " + data[i].value.count);
    //}

    var conditions = '{"$or": [';
    for (var i = 0; i < data.length - 1; i++) {
      conditions += '{"_id": "' + data[i]._id + '"},';
    }
    conditions += '{"_id": "' + data[data.length - 1]._id + '"}], "privateFlg": false}';  // privateFlgはBooleanのためfalseを""で囲ってはいけない
    conditions = JSON.parse(conditions);

    var page = req.query.page;
    if (!page) page = 1;
    var skip = (page - 1) * 10;

    Course.find(
      conditions,
      util.getCourseWithoutPositions(),  // positions以外
      {skip: skip, limit: 10},
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
// 新着結果画面
//////////////////////////////////////////////////////////////////////////////////////////////
exports.newArrival = function(req, res) {
  res.render('newArrivalResult', {userName: util.getUserNameFromSession(req)});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 新着結果取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.newArrivalResult = function(req, res) {
  var skip = 0;
  if (req.query.page) {
    skip = (req.query.page - 1) * 10;
  }

  // 直近1週間で登録されたコース
  var today = new Date();
  var targetDate = util.computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), -7);
  conditions = {created: {$gte: targetDate}, privateFlg: false};

  Course.find(
    conditions,
    util.getCourseWithoutPositions(),  // positions以外
    {sort: {"created": -1}, skip: skip, limit: 10},
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
// カテゴリ画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.category = function(req, res) {
  res.render('categoryResult', {userName: util.getUserNameFromSession(req), category: req.query.category});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// カテゴリ検索結果画面
//////////////////////////////////////////////////////////////////////////////////////////////
exports.categoryResult = function(req, res) {
  var categoryStr = req.query.category;
  var page = req.query.page;
  var skip = (page - 1) * 10;

  if (categoryStr) {
    Course.find(
      {$or: [{"category.place": categoryStr}, {"category.kind": categoryStr}], privateFlg: false},
      util.getCourseWithoutPositions(),  // positions以外
      {sort: {created: -1}, skip: skip, limit: 10},
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
}
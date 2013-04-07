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
// 記録画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.record = function(req, res) {
  var userName = util.getUserNameFromSession(req);
  if (!userName) {  // ログインせずにURL直叩きで記録画面を開こうとした場合
    res.redirect("/");
  }

  var _id = req.query._id;
  var title = req.query.title;
  var description = req.query.description;
  if (!_id) {
    _id = "";
  }
  if (!title) {
    title = "";
  }
  if (!description) {
    description = "";
  }
  res.render("record", {userName: userName, _id: _id, title: title, description: description});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// DBへ格納
//////////////////////////////////////////////////////////////////////////////////////////////
exports.saveCourse = function(req, res) {
  // 登録者
  var userName = req.user.name;
  var recordMode = req.body.recordMode;

  // タグ情報を配列に分解
  var tagArray;
  if (!req.body.tags || req.body.tags.length == 0) {
    tagArray = [];
  } else {
    req.body.tags.splice(req.body.tags.length - 1, 1);
    var tagArray = String(req.body.tags).split(",");
  }

  // カテゴリ情報
  var categoryPlace = req.body.catPlace.replace(" ", "");
  var categoryKind = req.body.catKind.replace(" ", "");
  /*
  var category = new Category({
    place: place,
    kind : kind
  });
  var categoryArray = [category];
  */
  var category = {"place": categoryPlace, "kind": categoryKind};

  // 非公開
  var privateFlg = false;
  if (req.body.chkPrivate =="on") {
    privateFlg = true;
  }

  // 移動位置情報を配列に分解
  var positionArray = [];
  var positions = req.body.positions;
  var startPos = 0;
  for (var i = 1; i < positions.length - 1; i++) {
    if (positions.charAt(i - 1) == "}" && positions.charAt(i) == "," && positions.charAt(i + 1) == "{") {

      var positionObj = JSON.parse(positions.substr(startPos, i - startPos));
      var position = new Position({
        lat     : positionObj.lat,
        lng     : positionObj.lng,
        heading : positionObj.heading,
        pitch   : positionObj.pitch,
        zoom    : positionObj.zoom,
        distance: positionObj.distance
      });
      positionArray.push(position);

      startPos = i + 1;
    }
  }
  var lastPositionObj = JSON.parse(positions.substr(startPos));
  var lastPosition = new Position({
        lat     : lastPositionObj.lat,
        lng     : lastPositionObj.lng,
        heading : lastPositionObj.heading,
        pitch   : lastPositionObj.pitch,
        zoom    : lastPositionObj.zoom,
        distance: lastPositionObj.distance
      });
  positionArray.push(lastPosition);

  // 初期位置情報
  var firstPositionArray = [];
  firstPositionArray.push(positionArray[0]);

  // link情報
  var linkArray = req.body.links.split(",");

  // 新規登録の場合
  if (recordMode == "save") {
    var course = new Course({
      owner        : userName,
      title        : req.body.txtTitle,
      description  : req.body.txtDescription,
      position     : positionArray,
      firstPosition: firstPositionArray,
      tag          : tagArray,
      //categoryPlace: categoryPlace,
      //categoryKind : categoryKind,
      category     : category,
      link         : linkArray,
      playCount    : 0,
      privateFlg   : privateFlg
    });
    course.save(function(err, saveCourse) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.redirect('/record?_id=' + saveCourse._id + "&title=" + saveCourse.title + "&description=" + saveCourse.description);
      }
    });

  // 既存編集の場合
  } else if (recordMode == "edit") {
    var _id = req.body._id;
    Course.update(
      {'_id': new ObjectId(_id)},
      {$set: {title        : req.body.txtTitle,
              description  : req.body.txtDescription,
              position     : positionArray,
              firstPosition: firstPositionArray,
              tag          : tagArray,
              //categoryPlace: categoryPlace,
              //categoryKind : categoryKind,
              category     : category,
              link         : linkArray,
              privateFlg   : privateFlg,
              updated      : new Date().toISOString()}},
      {upsert: false},
      function (err, updateCnt) {
        if (err){
          console.log('err : ' + err);
          res.redirect('back');
        }
        res.redirect('/record?_id=' + _id + "&title=" + req.body.txtTitle + "&description=" + req.body.txtDescription);
      }
    );
  }
};

//////////////////////////////////////////////////////////////////////////////////////////////
// コース削除（再生履歴を含む）
//////////////////////////////////////////////////////////////////////////////////////////////
exports.removeCourse = function(req, res) {
  var _id = req.query._id;
  var userName = util.getUserNameFromSession(req);

  // コースのownerとログインユーザIDが一致するかどうか確認
  if (userName) {
    Course.find(
      {_id: new ObjectId(_id), owner: userName},
      util.getCourseWithoutPositions(),  // positions以外
      {},
      function(err, courses) {
        if (err) {
          console.log(err);
          res.redirect('/');
        } else if (courses.length == 0) {  // コースのownerとログインユーザIDが一致しない → 不正アクセス
          res.redirect('/');
        } else {
          // TODO トランザクション

          // Course削除
          Course.remove({_id: new ObjectId(_id)}, function(err) {
            if (err) {
              console.log(err);
            }
            // 再生履歴削除
            PlayHistory.remove({course_id: _id}, function(err) {
              if (err) {
                console.log(err);
              }
              res.json({userName: util.getUserNameFromSession(req), result: "success"});
            });
          });
        }
      }
    );
  } else {
    res.redirect('/');
  }
}
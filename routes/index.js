
/*
 * GET home page.
 */

var url = require("url");
var ObjectId = require('mongoose').Types.ObjectId;
var model = require('../model');
var Course = model.Course;

// トップ画面表示
exports.index = function(req, res) {
  res.render("index", {});
};

// 再生画面表示
exports.play = function(req, res) {
  res.render("play", {_id: req.query._id});
};

// 記録画面表示
exports.record = function(req, res) {
  var _id = req.query._id;
  if (!_id) {
    _id = "";
  }
  res.render("record", {_id: _id});
};

// ログイン画面表示
exports.login = function(req, res) {
  res.render("login", {});
}

// 検索画面表示
exports.search = function(req, res) {
  res.render("searchResult", {word: req.body.txtNavSearch});
}

// プライバシーポリシー画面表示
exports.privacy = function(req, res) {
  res.render("privacy", {});
};

// 利用規約画面表示
exports.rules = function(req, res) {
  res.render("rules", {});
};

// 「◯◯」について画面表示
exports.about = function(req, res) {
  res.render("about", {});
};

// トップ画面 - コースのサムネイル表示
exports.course = function(req, res) {
  Course.find({}, function(err, courses) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      var no = req.query.no;
      res.json(courses[no - 1]);  // 暫定的に取得した順に返すようにしている
    }
  });
}

// 新着
exports.newArrival = function (req, res) {
  Course.find({}, null, {"sort": {"created": -1}, "limit": 5}, function(err, courses) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.json(courses);
    }
  });
};

// 再生画面 - 移動位置情報をDBからロード
exports.loadCourse = function(req, res) {
  var _id = req.query._id;
  Course.findOne({_id: new ObjectId(_id)}, function(err, course) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.json(course);
    }
  });
}

// 再生画面 - 再生回数をインクリメント
exports.incrementPlayCount = function(req, res) {
  var _id = req.query._id;
console.log("incrementPlayCount");
  Course.findOne({_id: new ObjectId(_id)}, function(err, course) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      Course.update(
        {"_id": new ObjectId(_id)},
        {$set: {playCount: course.playCount + 1}},
        {upsert: false},
        function (err, updateCnt) {
          if (err){
            console.log("err : " + err);
          }
          console.log("再生回数を : " + String(course.playCount + 1) + "にupdate");
        }
      );
    }
  });
}

// 記録画面 - DBへ格納
exports.save = function(req, res) {
  // 移動位置情報を配列に分解
  var positionArray = [];
  var positions = req.body["positions"];
  var startPos = 0;
  for (var i = 1; i < positions.length - 1; i++) {
    if (positions.charAt(i - 1) == "}" && positions.charAt(i) == "," && positions.charAt(i + 1) == "{") {
      positionArray.push(positions.substr(startPos, i - startPos));
      startPos = i + 1;
    }
  }
  positionArray.push(positions.substr(startPos, positions.length));  // 最後の要素をpush

  var course = new Course({
    owner      : "owner",
    title      : req.body["txtTitle"],
    description: req.body["txtDescription"],
    playCount  : 0,
    position   : positionArray
  });

  course.save(function(err, course) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.redirect('/record?_id=' + course._id);
    }
  });
};

// おすすめを表示
exports.recommend = function(req, res) {
  Course.find({}, null, {"sort": {"playCount": -1}, "limit": 5}, function(err, courses) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.json(courses);
    }
  });
}
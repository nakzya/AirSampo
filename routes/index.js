
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
  var _id = req.query._id;
  res.render("play", {_id: _id});
};

// 記録画面表示
exports.record = function(req, res) {
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
  res.render("record", {_id: _id, title: title, description: description});
};

// ログイン画面表示
exports.login = function(req, res) {
  res.render("login", {});
}

// 検索画面表示
exports.search = function(req, res) {
  res.render("searchResult", {searchWord: req.body.txtNavSearch});
}

// 検索処理
exports.searchResult = function(req, res) {
  var searchWord = req.query.searchWord;
  //var searchWord = req.body.txtNavSearch;
  console.log("searchWord : " * searchWord);
  Course.find({$or: [{title      : new RegExp('.*' + searchWord + '.*', "i")},  // タイトルと中間一致、または
                     {description: new RegExp('.*' + searchWord + '.*', "i")},  // 説明文と中間一致、または
                     {tag        : {$all: searchWord}},                         // タグに含まれる、または
                     {link       : {$all: searchWord}}                          // リンクに含まれる
                    ]},
              null,
              {sort: {playCount: -1}},
              function(err, courses) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.json(courses);
    }
  });
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

// トップ画面 - ページネーションのための件数取得
exports.paginationTop = function(req, res) {
  Course.count(
    {},  // 暫定的に全件の件数を取得
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

// トップ画面 - コースのサムネイル表示
exports.course = function(req, res) {
  var page = req.query.page;
  var skip = (page - 1) * 4;
  Course.find(
    {},  // 暫定的に全件（再生回数の多い順）に取得している
    null,
    {sort: {playCount: -1}, skip: skip, limit: 4},
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
        }
      );
    }
  });
}

// 記録画面 - DBへ格納
exports.save = function(req, res) {
  // タグ情報を配列に分解
  var tagArray
  if (req.body.tags.length == 0) {
    tagArray = [];
  } else {
    req.body.tags.splice(req.body.tags.length - 1, 1);
    var tagArray = String(req.body.tags).split(",");
  }

  // 移動位置情報を配列に分解
  var positionArray = [];
  var positions = req.body.positions;
  var startPos = 0;
  for (var i = 1; i < positions.length - 1; i++) {
    if (positions.charAt(i - 1) == "}" && positions.charAt(i) == "," && positions.charAt(i + 1) == "{") {
      positionArray.push(positions.substr(startPos, i - startPos));
      startPos = i + 1;
    }
  }
  positionArray.push(positions.substr(startPos, positions.length));  // 最後の要素をpush

  // link情報
  var linkArray = req.body.links.split(",");

  var course = new Course({
    owner      : "owner",
    title      : req.body["txtTitle"],
    description: req.body["txtDescription"],
    position   : positionArray,
    tag        : tagArray,
    link       : linkArray,
    playCount  : 0
  });

  course.save(function(err, course) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.redirect('/record?_id=' + course._id + "&title=" + course.title + "&description=" + course.description);
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
var url = require("url");
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var model = require("../model");
var User = model.User;
var Course = model.Course;
var Position = model.Position;
var PlayHistory = model.PlayHistory;

//////////////////////////////////////////////////////////////////////////////////////////////
// 新規ユーザ登録画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.signup = function(req, res) {
  var message = "";
  if (req.query.message) {
    message = req.query.message;
  }
  res.render("signup", {userName: getUserNameFromSession(req), message: message});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ユーザ登録
//////////////////////////////////////////////////////////////////////////////////////////////
exports.saveUser = function(req, res) {
  var userName = req.body.txtUserName;
  var email = req.body.txtEmail;
  var password = req.body.txtPassword;

  var user = new User({
    name    : userName,
    email   : email,
    password: password
  });

  user.save(function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/signup?message=ユーザー登録に失敗しました。管理者にお問い合わせください。");
    }
    res.redirect("/signup?message=ユーザー登録が完了しました、" + user.name + "さん。");
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ユーザ情報取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.getUser = function(req, res) {
  var name = req.query.name;
  if (name) {
    User.findOne({name: name}, function(err, user) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        res.json(user);
      }
    });
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ログイン画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.login = function(req, res) {
  var email ="";
  if (req.query.email) {  // 新規ユーザー登録直後の場合
    email = req.query.email;
  }
  res.render("login", {userName: getUserNameFromSession(req), email: email, password: "", message: req.flash('error')});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ログアウト
//////////////////////////////////////////////////////////////////////////////////////////////
exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');
}

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.index = function(req, res) {
  res.render("index", {userName: getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.play = function(req, res) {
  var _id = req.query._id;
  res.render("play", {userName: getUserNameFromSession(req), _id: _id});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 記録画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.record = function(req, res) {
  var userName = getUserNameFromSession(req);
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
// トップ画面 - ランダムなコースの再生画面を表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.randomCourse = function(req, res) {
  Course.count(  // 全件の件数を取得
    {},
    function(err, count) {
      if (err) {
        console.log(err);
        res.redirect('back');
      } else {
        // ランダム番目のコースの_idを取得し、再生画面を表示
        var randomIdx = Math.floor(Math.random() * Number(count) + 1);
        var options = {skip: randomIdx, limit: 1};
        Course.find(
          {}, {"_id": 1}, options, function(err, courses) {
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
  var map = function() {
    emit(this.course_id, {count: 1, datetime: this.datetime});
  };

  var reduce = function(key, values) {
    var result = {count: 0};  //集計結果を初期化
    values.forEach(function(value){
      result.count += value.count;
    });
    return result;
  };

  var today = new Date();
  var targetDate = computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), -7);  // ７日前
  var conditions = {datetime: {"$gte": targetDate}};

  var options = {out: {inline: 1}, query: conditions};

  // 直近1周間のcourse_idごとの再生回数の合計を取得
  PlayHistory.collection.mapReduce(map.toString(),
                                   reduce.toString(),
                                   options,
                                   function(err, data) {
/*
  var command = {
    mapreduce: "PlayHistory",
    map: map.toString(),
    reduce: reduce.toString(),
    query: conditions,
    out: {inline: 1}
  };
  mongoose.connection.db.executeDbCommand(command, function(err, data) {
*/

    if (err) {
      console.log("error: " + err);
    }
    if (!data) return;

    // countの降順にsort
    data.sort(function(data1, data2){
      if (data1.value.count < data2.value.count) return 1;
      if (data1.value.count > data2.value.count) return -1;
      return 0;
    });

    for (var i = 0; i < data.length; i++) {
      console.log(i + " : " + data[i]._id + " : " + data[i].value.count);
    }

    var page = req.query.page;
    var skip = (page - 1) * 4;
    var options = {sort: {playCount: -1}, skip: skip, limit: 4};

    // 再生回数上位4つ（skip考慮）を取得するようconditionsを生成
    var idx;
    var conditions = '{"$or": [';
    for (var idx = skip; idx < skip + 3 && idx < data.length - 1; idx++) {
      conditions += '{"_id": "' + data[idx]._id + '"},';
    }
    conditions += '{"_id": "' + data[idx]._id + '"}]}';
    conditions = JSON.parse(conditions);

    Course.find(
      conditions,
      {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},  // positions以外
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
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 表示件数取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.count = function(req, res) {
  var mode = req.query.mode;
  var count = 0;

  // modeによってカウントを取得する条件を変更
  if (mode == "top") {
    var back = req.query.back;  // 直近何日間の件数を取得するか

    var map = function() {
      emit(this.course_id, {count: 1, datetime: this.datetime});
    };

    var reduce = function(key, values) {
      var result = {count: 0};  //集計結果を初期化
      values.forEach(function(value){
        result.count += value.count;
      });
      return result;
    };

    var today = new Date();
    var targetDate = computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), Number(back) * -1);
    var conditions = {datetime: {"$gte": targetDate}};

    var options = {out: {inline: 1}, query: conditions};

    // 直近N日間のcourse_idごとの再生回数の合計を取得（再生回数＝0は含まない）
    PlayHistory.collection.mapReduce(map.toString(),
                                     reduce.toString(),
                                     options,
                                     function(err, data) {
      if (err) {
        console.log("error: " + err);
      }
      if (!data) return;

      var count = data.length;
      if (data.length > 40) {
        count = 40;
      }
      console.log(count);
      res.json({"count": count});
    });

  } else if (mode = "all") {
    var conditions = {};
    Course.count(
      conditions,
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
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生画面 - 移動位置情報をDBからロード
//////////////////////////////////////////////////////////////////////////////////////////////
exports.loadCourse = function(req, res) {
  var _id = req.query._id;
  var idx = req.query.idx;
  if (_id) {
    loadCourseById(_id, res);
  } else if (idx) {
    loadCourseWithSkip(idx - 1, res);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// _idでCourseを取得
//////////////////////////////////////////////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////////////////////////////////////////////
// skip指定でCourseを取得
//////////////////////////////////////////////////////////////////////////////////////////////
function loadCourseWithSkip(skip, res) {
  var options = {skip: skip, limit: 1};

  Course.find(
    {}, null, options, function(err, courses) {
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

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生履歴を登録
//////////////////////////////////////////////////////////////////////////////////////////////
exports.playHistory = function(req, res) {
  var _id = req.query._id;
  if (_id) {  // 記録確定前の場合、undefinedのため再生履歴を登録しない
    var playHistory = new PlayHistory({
      course_id: _id,
      playedby : "anonymous"  // TODO 暫定
    });

    playHistory.save(function(err, course) {
      if (err) {
        console.log(err);
        res.redirect('back');
      }
    });
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 記録画面 - DBへ格納
//////////////////////////////////////////////////////////////////////////////////////////////
exports.saveCourse = function(req, res) {
  // 登録者
  var userName = req.user.name;

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

  var course = new Course({
    owner        : userName,
    title        : req.body["txtTitle"],
    description  : req.body["txtDescription"],
    position     : positionArray,
    firstPosition: firstPositionArray,
    tag          : tagArray,
    link         : linkArray,
    playCount    : 0
  });
  course.save(function(err, saveCourse) {
    if (err) {
      console.log(err);
      res.redirect('back');
    } else {
      res.redirect('/record?_id=' + saveCourse._id + "&title=" + saveCourse.title + "&description=" + saveCourse.description);
    }
  });
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 新着
//////////////////////////////////////////////////////////////////////////////////////////////
exports.newArrival = function (req, res) {
  Course.find(
    {},
    {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},  // positions以外
    {"sort": {"created": -1}, "limit": 5},
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
// おすすめを表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.recommend = function(req, res) {
  Course.find(
    {},
    {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},  // positions以外
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
// 検索画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.search = function(req, res) {
  res.render("searchResult", {userName: getUserNameFromSession(req), searchWord: req.body.txtNavSearch});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 検索処理
//////////////////////////////////////////////////////////////////////////////////////////////
exports.searchResult = function(req, res) {
  var searchWord = req.query.searchWord;
  var page = req.query.page;
  var skip = (page - 1) * 10;
  Course.find({$or: [{title      : new RegExp('.*' + searchWord + '.*', "i")},  // タイトルと中間一致、または
                     {description: new RegExp('.*' + searchWord + '.*', "i")},  // 説明文と中間一致、または
                     {tag        : {$all: searchWord}},                         // タグに含まれる、または
                     {link       : {$all: searchWord}}                          // リンクに含まれる
                    ]},
              {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},  // positions以外
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
// 検索結果画面 - ページネーションのための件数取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.paginationSearch = function(req, res) {
  var searchWord = req.query.searchWord;
  Course.count({$or: [{title      : new RegExp('.*' + searchWord + '.*', "i")},  // タイトルと中間一致、または
                      {description: new RegExp('.*' + searchWord + '.*', "i")},  // 説明文と中間一致、または
                      {tag        : {$all: searchWord}},                         // タグに含まれる、または
                      {link       : {$all: searchWord}}                          // リンクに含まれる
                     ]},
    function(err, count) {
      if (err) {
        console.log(err);
        res.redirect("back");
      } else {
        res.json({"count": count});
      }
    }
  );
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.mycourse = function(req, res) {
  var userName = getUserNameFromSession(req);
  if (!userName) {  // ログインせずにURL直叩きで記録画面を開こうとした場合
    res.redirect("/");
  }

  res.render("mycourse", {userName: getUserNameFromSession(req)});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース結果表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.mycourseResult = function(req, res) {
  var userName = req.user.name;
  var page = req.query.page;
  var skip = (page - 1) * 10;

  if (userName) {
    Course.find(
      {owner: userName},
      {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},
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

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキング画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.ranking = function(req, res) {
  res.render("ranking", {userName: getUserNameFromSession(req)});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキング画面 - ランキングデータ取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.selectRanking = function(req, res) {
  var page = req.query.page;
  if (!page) page = 1;
  var skip = (page - 1) * 10;
  Course.find(
    {},
    {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "link": 1, "playCount": 1, "created": 1},  // positions以外
    {"sort": {"playCount": -1}, skip: skip, "limit": 10},
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
  res.render("privacy", {userName: getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 利用規約画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.rules = function(req, res) {
  res.render("rules", {userName: getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// 「このサイトについて」画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.about = function(req, res) {
  res.render("about", {userName: getUserNameFromSession(req)});
};

//////////////////////////////////////////////////////////////////////////////////////////////
// SessionからUser情報を取得
//////////////////////////////////////////////////////////////////////////////////////////////
function getUserNameFromSession(req) {
  var userName = "";
  if (req.user) {
    userName =  req.user.name;
  }
  return userName;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 前0埋め
//////////////////////////////////////////////////////////////////////////////////////////////
function paddingZero(str, keta) {
  var zero = "";
  for (var i = 0; i < keta; i++) {
    zero += "0";
  }
  return (zero + str).slice(keta * -1);
}

 //////////////////////////////////////////////////////////////////////////////////////////////
// 年月日と加算日からn日後、n日前を求める
//////////////////////////////////////////////////////////////////////////////////////////////
function computeDate(year, month, day, addDays) {
    var dt = new Date(year, month - 1, day);
    var baseSec = dt.getTime();
    var addSec = addDays * 86400000;//日数 * 1日のミリ秒数
    var targetSec = baseSec + addSec;
    dt.setTime(targetSec);
    return dt;
}
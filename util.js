var model = require("./model");
var PlayHistory = model.PlayHistory;
var computeDate;

//////////////////////////////////////////////////////////////////////////////////////////////
// SessionからUser情報を取得
//////////////////////////////////////////////////////////////////////////////////////////////
exports.getUserNameFromSession = function (req) {
  var userName = "";
  if (req.user) {
    userName =  req.user.name;
  }
  return userName;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Courseのpositions以外のフィールド
//////////////////////////////////////////////////////////////////////////////////////////////
exports.getCourseWithoutPositions = function() {
  return {"_id": 1, "owner": 1, "title": 1, "description": 1, "firstPosition": 1, "tag": 1, "category": 1, "link": 1, "playCount": 1, "privateFlg": 1,　"created": 1, "updated": 1, "deleted": 1};
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 前0埋め
//////////////////////////////////////////////////////////////////////////////////////////////
exports.paddingZero = function(str, keta) {
  var zero = "";
  for (var i = 0; i < keta; i++) {
    zero += "0";
  }
  return (zero + str).slice(keta * -1);
}

 //////////////////////////////////////////////////////////////////////////////////////////////
// 年月日と加算日からn日後、n日前を求める
//////////////////////////////////////////////////////////////////////////////////////////////
computeDate = exports.computeDate = function(year, month, day, addDays) {
    var dt = new Date(year, month - 1, day);
    var baseSec = dt.getTime();
    var addSec = addDays * 86400000;//日数 * 1日のミリ秒数
    var targetSec = baseSec + addSec;
    dt.setTime(targetSec);
    return dt;
}


//////////////////////////////////////////////////////////////////////////////////////////////
// 直近N日間の再生回数を集計しカウントを取得する
// その結果を引数のcallback関数に渡す
// Course collectionのprivateFlgは考慮しない
// @param back 直近何日間の集計をとるか
// @param func callback関数
//////////////////////////////////////////////////////////////////////////////////////////////
exports.playHistoryCount = function(back, func) {
  var map = function() {
    emit(this.course_id, {count: 1, playedDate: this.playedDate});
  };

  var reduce = function(key, values) {
    var result = {count: 0};  //集計結果を初期化
    values.forEach(function(value){
      result.count += value.count;
    });
    return result;
  };

  var conditions;
  var today = new Date();
  var targetDate;
  if (back == null) {
    conditions = {};
  } else {
    var targetDate = computeDate(today.getFullYear(), (today.getMonth() + 1), today.getDate(), Number(back) * -1);
    conditions = {playedDate: {$gte: targetDate}};
  }

  var options = {out: {inline: 1}, query: conditions};

  // 直近N日間のcourse_idごとの再生回数の合計を取得
  PlayHistory.collection.mapReduce(map.toString(),
                                   reduce.toString(),
                                   options,
                                   func);
}
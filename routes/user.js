var url = require("url");
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var model = require("../model");
var User = model.User;
var util = require("../util");


//////////////////////////////////////////////////////////////////////////////////////////////
// 新規ユーザ登録画面表示
//////////////////////////////////////////////////////////////////////////////////////////////
exports.signup = function(req, res) {
  var message = "";
  if (req.query.message) {
    message = req.query.message;
  }
  res.render("signup", {userName: util.getUserNameFromSession(req), message: message});
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
    res.redirect("/signup?message=ユーザー登録が完了しました、" + user.name + "さん。トップページからログインしてください。");
    //res.redirect("/login/auth?email=" + email + "&password=" + password);
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
  res.render("login", {userName: util.getUserNameFromSession(req), email: email, password: "", message: req.flash('error')});
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ログアウト
//////////////////////////////////////////////////////////////////////////////////////////////
exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');
}
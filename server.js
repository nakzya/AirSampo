var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , flash = require('connect-flash')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , crypto = require('crypto')
  , model = require("./model")
  , User = model.User;

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({secret: 'airsampo secret'}));
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(function(req, res, next){
    res.status(404);
    res.render('index', {userName: ""});
  });
});

app.configure('development', function(){
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

// 新規ユーザー登録画面
app.get('/signup', routes.signup);
app.post('/saveUser', routes.saveUser);

// ログイン画面
app.get('/login', routes.login);
app.post('/login/auth', passport.authenticate('local', {successRedirect: '/',
                                                        failureRedirect: '/login',
                                                        failureFlash: true }));

// トップ画面
app.get('/', routes.index);
app.get('/mapSearch', routes.mapSearch);
app.get('/random', routes.randomCourse);
app.get('/courseThumbnail', routes.courseThumbnail);

// 再生・記録画面共通
app.get('/play', routes.play);
app.get('/incrementPlayCount', routes.incrementPlayCount);
app.get('/playHistory', routes.playHistory);

// 記録画面
app.get('/record', routes.record);
app.post('/saveCourse', routes.saveCourse);
app.get('/removeCourse', routes.removeCourse);

// 検索画面
app.post('/search', routes.search);
app.get('/searchResult', routes.searchResult);
app.get('/searchResult/count', routes.searchResultCount);

// マイコース画面
app.get('/mycourse', routes.mycourse);
app.get('/mycourseResult', routes.mycourseResult);
app.get('/mycourseResult/count', routes.mycourseResultCount);

// ランキング画面
app.get('/ranking', routes.ranking);
app.get('/ranking/select', routes.selectRanking);

// カテゴリ検索画面
app.get('/category', routes.category);
app.get('/category/select', routes.selectCategory);
app.get('/category/count', routes.categoryCount);

// プライバシーポリシー画面
app.get('/privacy', routes.privacy);

// 利用規約画面
app.get('/rules', routes.rules);

// 「このサイトについて」画面
app.get('/about', routes.about);

// 新着
app.get('/newArrival', routes.newArrival);

// おすすめ
app.get('/recommend', routes.recommend);

// 共通
app.get('/count', routes.count);
app.get('/loadCourse', routes.loadCourse);
app.get('/user', routes.getUser);
app.get('/logout', routes.logout);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


// Email/Password認証
passport.use(new LocalStrategy({
    usernameField: "email",
    passwordField: "password"
  },
  function(email, password, done) {
    User.find(
      {
        email   : email,
        password: password
      },
      null,
      {},
      function(err, users) {
        if (err) {
          return done(err);
        }
        if(users.length == 0) {  // 認証失敗
          console.log("認証失敗");
          return done(null, false, {message: "メールアドレスまたはパスワードが間違っています。"});
        }
        var user = users[0];
        return done(null, user);　　// 認証成功
      }
    );
  })
);

// passportのセッションを使うので
// シリアライズ、デシリアライズのための関数を追記
passport.serializeUser(function(user, done){
//console.log("serializeUser : " + user.name);
  done(null, user);
});
passport.deserializeUser(function(user, done){
//console.log("deserializeUser : " + user.name);
  done(null, user);
});

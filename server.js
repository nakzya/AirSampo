var express = require('express')
  , routesUser = require('./routes/user')
  , routesIndex = require('./routes/index')
  , routesPlay = require('./routes/play')
  , routesRecord = require('./routes/record')
  , routesSearch = require('./routes/search')
  , routesCommon = require('./routes/common')
  , http = require('http')
  , path = require('path')
  , flash = require('connect-flash')
  , MongoStore = require( 'connect-mongo')(express)
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
  app.use(express.session({
    secret: 'airsampo secret',
    cookie: {maxAge: 3600000},
    store: new MongoStore({db: 'airsampo'})
  }));
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
app.get('/signup', routesUser.signup);
app.post('/saveUser', routesUser.saveUser);

// ログイン画面
app.get('/login', routesUser.login);
app.post('/login/auth', passport.authenticate('local', {successRedirect: '/',
                                                        failureRedirect: '/login',
                                                        failureFlash: true }));

// トップ画面
app.get('/', routesIndex.index);
app.get('/mapSearch', routesIndex.mapSearch);
app.get('/random', routesIndex.randomCourse);
app.get('/courseThumbnail', routesIndex.courseThumbnail);

// 再生・記録画面共通
app.get('/play', routesPlay.play);
app.get('/incrementPlayCount', routesPlay.incrementPlayCount);
app.get('/playHistory', routesPlay.playHistory);

// 記録画面
app.get('/record', routesRecord.record);
app.post('/saveCourse', routesRecord.saveCourse);
app.get('/removeCourse', routesRecord.removeCourse);

// 検索画面
app.post('/search', routesSearch.search);
app.get('/searchResult', routesSearch.searchResult);

// マイコース画面
app.get('/mycourse', routesSearch.mycourse);
app.get('/mycourseResult', routesSearch.mycourseResult);

// ランキング画面
app.get('/ranking', routesSearch.ranking);
app.get('/rankingResult', routesSearch.rankingResult);

// カテゴリ検索画面
app.get('/category', routesSearch.category);
app.get('/categoryResult', routesSearch.categoryResult);

// プライバシーポリシー画面
app.get('/privacy', routesIndex.privacy);

// 利用規約画面
app.get('/rules', routesIndex.rules);

// 「このサイトについて」画面
app.get('/about', routesIndex.about);

// 新着
app.get('/newArrival', routesSearch.newArrival);
app.get('/newArrivalSB', routesIndex.newArrivalSB);
app.get('/newArrivalResult', routesSearch.newArrivalResult);

// おすすめ
app.get('/recommendSB', routesIndex.recommendSB);

// 共通
app.get('/count', routesCommon.count);
app.get('/loadCourse', routesCommon.loadCourse);
app.get('/user', routesUser.getUser);
app.get('/logout', routesUser.logout);

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

// TODO userオブジェクトごとシリアライズしてしまうと、パスワードを含んだままになり問題あり？

passport.serializeUser(function(user, done){
//console.log("serializeUser : " + user.name);
  done(null, user);
});
passport.deserializeUser(function(user, done){
//console.log("deserializeUser : " + user.name);
  done(null, user);
});


/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/course', routes.course);
app.get('/pagination/top', routes.paginationTop);
app.get('/newArrival', routes.newArrival);

app.get('/recommend', routes.recommend);

app.get('/play', routes.play);
app.get('/loadCourse', routes.loadCourse);
app.get('/incrementPlayCount', routes.incrementPlayCount);

app.get('/record', routes.record);
app.post('/save', routes.save);

app.get('/login', routes.login);

app.post('/search', routes.search);
app.get('/searchResult', routes.searchResult);
app.get('/pagination/search', routes.paginationSearch);

app.get('/privacy', routes.privacy);

app.get('/rules', routes.rules);

app.get('/about', routes.about);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

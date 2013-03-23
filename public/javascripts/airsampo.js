var DEBUG = true;

var INIT_LAT = 35.681747;
var INIT_LNG = 139.765491;

// 秋芳洞
//var INIT_LAT = 34.229152;
//var INIT_LNG  =131.30274399999996;

var INIT_HEADING = 127.70307765233667;
var INIT_PITCH = 1.9147722283955624;
var PLAY_SPEED_UNIT = 40;
var PLAY_SPEDD_SLIDER_INIT_VALUE = 50;

var SEARCH_RESULT_MAX_ROW = 5;
var SEARCH_RESULT_MAX_COL = 2;

var sv = new google.maps.StreetViewService();
var map;
var panorama;
var geocoder;
var panoramaDataArray = [];
var panoramaDataArrayIdx = 0;
var playMode = 0;  // 0:初期状態、停止  1:再生中  2:一時停止中
var recordMode = 0;  // 0:記録していない  1:記録中
var recordEditFlg = false;  // true:既存編集  false:新規登録
var lines = [];
var markers = [];
var InfoWindows = [];
var playSpeed = PLAY_SPEED_UNIT * PLAY_SPEDD_SLIDER_INIT_VALUE; // 再生速度(ms)
var distance = 0;
var links = [];
var currentTimer;

//////////////////////////////////////////////////////////////////////////////////////////////
// パノラマデータ構造体
//////////////////////////////////////////////////////////////////////////////////////////////
function PanoramaData(panorama) {
  if (arguments.length == 1) {
    this.lat = panorama.getPosition().lat();
    this.lng = panorama.getPosition().lng();
    this.heading = panorama.getPov().heading;
    this.pitch = panorama.getPov().pitch;
    this.zoom = panorama.getZoom();
    this.distance = 0;

  } else if (arguments.length == 0) {
    this.lat = INIT_LAT;
    this.lng = INIT_LNG;
    this.heading = INIT_HEADING;
    this.pitch = INIT_PITCH;
    this.zoom = 1;
    this.distance = 0;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面のページネーションの設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setTopPagination(page) {
  $.ajax({
    url: "/count?mode=top&back=30",   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;
      if (count > (4 * 10)) {   // 最大10ページ
        count = 4 * 10;
      }

      $("#pagination ul *").remove();  // 一旦ページネーションを全て削除

      var ul = $("#pagination ul");

      // Prev
      var prevLi = $("<li><a href='javascript:void(0)'>\<\<</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "setCourseThumbnail(" + (page - 1) + "); setTopPagination(" + (page - 1) + ")");
      }
      ul.append(prevLi);

      // ページNo
      var lastPage = Math.floor((count - 1) / 4) + 1;
      for (var i = 1; i <= lastPage; i++) {
        var li = $("<li><a href=javascript:void(0)'>" + String(i) + "</a></li>");
        if (i == page) {
          li.addClass("active");
          li.removeAttr("onclick");
        } else {
          li.attr("onclick", "setCourseThumbnail(" + i + "); setTopPagination(" + i + ")");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='javascript:void(0)'>\>\></a></li>");
      if (page == lastPage) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "setCourseThumbnail(" + (page + 1) + "); setTopPagination(" + (page + 1) + ")");
      }
      ul.append(nextLi);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 検索結果画面のページネーションの設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setSearchPagination(page, searchWord) {
  var url = "/searchResult/count?searchWord=" + searchWord;

  $.ajax({
    url: url,   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;

      $("#pagination *").remove();  // 一旦ページネーションを全て削除

      var ul = $("<ul></ul>");
      $("#pagination").append(ul);

      // Prev
      var prevLi = $("<li><a href='#header'>\<\<</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "search('" + searchWord + "', " + (page - 1) + "); setSearchPagination(" + (page - 1) + ", '" + searchWord + "')");
      }
      ul.append(prevLi);

      var lastPage = Math.floor((count - 1) / (SEARCH_RESULT_MAX_ROW * SEARCH_RESULT_MAX_COL)) + 1;
      for (var i = 1; i <= lastPage; i++) {
        var li = $("<li><a href='#header'>" + String(i) + "</a></li>");
        if (i == page) {
          li.addClass("active");
          li.removeAttr("onclick");
        } else {
          li.attr("onclick", "search('" + searchWord + "', " + String(i) + "); setSearchPagination(" + String(i) + ", '" + searchWord + "')");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='#header'>\>\></a></li>");
      if (page == lastPage || count == 0) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "search('" + searchWord + "', " + (page + 1) + "); setSearchPagination(" + (page + 1) + ", '" + searchWord + "')");
      }
      ul.append(nextLi);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// カテゴリ検索結果画面のページネーションの設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setCategorySearchPagination(page, category) {
  var url = "/category/count?category=" + category;

  $.ajax({
    url: url,   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;

      $("#pagination *").remove();  // 一旦ページネーションを全て削除

      var ul = $("<ul></ul>");
      $("#pagination").append(ul);

      // Prev
      var prevLi = $("<li><a href='#header'>\<\<</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "categorySearch('" + category + "', " + (page - 1) + "); setCategorySearchPagination(" + (page - 1) + ", '" + category + "')");
      }
      ul.append(prevLi);

      var lastPage = Math.floor((count - 1) / (SEARCH_RESULT_MAX_ROW * SEARCH_RESULT_MAX_COL)) + 1;
      for (var i = 1; i <= lastPage; i++) {
        var li = $("<li><a href='#header'>" + String(i) + "</a></li>");
        if (i == page) {
          li.addClass("active");
          li.removeAttr("onclick");
        } else {
          li.attr("onclick", "categorySearch('" + category + "', " + String(i) + "); setCategorySearchPagination(" + String(i) + ", '" + category + "')");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='#header'>\>\></a></li>");
      if (page == lastPage || count == 0) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "categorySearch('" + category + "', " + (page + 1) + "); setCategorySearchPagination(" + (page + 1) + ", '" + category + "')");
      }
      ul.append(nextLi);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース画面のページネーションの設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setMycoursePagination(page) {
  var url = "/mycourseResult/count";

  $.ajax({
    url: url,   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;

      $("#pagination *").remove();  // 一旦ページネーションを全て削除

      var ul = $("<ul></ul>");
      $("#pagination").append(ul);

      // Prev
      var prevLi = $("<li><a href='#header'>\<\<</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "showMycourse(" + (page - 1) + "); setMycoursePagination(" + (page - 1) + ")");
      }
      ul.append(prevLi);

      var lastPage = Math.floor((count - 1) / (SEARCH_RESULT_MAX_ROW * SEARCH_RESULT_MAX_COL)) + 1;
      for (var i = 1; i <= lastPage; i++) {
        var li = $("<li><a href='#header'>" + String(i) + "</a></li>");
        if (i == page) {
          li.addClass("active");
          li.removeAttr("onclick");
        } else {
          li.attr("onclick", "showMycourse(" + String(i) + "); setMycoursePagination(" + String(i) + ")");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='#header'>\>\></a></li>");
      if (page == lastPage || count == 0) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "showMycourse(" + (page + 1) + "); setMycoursePagination(" + (page + 1) + ")");
      }
      ul.append(nextLi);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ナビゲーションバー表示処理
//////////////////////////////////////////////////////////////////////////////////////////////
function setNavigationBar(mode, userName) {
  $.ajax({
    url: "./navigationBar.html",
    cache: true,
    success: function(html) {
      $("#navigationBar").html(html);

      if (userName) {  // ログイン済みの場合
        $("#navUserName").html(userName + " さん <b class='caret'></b>");
        $("#userDropdown").css("display", "block");
      } else {
        $("#navUserName").html("");
        $("#userDropdown").css("display", "none");
      }
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「さんぽコースを探す」div表示処理
//////////////////////////////////////////////////////////////////////////////////////////////
function setSearchCourseDiv(activeTab) {
  $.ajax({
    url: "./searchCourse.html",
    cache: false, //TODO
    success: function(html) {
      $("#searchCourse").html(html);

      $("a[href='" + activeTab + "']").click();
      $("a:not([href='" + activeTab + "'])").parent().removeClass("active");

      // 検索用マップ
      $("div.tabbable ul li a[href='#tabMap']").bind("shown", function(event) {
        var startPosition = new google.maps.LatLng(INIT_LAT, INIT_LNG);
        var mapOptions = {
          center: startPosition,
          zoom: 2,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var searchMap = new google.maps.Map(document.getElementById("searchMap"), mapOptions);

        // さんぽコースを示すmarkerを設置
        $.ajax({
          url: "/mapSearch",   // 全件のカウント
          cache: true,
          dataType: "json",
          success: function(courses) {
            var openInfoWindow = null;
            var mcMarkers = [];
            var infoWindow = new google.maps.InfoWindow();
            for (var i = 0; i < courses.length; i++) {
              var course = courses[i];
              var marker = new google.maps.Marker({
                position: new google.maps.LatLng(course.firstPosition[0].lat, course.firstPosition[0].lng),
                map: searchMap,
                animation: google.maps.Animation.DROP,
                title: course.title
              });

              google.maps.event.addListener(marker, 'click', (function(thisMarker, course) {
                return function() {
                  if (openInfoWindow != null) {
                    openInfoWindow.close();
                  }
                  var content = "<div><a href='/play?_id=" + course._id + "'><img src='http://maps.googleapis.com/maps/api/streetview?size=200x150&location=" + course.firstPosition[0].lat + "," + course.firstPosition[0].lng + "&heading=" + course.firstPosition[0].heading + "&pitch=" + course.firstPosition[0].pitch + "&sensor=false' /></div></a><h5>" + course.title + "</h5><p>" + course.description + "</p><span style='margin-bottom: 20px'>さんぽ回数： </span><span>" + course.playCount + "回</span>";
                  infoWindow.setContent(content);
                  infoWindow.open(searchMap, thisMarker);
                  openInfoWindow = infoWindow;
                };
              })(marker, course));
              mcMarkers.push(marker);
            }
            var mcOptions = {gridSize: 50, maxZoom: 20};
            var markerCluster = new MarkerClusterer(searchMap, mcMarkers, mcOptions);
          }
        });
        event.preventDefault();
      });
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// フッタ表示処理
//////////////////////////////////////////////////////////////////////////////////////////////
function setFooter() {
  $.ajax({
    url: "./footer.html",
    cache: true,
    success: function(html) {
      $("#footer").html(html);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 画面共通 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function initialize() {
  var mode = arguments[0];
  var userName = arguments[1];

  switch(mode) {
    case "top":
      topInitialize(arguments);
      break;
    case "play":
      commonInitialize(arguments);
      playInitialize(arguments);
      break;
    case "record":
      commonInitialize(arguments);
      recordInitialize(arguments);
      break;
    case "ranking":
      rankingInitialize(arguments);
      break;
    case "search":
      searchResultInitialize(arguments);
      break;
    case "category":
      categoryResultInitialize(arguments);
      break;
    case "mycourse":
      mycourseResultInitialize(arguments);
      break;
    case "signup":
      signupInitialize(arguments);
      break;
    case "login":
      loginInitialize(arguments);
      break;
  }

  // ナビゲーションバー設定
  setNavigationBar(mode, userName);

  // フッタ設定
  setFooter();
}

//////////////////////////////////////////////////////////////////////////////////////////////
// トップ画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function topInitialize() {
  var startingCourseIdx = 1;  //初期再生動画のナンバー
  var userName = arguments[0][1];

  // 初期表示コースの設定
  setStartingCourse();

  $(".loading").css("display", "none");

  // 「さんぽコースを探す」を表示
  setSearchCourseDiv("#tabSearch");

  // 初期表示4コースのサムネイル設定
  setCourseThumbnail(1);

  // ページネーションの設定
  setTopPagination(1);

  // 新着情報表示
  showNewArrival();

  // ログイン済みかどうか
  if (userName) {
    $("#loginBox").css("display", "none");
    $("#recordBox").css("display", "block");
    $("#recordBox h2").text(userName + " さん");
  } else {
    $("#loginBox").css("display", "block");
    $("#recordBox").css("display", "none");
  }

  // 新規ユーザー登録ボタン
  $("#btnSignup").bind("click", function(event) {
    var form = $("<form action='/signup' method='get'></form>");
    form.appendTo("body").submit();
  });
  // ログインボタン
  $("#btnLogin").bind("click", function(event) {
    var form = $("<form action='/login' method='get'></form>");
    form.appendTo("body").submit();
  });

  // 記録するボタン
  $("#btnTopRecord").bind("click", function(event) {
    var form = $("<form action='/record' method='get'></form>");
    form.appendTo("body").submit();
  });
  // マイコースボタン
  $("#btnMycourse").bind("click", function(event) {
    var form = $("<form action='/mycourse' method='get'></form>");
    form.appendTo("body").submit();
  });

  $("#btnCourse1").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });

  $("#btnCourse2").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });

  $("#btnCourse3").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });

  $("#btnCourse4").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生・記録画面 共通 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function commonInitialize() {
  // おすすめ表示
  showRecommend();

  var startPosition = new google.maps.LatLng(INIT_LAT, INIT_LNG);
  var mapOptions = {
    center: startPosition,
    zoom: 16,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

  /*
  var marker = new google.maps.Marker({
    position: startPosition,
    map: map,
    draggable: true
  });

  google.maps.event.addListener(marker, "dragend", function() {
    var p = marker.position;
    showPositionInfo(p, null);

    movePanorama(p);
  });*/

  var panoramaOptions = {
    position: startPosition,
    pov: {
      heading: INIT_HEADING,
      pitch: INIT_PITCH,
      zoom: 1
    }
  };
  panorama = new  google.maps.StreetViewPanorama(document.getElementById("streetview"), panoramaOptions);
  map.setStreetView(panorama);
  setTimeout(function() {
    google.maps.event.trigger(panorama, "resize");
  }, 500);
  //google.maps.event.trigger(panorama, "resize");
  //google.maps.event.trigger(panorama, "position_changed");
  //movePanorama(startPosition);

  $("#btnRecord").tooltip();
  $("#btnPlay").tooltip();
  $("#btnStop").tooltip();

  // 「Search」ボタン クリックイベント
  $("#btnSearch").bind("click", function(event) {
    if (!geocoder) {
      geocoder = new google.maps.Geocoder();
    }

    var address = $("#txtSearch").val();
    geocoder.geocode({'address': address}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        var position = results[0].geometry.location;
        map.setCenter(position);
        movePanorama(position);
      } else {
        alert(address + "は見つかりませんでした。");
      }
    });

    event.preventDefault();
  });

  // 「現在地」ボタン クリックイベント
  $("#btnHere").bind("click", function(event) {
    getCurrentPosition(true);
    event.preventDefault();
  });

  // 「再生」ボタン クリックイベント
  $("#btnPlay").bind("click", function(event) {
    play(panorama, true, false);
    event.preventDefault();
  });

  // 「停止」ボタン クリックイベント
  $("#btnStop").bind("click", function(event) {
    stop();
    event.preventDefault();
  });

  // StreetViewの真ん中に再生ボタンを設置
  setCenterPlayBtn();
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function playInitialize() {
  var _id = arguments[0][2];

  // 移動位置情報をDBからロード
  loadCourse(_id);

  // StreetViewイベントハンドラ追加 "position_changed"
  google.maps.event.addListener(panorama, "position_changed", function() {
    showPositionInfo(panorama.getPosition(), panorama.getPov());

    map.panTo(panorama.getPosition());
  });

  // StreetViewイベントハンドラ追加 "pov_changed"
  google.maps.event.addListener(panorama, "pov_changed", function() {  // zoom_changedイベントを含む
    showPositionInfo(panorama.getPosition(), panorama.getPov());
  });

  // 再生速度スライダーの設定
  $("#playSpeedSlider").slider({
    range: "min",
    value: PLAY_SPEDD_SLIDER_INIT_VALUE,
    min: 1,
    max: 100,
    step: 1,
    slide: function(event, ui) {
      $("#playSpeedSliderValue").val(ui.value);
      playSpeed = ui.value * PLAY_SPEED_UNIT;
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// StreetViewの中心に再生ボタンを設置
//////////////////////////////////////////////////////////////////////////////////////////////
function setCenterPlayBtn() {
  var streetview = $("#streetview");
  streetview.css("position", "relative");
  var btnPlayCenter = $("<img id='btnPlayCenter' src='images/play_button.png' />");

  setTimeout(function(){
    var top = (streetview.get(0).offsetHeight - btnPlayCenter.get(0).offsetHeight) / 2;
    var left = (streetview.get(0).offsetWidth - btnPlayCenter.get(0).offsetWidth) / 2;
    btnPlayCenter.css("top", top);
    btnPlayCenter.css("left", left);
  }, 100);  // 100ミリ秒後に遅延して位置を決めることで、一連のDOMの描画が完了してから位置決めでき正確な値になる

  btnPlayCenter.css("width", "100px").css("height", "100px");
  btnPlayCenter.bind("click", function() {   // クリックしたら再生
    play(panorama, true, false);
    btnPlayCenter.remove();
  });
  streetview.append(btnPlayCenter);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 記録画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function recordInitialize() {
  var _id = arguments[0][2];

  // 記録確定後、再表示する場合
  if (_id != "") {
    // 移動位置情報をDBからロード
    loadCourse(_id);

    // 「編集する」チェックボックスを表示
    $("#chkEdit").parent().parent().css("display", "block");

    // 編集不可
    $("#btnRecord").attr("disabled", "disabled");
    $("#btnSave").attr("disabled", "disabled");
    $("#btnDelete").attr("disabled", "disabled");

    // 再生可
    $("#btnPlay").removeAttr("disabled");
    setCenterPlayBtn();  // display: block だと座標位置がずれる

  } else {
    map.setZoom(4);
    initPanoramaSlider();
    $("#btnPlayCenter").remove();
  }

  // 現在地に移動
  getCurrentPosition(false);
  map.setZoom(15);

  links = [];

  // 「編集する」チェックボックス
  recordEditFlg = false;
  $("#chkEdit").bind("change", function(event) {
    if ($(this).is(":checked")) {
      recordEditFlg = true;  // 編集中
      $("#btnRecord").removeAttr("disabled");
      $("#btnSave").removeAttr("disabled");
      $("#btnDelete").removeAttr("disabled");
    } else {
      recordMode = false;
      $("#btnRecord").attr("disabled", "disabled");
      $("#btnSave").attr("disabled", "disabled");
      $("#btnDelete").attr("disabled", "disabled");
    }
    event.preventDefault();
  });

  // 再生速度スライダーの設定
  $("#playSpeedSliderRecord").slider({
    range: "min",
    value: PLAY_SPEDD_SLIDER_INIT_VALUE,
    min: 1,
    max: 100,
    step: 1,
    slide: function(event, ui) {
      //$("#playSpeedSliderValue").val(ui.value);
      playSpeed = ui.value * PLAY_SPEED_UNIT;
    }
  });

  // タグ 初期処理
  $("#tagList").tagit();

  // StreetViewイベントハンドラ追加 "position_changed"
  google.maps.event.addListener(panorama, "position_changed", function() {
    showPositionInfo(panorama.getPosition(), panorama.getPov());

    if (recordMode == 1) {
      // 移動ラインを描画
      if (panoramaDataArray.length != 0) {
        var fromLatLng = new google.maps.LatLng(panoramaDataArray[panoramaDataArray.length - 1].lat, panoramaDataArray[panoramaDataArray.length - 1].lng);
        var toLatLng = new google.maps.LatLng(panorama.getPosition().lat(), panorama.getPosition().lng());
        drawRecordLine(fromLatLng, toLatLng);
      }

      // 距離を計算・表示
      distance += google.maps.geometry.spherical.computeDistanceBetween(fromLatLng, toLatLng);
      distance = roundEx(distance, -2);  // 小数点第2位までで四捨五入
      $("#distance").html(distance + "m");

      var panoData = new PanoramaData(panorama);
      panoData.distance = distance;

      // linksに重複がないようににpushしていく
      var panoLinks = panorama.getLinks();
      for (var i in panoLinks) {
        if ($.inArray(panoLinks[i].description, links) == -1) {
          links.push(panoLinks[i].description);
        }
      }

      // 操作を記録
      panoramaDataArray.push(panoData);
    }

    map.panTo(panorama.getPosition());
  });

  // StreetViewイベントハンドラ追加 "pov_changed"
  google.maps.event.addListener(panorama, "pov_changed", function() {  // zoom_changedイベントを含む
    showPositionInfo(panorama.getPosition(), panorama.getPov());

    var zoom = panorama.getPov().zoom;
    $("#zoom").val(zoom);
    if (recordMode == 1 && String(zoom).match(/^-?[0-9]+$/) != null) {  // ズームが整数の場合のみ
      var panoDataPrevious = panoramaDataArray[panoramaDataArray.length - 1];
      // 前回と同じ値の場合は登録しない
      if (panoDataPrevious.heading != panorama.getPov().heading ||
          panoDataPrevious.pitch   != panorama.getPov().pitch ||
          panoDataPrevious.zoom    != panorama.getPov().zoom) {

        var panoData = new PanoramaData(panorama);
        panoData.zoom = zoom;  // 何故かzoomだけずれるため再設定

        panoData.distance = panoDataPrevious.distance;  // 距離は前回と同様

        // 操作を記録
        panoramaDataArray.push(panoData);
      }
    }
  });

  // 「記録」ボタン クリックイベント
  $("#btnRecord").bind("click", function(event) {
    toggleRecord();
    event.preventDefault();
  });

  // カテゴリドロップダウン選択イベント
  $("#catSpace").bind("click", function(event) {
    $("#catPlace").html("<strong>　場所　</strong>");
    event.preventDefault();
  });
  //$("#catDomestic").bind("click", function(event) {
  //  $("#catPlace").text($("#catDomestic").text());  // this.textだとIEがundefined
  //  event.preventDefault();
  //});
  $("#catDomestic+ul li a").bind("click", function(event) {
    $("#catPlace").text($(this).parent().text());
    event.preventDefault();
  });
  //$("#catAbroad").bind("click", function(event) {
  //  $("#catPlace").text($("#catAbroad").text());  // this.textだとIEがundefined
  //  event.preventDefault();
  //});
  $("#catAbroad+ul li a").bind("click", function(event) {
    $("#catPlace").text($(this).parent().text());
    event.preventDefault();
  });
  $("#catSpace2").bind("click", function(event) {
    $("#catKind").html("<strong>　種類　</strong>");
    event.preventDefault();
  });
  $("#catSampo").bind("click", function(event) {
    $("#catKind").text($("#catSampo").text());  // this.textだとIEがundefined
    event.preventDefault();
  });
  $("#catGuide").bind("click", function(event) {
    $("#catKind").text($("#catGuide").text());  // this.textだとIEがundefined
    event.preventDefault();
  });
  //$("#catNature").bind("click", function(event) {
  //  $("#catKind").text($("#catNature").text());  // this.textだとIEがundefined
  //  event.preventDefault();
  //});
  $("#catNature+ul li a").bind("click", function(event) {
    $("#catKind").text($(this).parent().text());
    event.preventDefault();
  });
  //$("#catArtificial").bind("click", function(event) {
  //  $("#catKind").text($("#catArtificial").text());  // this.textだとIEがundefined
  //  event.preventDefault();
  //});
  $("#catArtificial+ul li a").bind("click", function(event) {
    $("#catKind").text($(this).parent().text());
    event.preventDefault();
  });

  // 「確定」ボタン クリックイベント
  $("#btnSave").bind("click", function(event) {
    if (panoramaDataArray.length <= 1) {
      alert("確定するデータがありません。");
      return false;
    }

    // 「タイトル」 必須チェック
    if ($("#txtTitle").val() == "" || $("#txtTitle").val().length == 0) {
      if (!$("#txtTitle").parent().parent().hasClass("error")) {
        var errorMsgSpan = $("<span id='msgSpan' class='help-inline'>タイトルは必須です。</span>");
        $("#txtTitle").parent().parent().addClass("error");
        $("#txtTitle").parent().append(errorMsgSpan);
      }
      return false;
    } else {
      $("#txtTitle").parent().parent().removeClass("error");
      $("#msgSpan").remove();
    }

    // タグ情報をhiddenでpost
    var tagArray = $("#tagList li").text().split("×");
    var str = "";
    if (tagArray[0] != "") {
      str += tagArray[0];
      for (var i = 1; i < tagArray.length - 1; i++) {
        str += ("," + tagArray[i]);
      }
    }
    $("#saveForm").append("<input type='hidden' name='tags' value='" + str + "'></input>");

    // カテゴリ情報（場所・種類）をhiddenでpost
    var place = $("#catPlace").text();
    $("#saveForm").append("<input type='hidden' name='catPlace' value='" + place + "'></input>");
    var kind = $("#catKind").text();
    $("#saveForm").append("<input type='hidden' name='catKind' value='" + kind + "'></input>");

    // 移動位置情報を文字列として作成 → hiddenでpost
    str = "";
    for (var i = 0; i < panoramaDataArray.length; i++) {
      var panoData = panoramaDataArray[i];
      str += ('{"lat":"' + panoData.lat + '","lng":"' + panoData.lng + '","heading":"' + panoData.heading + '","pitch":"' + panoData.pitch + '","zoom":"' + panoData.zoom + '","distance":"' + panoData.distance + '"}');
      if (i < panoramaDataArray.length - 1) {
        str += ',';
      }
    }
    $("#saveForm").append("<input type='hidden' name='positions' value='" + str + "'></input>");

    // link情報をhiddenでpost
    str = links[0];
    for (var i = 1; i < links.length; i++) {
      var link = links[i];
      str += ("," + link);
    }
    $("#saveForm").append("<input type='hidden' name='links' value='" + str + "'></input>");

    // 新規登録 or 既存編集
    var recordModeStr = "save";
    if (recordEditFlg) {
      recordModeStr = "edit";
      // 既存編集の場合、対象の_idもrequestに含める
      $("#saveForm").append("<input type='hidden' name='_id' value='" + _id + "'></input>");
    }
    $("#saveForm").append("<input type='hidden' name='recordMode' value='" + recordModeStr + "'></input>");

    // DBに書き込み
    $("#saveForm").submit();

    // 初期位置に戻す
    var firstPosition = panoramaDataArray[0];
    var startPosition = new google.maps.LatLng(firstPosition.lat, firstPosition.lng);
    movePanorama(startPosition);

    panorama.setPosition(startPosition);
    panorama.setPov({
      heading: firstPosition.heading,
      pitch: firstPosition.pitch,
      zoom: firstPosition.zoom
    });

    alert("記録しました！");

    event.preventDefault();
  });

  // 「削除」ボタン クリックイベント
  $("#btnDelete").bind("click", function(event) {
    $("body").append("<div id='dialog'>本当に削除してもよろしいですか？</div>");
    $("#dialog").dialog({
      autoOpen: false,
      width: 300,
      title: "Confirm",
      modal: true,
      resizable: false,
      buttons: {
        "OK": function() {
          $.ajax({
            url: "/removeCourse?_id=" + _id,
            dataType: "json",
            success: function(data) {
              if (data.result = "success") {
                alert("削除しました。");
                var form = $("<form action='/record' method='get'></form>");
                form.appendTo("body").submit();
              }
            }
          });
          $(this).dialog("close");
          $("#dialog").remove();
        },
        "Cancel": function() {
          $(this).dialog("close");
          $("#dialog").remove();
          return;
        }
      }
    });
    $("#dialog").dialog("open");
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキング画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function rankingInitialize() {
  var back = arguments[0][2];

  // 一旦初期化
  $("#tabRankingToday").removeClass("active");
  $("#tabRankingWeekly").removeClass("active");
  $("#tabRankingMonthly").removeClass("active");
  $("#tabRankingAll").removeClass("active");

  switch (back) {
    case "today":
      back = 0;
      $("#tabRankingToday").addClass("active");
      break;
    case "week":
      back = 7;
      $("#tabRankingWeekly").addClass("active");
      break;
    case "month":
     back = 30;
     $("#tabRankingMonthly").addClass("active");
     break;
    case "all":
     back = null;
     $("#tabRankingAll").addClass("active");
     break;
  }
  // ランキングデータを表示
  setRanking(1, back);

  // 「さんぽコースを探す」を表示
  setSearchCourseDiv("#tabRanking");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 検索結果画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function searchResultInitialize() {
  var searchWord = arguments[0][2];

  // 検索結果を表示
  search(searchWord, 1);

  $(".loading").css("display", "none");

  // ページネーションの設定
  setSearchPagination(1, searchWord);

  // 「さんぽコースを探す」を表示
  setSearchCourseDiv("#tabSearch");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコース結果画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function mycourseResultInitialize() {
  // ログインユーザの毎コースを表示
  showMycourse(1);

  $(".loading").css("display", "none");

  // ページネーションの設定
  setMycoursePagination(1);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// カテゴリ検索結果画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function categoryResultInitialize() {
  var category = arguments[0][2];

  categorySearch(1, category);

  $(".loading").css("display", "none");

  // ページネーション
  setCategorySearchPagination(1, category);

  // 「さんぽコースを探す」を表示
  setSearchCourseDiv("#tabCategory");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 新規ユーザー登録画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function signupInitialize() {
  var message = arguments[0][2];
  if (message) {  // 認証失敗で再表示する場合
    $("#signupMessage").css("display", "block");
  }

  // ユーザー登録ボタン
  $("#btnSaveUser").bind("click", function(event) {
    // 入力チェック
    var checkResult = checkInputSignup($("#txtUserName").val(),
                                       $("#txtEmail").val(),
                                       $("#txtPassword").val(),
                                       $("#txtPasswordConfirm").val());
    if (!checkResult) {
      return false;
    }
    // ユーザー名重複チェック
    $.ajax({
      url: "/user?name=" + $("#txtUserName").val(),
      cache: true,
      dataType: "json",
      success: function(user) {
        if (!user) {
          $("#saveUserForm").submit();
        } else {
          if (!$("#txtUserName").parent().parent().hasClass("error")) {
            $("#txtUserName").parent().parent().addClass("error");
          }
          $("#message").html($("#txtUserName").val() + " は既に登録されています。");
          $("#message").css("display", "block");
          return false;
        }
      }
    });

    event.preventDefault();
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 新規ユーザー登録画面 入力チェック
//////////////////////////////////////////////////////////////////////////////////////////////
function checkInputSignup(userName, email, password, passConfirm) {
  var message = "";

  // ■■■■■■■■■■ TODO ■■■■■■■■■■
  //
  // チェック追加
  //
  // ■■■■■■■■■■■■■■■■■■■■■■■■■■


  /////////////////////////
  // ユーザー名
  /////////////////////////
  var errorFlgUser = false;
  if (!userName || userName.length == 0) {
    message += "ユーザー名は必須です。";
    errorFlgUser = true;
  } else if (userName.length < 3) {
    message += "ユーザー名は3文字以上で入力してください。";
    errorFlgUser = true;
  }

  if (errorFlgUser) {
    if (!$("#txtUserName").parent().parent().hasClass("error")) {
      $("#txtUserName").parent().parent().addClass("error");
    }
  } else {
    $("#txtUserName").parent().parent().removeClass("error")
  }

  /////////////////////////
  // メールアドレス
  /////////////////////////
  var errorFlgEmail = false;
  var emailMsg = checkEmail(email);
  if (emailMsg.length != 0) {
    errorFlgEmail = true;
  }

  if (errorFlgEmail) {
    if (!$("#txtEmail").parent().parent().hasClass("error")) {
      $("#txtEmail").parent().parent().addClass("error");
    }
    if (message.length != 0) {  // 既にエラーが発生している場合
      message += "<br>" + emailMsg;
    }
  } else {
    $("#txtEmail").parent().parent().removeClass("error")
  }

  /////////////////////////
  // パスワード
  /////////////////////////
  var errorFlgPassword = false;
  var passwordMsg = checkPassword(password);
  if (passwordMsg.length != 0) {
    errorFlgPassword = true;
  }

  if (errorFlgPassword) {
    if (!$("#txtPassword").parent().parent().hasClass("error")) {
      $("#txtPassword").parent().parent().addClass("error");
    }
    if (message.length != 0) {  // 既にエラーが発生している場合
      message += "<br>" + passwordMsg;
    }
  } else {
    $("#txtPassword").parent().parent().removeClass("error")
  }

  if (!errorFlgUser && !errorFlgEmail && !errorFlgPassword) {
    $("#message").css("display", "none");
  }

  /////////////////////////
  // パスワード（確認）
  /////////////////////////
  var errorFlgPassConfirm = false;
  var passConfirmMsg = checkPassword(passConfirm);
  if (passConfirmMsg.length != 0) {
    errorFlgPassConfirm = true;
  }

  if (password != passConfirm) {
    if (message.length != 0) {  // 既にエラーが発生している場合
      passConfirmMsg += "<br>";
    }
    passConfirmMsg += "パスワードが一致しません。"
    errorFlgPassConfirm = true;
  }

  if (passConfirmMsg.length != 0) {
    passConfirmMsg = passConfirmMsg.split("パスワード").join("パスワード（確認）");  // 置換
  }

  if (errorFlgPassConfirm) {
    if (!$("#txtPasswordConfirm").parent().parent().hasClass("error")) {
      $("#txtPasswordConfirm").parent().parent().addClass("error");
    }
    if (message.length != 0) {  // 既にエラーが発生している場合
      message += "<br>" + passConfirmMsg;
    }
  } else {
    $("#txtPasswordConfirm").parent().parent().removeClass("error")
  }

  if (message.length == 0) {
    $("#message").css("display", "none");
    return true;
  } else {
    $("#message").html(message);
    $("#message").css("display", "block");
    return false;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ログイン画面 初期処理
//////////////////////////////////////////////////////////////////////////////////////////////
function loginInitialize() {
  var message = arguments[0][2];
  if (message) {  // 認証失敗で再表示する場合
    $("#authMessage").css("display", "block");
  }

  // ユーザー登録ボタン
  $("#btnLogin").bind("click", function(event) {
    // 入力チェック
    var checkResult = checkInputLogin($("#txtEmail").val(),
                                      $("#txtPassword").val());
    if (!checkResult) {
      return false;
    }

    $("#authForm").submit();
    event.preventDefault();
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ログイン画面 入力チェック
//////////////////////////////////////////////////////////////////////////////////////////////
function checkInputLogin(email, password) {
  var message = "";

  /////////////////////////
  // メールアドレス
  /////////////////////////
  var errorFlgEmail = false;
  var message = checkEmail(email);
  if (message.length != 0) {
    errorFlgEmail = true;
  }

  if (errorFlgEmail) {
    if (!$("#txtEmail").parent().parent().hasClass("error")) {
      $("#txtEmail").parent().parent().addClass("error");
    }
  } else {
    $("#txtEmail").parent().parent().removeClass("error")
  }

  /////////////////////////
  // パスワード
  /////////////////////////
  var errorFlgPassword = false;
  var passwordMsg = checkPassword(password);
  if (passwordMsg.length != 0) {
    errorFlgPassword = true;
  }

  if (errorFlgPassword) {
    if (!$("#txtPassword").parent().parent().hasClass("error")) {
      $("#txtPassword").parent().parent().addClass("error");
    }
    if (message.length != 0) {  // 既にエラーが発生している場合
      message += "<br>" + passwordMsg;
    }
  } else {
    $("#txtPassword").parent().parent().removeClass("error")
  }

  if (message.length == 0) {
    $("#message").css("display", "none");
    return true;
  } else {
    $("#message").html(message);
    $("#message").css("display", "block");
    return false;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 入力Emailのチェック
//////////////////////////////////////////////////////////////////////////////////////////////
function checkEmail(email) {
  // ■■■■■■■■■■ TODO ■■■■■■■■■■
  //
  // チェック追加
  //
  // ■■■■■■■■■■■■■■■■■■■■■■■■■■

  var message = "";
  if (!email || email.length == 0) {
    message += "メールアドレスは必須です。"
  }
  return message;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 入力パスワードのチェック
//////////////////////////////////////////////////////////////////////////////////////////////
function checkPassword(password) {
  // ■■■■■■■■■■ TODO ■■■■■■■■■■
  //
  // チェック追加
  //
  // ■■■■■■■■■■■■■■■■■■■■■■■■■■

  var message = "";
  if (!password || password.length == 0) {
    message += "パスワードは必須です。"
  } else if(password.length < 6) {
    message += "パスワードは6文字以上で入力してください。"
  }
  return message;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 初期表示コースの設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setStartingCourse() {
  $.ajax({
    url: "/count?mode=allWithoutPrivate",   // pirvate以外の全件のカウント
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;
      // 初期再生動画のナンバーをランダムで決定（1～N）
      startingCourseIdx = Math.floor(Math.random() * Number(count) + 1);

      $.ajax({
        url: "/loadCourse?idx=" + startingCourseIdx,
        cache: false,
        dataType: "json",
        success: function(courses) {
          var course = courses[0];
          if (course) {
            var retArry = [];
            for (var i = 0; i < course.position.length; i++) {
              var data = course.position[i];
              var panoData = new PanoramaData();
              panoData.lat = data.lat;
              panoData.lng = data.lng;
              panoData.heading = Number(data.heading);
              panoData.pitch = Number(data.pitch);
              panoData.zoom = Number(data.zoom);
              panoData.distance = data.distance;
              retArry.push(panoData);
            }
            panoramaDataArray = retArry;

            var firstPosition = course.position[0];
            var startPosition = new google.maps.LatLng(firstPosition.lat, firstPosition.lng);

            var panoramaOptions = {
              // 最初の位置・POVを表示
              position: startPosition,
              pov: {
                heading: Number(firstPosition.heading),
                pitch: Number(firstPosition.pitch),
                zoom: Number(firstPosition.zoom)
              },
              addressControl: false,
              linksControl: false,
              panControl: false,
              clickToGo: false,
              zoomControl: false,
              imageDateControl: false,
              scrollwheel: false
            };
            var startingPanorama =
              new google.maps.StreetViewPanorama(document.getElementById("startingCourse"), panoramaOptions);

            // 左上のDescriptionラベル作成
            var descriptionLabelDiv = $("<div></div>");
            descriptionLabelDiv.css("max-width", "40%");
            var descriptionLabel = new DescriptionLabel(descriptionLabelDiv, course);
            descriptionLabelDiv.attr("index", "1");
            startingPanorama.controls[google.maps.ControlPosition.TOP_LEFT].push(descriptionLabelDiv[0]);

            // 閉じるボタン
            var left = $("#startingCourseContainer").get(0).offsetWidth - 50;
            $("#startingCourseContainer img").css("left", left + "px");
            $("#startingCourseContainer img").bind("click", function(event) {
              $("#startingCourseContainer").css("display", "none");
              stop();
            })

            // 初期表示コースをループ再生
            play(startingPanorama, false, true);
          }
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 初期再生コースのラベル
//////////////////////////////////////////////////////////////////////////////////////////////
function DescriptionLabel(labelDiv, course) {
  labelDiv.css("padding", "5px");

  var labelUI = $("<div></div>");
  labelUI.css("backgroundColor", "white");
  //labelUI.css("cursor", "pointer");
  labelUI.css("textAlign", "left");
  labelUI.css("opacity", "0.5");
  labelUI.attr("title", course.title);
  labelDiv.append(labelUI);

  var labelText = $("<div></div>");
  labelText.css("fontFamily", "Arial,sans-serif");
  labelText.css("fontSize", "12px");
  labelText.css("paddingLeft", "4px");
  labelText.css("paddingRight", "4px");
  labelText.html("<strong>" + course.title + "</strong><br/>" + course.description);
  labelUI.append(labelText);

/* 何故か画面遷移しない
  labelUI.bind("click", function() {
    $.get("/play?_id=" + course._id);
  });
*/
}

//////////////////////////////////////////////////////////////////////////////////////////////
// サムネイル情報を設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setCourseThumbnail(page) {
  // 一旦全て非表示に
  $("ul.thumbnails li").css("display", "none");

  $(".loading").css("display", "block");

  $.ajax({
    url: "/courseThumbnail?page=" + page,
    cache: false,
    dataType: "json",
    success: function(courses) {
      for (var i = 0; i < courses.length; i++) {
        var course = courses[i];
        var selectorStr = "#course" + String(i + 1) + "+div h3";

        // タイトル
        if (course.title) {
          $(selectorStr).removeAttr("text");
          $(selectorStr).text(course.title);
        }

        // 説明
        if (course.description) {
          selectorStr += "+p";
          $(selectorStr).text(course.description);
        }

        // 再生回数
        if (course.playCount == 0 || course.playCount) {
          $("#playCount" + String(i + 1)).text(course.playCount);
        }

        // サムネイル
        if (course.firstPosition) {
          var position = course.firstPosition[0];
          var startPosition = new google.maps.LatLng(position.lat, position.lng);
          var panoramaOptions = {
            // 最初の位置・POVを表示
            position: startPosition,
            pov: {
              heading: Number(position.heading),
              pitch: Number(position.pitch),
              zoom: Number(position.zoom)
            },
            addressControl: false,
            linksControl: false,
            panControl: false,
            clickToGo: false,
            zoomControl: false,
            imageDateControl: false,
            scrollwheel: false
          };

          $("#thumbnail" + String(i + 1)).css("display", "block");

          var panorama_thumbnail =
            new google.maps.StreetViewPanorama(document.getElementById("course" + String(i + 1)), panoramaOptions);
        }
        // データを特定するために_idを飛ばす
        $("#btnCourse" + String(i + 1)).attr("href", "/play?_id=" + course._id);
      }

      $(".loading").css("display", "none");

      // 初期LatLngがGray表示の場合があるため
      //movePanorama(startPosition, panorama_thumbnail);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Course情報をDBから読み込んでクライアントに展開
//////////////////////////////////////////////////////////////////////////////////////////////
function loadCourse(_id) {
  $.ajax({
    url: "/loadCourse?_id=" + _id,
    cache: true,
    dataType: "json",
    success: function(course) {
      // タイトル
      if (course.title) {
        $("#title").text(course.title);
      }
      // 説明
      if (course.description) {
        $("#description").text(course.description);
      }
      // タグ
      if (course.tag) {
        var ul = $("#tagList");
        if (ul.tagit) {  // 記録画面のみ
          for (var i = 0; i < course.tag.length; i++) {
            ul.tagit("createTag", course.tag[i]);
          }
        }
      }
      // カテゴリ
      if (course.category) {
        var catPlace = $("#catPlace");
        var catKind = $("#catKind");
        if (catPlace && catKind) {
          catPlace.text(course.category[0]);
          catKind.text(course.category[1]);
        }
      }
      // 非公開フラグ
      if (course.privateFlg) {
        $("#chkPrivate").attr("checked", true);
      }
      // 位置情報
      if (course.position) {
        var retArry = [];
        for (var i = 0; i < course.position.length; i++) {
          var data = course.position[i];
          var panoData = new PanoramaData();
          panoData.lat = data.lat;
          panoData.lng = data.lng;
          panoData.heading = Number(data.heading);
          panoData.pitch = Number(data.pitch);
          panoData.zoom = Number(data.zoom);
          panoData.distance = data.distance;
          retArry.push(panoData);
        }
        panoramaDataArray = retArry;

        setPanoramaSlider();

        // 初期位置の設定
        var panoDataFirst = panoramaDataArray[0];
        panorama.setPosition(panoData2LatLng(panoDataFirst));
        panorama.setPov({
          heading: panoDataFirst.heading,
          pitch: panoDataFirst.pitch
        });
        panorama.setZoom(panoDataFirst.zoom);
      }
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 検索結果を表示
//////////////////////////////////////////////////////////////////////////////////////////////
function search(searchWord, page) {
  // 一旦全てremove
  $("ul.thumbnails").remove();

  var coursesNum = 0;
  $.ajax({
    url: "/searchResult?searchWord=" + searchWord + "&page=" + page,
    cache: false,
    dataType: "json",
    success: function(courses) {
      coursesNum = courses.length;
      var searchResultDiv = $("#searchResult");
      for (var i = 1; i <= SEARCH_RESULT_MAX_ROW; i++) {
        var ul = $("<ul class='thumbnails'>");

        for (var j = 1; j <= SEARCH_RESULT_MAX_COL; j++) {
          var idx = (i - 1) * SEARCH_RESULT_MAX_COL + j;  // 1（≠0）～カウント
          var course = courses[idx - 1];
          if (!course) { break; }

          var li = $("<li id='thumbnail" + idx + "' class='span6'></li>");
          var div1 = $("<div class='thumbnail'></div>");

          // サムネイル
          var div2 = $("<div id='course" + idx + "'></div>");
          var firstPosition = course.firstPosition[0];
          var imgLink = $("<a href='/play?_id=" + course._id + "'></a>");
          var thumbnailImg = "<img src='http://maps.googleapis.com/maps/api/streetview?size=360x250&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false'\"' />";
          imgLink.append(thumbnailImg);
          div2.append(imgLink);

          var div3 = $("<div class='caption'></div>");

          // タイトル
          var h4 = $("<h4></h4>");
          var title = $("<a href='/play?_id=" + course._id + "'>" + course.title + "</a>");
          h4.append(title);
          div3.append(h4);

          // 説明文
          var p = $("<p></p>");
          var descriptionStr = course.description;
          //var descriptionStr = course.description.length > 22 ? course.description.substr(0, 20) + "..." : course.description;
          p.text(descriptionStr);
          div3.append(p);

          // さんぽ回数（ラベル）
          var span1 = $("<span class='label label-inverse' style='margin-bottom: 20px'>さんぽ回数</span>");
          div3.append(span1);

          // さんぽ回数
          var span2 = $("<span class='badge badge-important'></span>");
          span2.text(course.playCount);
          div3.append(span2);

          div1.append(div2);
          div1.append(div3);
          li.append(div1);
          ul.append(li);
          li.css("display", "block");
        }
        searchResultDiv.append(ul);
      }

      // 検索件数 ※データとは別に取らないと総件数を取得できない（まとめて取ると最大10件になってしまう）
      $.ajax({
        url: "/searchResult/count?searchWord=" + searchWord,
        cache: false,
        dataType: "json",
        success: function(data) {
          $("#searchResultCount").text(coursesNum + " / " + data.count);
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// ランキングを表示
//////////////////////////////////////////////////////////////////////////////////////////////
function setRanking(page, back) {
  // 一旦全て非表示に
  $("ul.thumbnails").remove();

  $.ajax({
    url: "/ranking/select?page=" + page + "&back=" + back,
    cache: false,
    dataType: "json",
    success: function(courses) {
      var rankingDiv = $("#ranking");
      var ul = $("<ul class='thumbnails'>");
      for (var i = 0; i < courses.length; i++) {
        var course = courses[i];
        if (!course) { break; }

        var li = $("<li id='thumbnail" + (i + 1) + "' class='span12' style='margin-left: 0'></li>");
        var div1 = $("<div class='row-fluid' style='border: none; margin-bottom: 50px'></div>");

        // サムネイル
        var div2 = $("<div id='course" + (i + 1) + "' class='span6'></div>");
        var firstPosition = course.firstPosition[0];
        var imgLink = $("<a href='/play?_id=" + course._id + "'></a>");
        var thumbnailImg = "<img src='http://maps.googleapis.com/maps/api/streetview?size=360x250&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false'\"' />";
        imgLink.append(thumbnailImg);
        div2.append(imgLink);

        var div3 = $("<div id='divCaption" + (i + 1) + "' class='caption span6'></div>");

        // メダル・順位
        var ranking;
        if ((i + 1) == 1 || (i + 1) == 2 || (i + 1) == 3) {
          var medalImg = $("<img src='images/rank" + (i + 1) + ".gif' style='display: inline; float:left;' />&nbsp;");
          div3.append(medalImg);
          ranking = $("<span style='font-size: xx-large;'>&nbsp;" + (i + 1) + "位</span>");
        } else {
          ranking = $("<span style='font-size: xx-large;'>" + (i + 1) + "位</span>");
        }
        div3.append(ranking);

        // タイトル
        var h4 = $("<h4 style='margin-top: 20px'></h4>");
        var title = $("<a href='/play?_id=" + course._id + "'>" + course.title + "</a>");
        h4.append(title);
        div3.append(h4);

        // 説明文
        var p = $("<p></p>");
        p.text(course.description);
        div3.append(p);

        // さんぽ回数（ラベル）
        var span1 = $("<span class='label label-inverse' style='margin-bottom: 20px'>さんぽ回数</span>");
        div3.append(span1);

        // さんぽ回数
        $.ajax({
          url: "/count?mode=ranking&_id=" + course._id + "&back=" + back + "&no=" + String(i + 1),
          cache: false,
          dataType: "json",
          success: function(data) {
            var span2 = $("<span class='badge badge-important'></span>");
            span2.text(data.count);
            $("#divCaption" + data.no).append(span2);
          }
        });

        div1.append(div2);
        div1.append(div3);
        li.append(div1);
        ul.append(li);
        li.css("display", "block");
      }
      rankingDiv.append(ul);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// マイコースを表示
//////////////////////////////////////////////////////////////////////////////////////////////
function showMycourse(page) {
  // 一旦全て非表示に
  $("ul.thumbnails").remove();

  var coursesNum = 0;
  $.ajax({
    url: "/mycourseResult?page=" + page,
    cache: false,
    dataType: "json",
    success: function(courses) {
      coursesNum = courses.length;
      var searchResultDiv = $("#mycourseResult");
      for (var i = 1; i <= SEARCH_RESULT_MAX_ROW; i++) {
        var ul = $("<ul class='thumbnails'>");

        for (var j = 1; j <= SEARCH_RESULT_MAX_COL; j++) {
          var idx = (i - 1) * SEARCH_RESULT_MAX_COL + j;  // 1（≠0）～カウント
          var course = courses[idx - 1];
          if (!course) { break; }

          var li = $("<li id='thumbnail" + idx + "' class='span6'></li>");
          var div1 = $("<div class='thumbnail'></div>");

          // サムネイル
          var div2 = $("<div id='course" + idx + "'></div>");
          var firstPosition = course.firstPosition[0];
          var imgLink = $("<a href='/record?_id=" + course._id + "&title=" + course.title + "&description=" + course.description+ "'></a>");
          var thumbnailImg = "<img src='http://maps.googleapis.com/maps/api/streetview?size=360x250&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false'\"' />";
          imgLink.append(thumbnailImg);
          div2.append(imgLink);

          var div3 = $("<div class='caption'></div>");

          // タイトル
          var h4 = $("<h4></h4>");
          var title = $("<a href='/record?_id=" + course._id + "&title=" + course.title + "&description=" + course.description+ "'>" + course.title + "</a>");
          h4.append(title);
          div3.append(h4);

          // 説明文
          var p = $("<p></p>");
          var descriptionStr = course.description;
          //var descriptionStr = course.description.length > 22 ? course.description.substr(0, 20) + "..." : course.description;
          p.text(descriptionStr);
          div3.append(p);

          // さんぽ回数（ラベル）
          var span1 = $("<span class='label label-inverse' style='margin-bottom: 20px'>さんぽ回数</span>");
          div3.append(span1);

          // さんぽ回数
          var span2 = $("<span class='badge badge-important'></span>");
          span2.text(course.playCount);
          div3.append(span2);

          div1.append(div2);
          div1.append(div3);
          li.append(div1);
          ul.append(li);
          li.css("display", "block");
        }
        searchResultDiv.append(ul);
      }

      // 検索件数 ※データとは別に取らないと総件数を取得できない（まとめて取ると最大10件になってしまう）
      $.ajax({
        url: "/mycourseResult/count",
        cache: false,
        dataType: "json",
        success: function(data) {
          $("#mycourseResultCount").text(coursesNum + " / " + data.count);
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// カテゴリ検索結果を表示
//////////////////////////////////////////////////////////////////////////////////////////////
function categorySearch(page, category) {
  // 一旦全て非表示に
  $("ul.thumbnails").remove();

  var coursesNum = 0;
  $.ajax({
    url: "/category/select?page=" + page +"&category=" + category,
    cache: false,
    dataType: "json",
    success: function(courses) {
      coursesNum = courses.length;
      var searchResultDiv = $("#categorySearchResult");
      for (var i = 1; i <= SEARCH_RESULT_MAX_ROW; i++) {
        var ul = $("<ul class='thumbnails'>");
        for (var j = 1; j <= SEARCH_RESULT_MAX_COL; j++) {
          var idx = (i - 1) * SEARCH_RESULT_MAX_COL + j;  // 1（≠0）～カウント
          var course = courses[idx - 1];
          if (!course) { break; }

          var li = $("<li id='thumbnail" + idx + "' class='span6'></li>");
          var div1 = $("<div class='thumbnail'></div>");

          // サムネイル
          var div2 = $("<div id='course" + idx + "'></div>");
          var firstPosition = course.firstPosition[0];
          var imgLink = $("<a href='/play?_id=" + course._id + "'></a>");
          var thumbnailImg = "<img src='http://maps.googleapis.com/maps/api/streetview?size=360x250&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false'\"' />";
          imgLink.append(thumbnailImg);
          div2.append(imgLink);

          var div3 = $("<div class='caption'></div>");

          // タイトル
          var h4 = $("<h4></h4>");
          var title = $("<a href='/play?_id=" + course._id + "'>" + course.title + "</a>");
          h4.append(title);
          div3.append(h4);

          // 説明文
          var p = $("<p></p>");
          var descriptionStr = course.description;
          //var descriptionStr = course.description.length > 22 ? course.description.substr(0, 20) + "..." : course.description;
          p.text(descriptionStr);
          div3.append(p);

          // さんぽ回数（ラベル）
          var span1 = $("<span class='label label-inverse' style='margin-bottom: 20px'>さんぽ回数</span>");
          div3.append(span1);

          // さんぽ回数
          var span2 = $("<span class='badge badge-important'></span>");
          span2.text(course.playCount);
          div3.append(span2);

          div1.append(div2);
          div1.append(div3);
          li.append(div1);
          ul.append(li);
          li.css("display", "block");
        }
        searchResultDiv.append(ul);
      }

      // 検索件数 ※データとは別に取らないと総件数を取得できない（まとめて取ると最大10件になってしまう）
      $.ajax({
        url: "/category/count?category=" + category,
        cache: false,
        dataType: "json",
        success: function(data) {
          $("#categoryResultCount").text(coursesNum + " / " + data.count);
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 新着情報を表示
//////////////////////////////////////////////////////////////////////////////////////////////
function showNewArrival() {
  $.ajax({
    url: "/newArrival",
    cache: false,
    dataType: "json",
    success: function(courses) {
      var ul = $("#newArrivalList");
      setSideBarCourse(ul, courses);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// おすすめを表示
//////////////////////////////////////////////////////////////////////////////////////////////
function showRecommend() {
  $.ajax({
    url: "/recommend",
    cache: false,
    dataType: "json",
    success: function(courses) {
      var ul = $("#recommendList");
      setSideBarCourse(ul, courses);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// サイドバーのコース情報を設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setSideBarCourse(ul, courses) {
  for (var i = 0; i < courses.length; i++) {
    var course = courses[i];
    var firstPosition = course.firstPosition[0];
    var imgLink = $("<a href='/play?_id=" + course._id + "'></a>");
    var thumbnailImg = "<img src=\"http://maps.googleapis.com/maps/api/streetview?size=360x200&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false\" />";
    imgLink.append(thumbnailImg);
    ul.append(imgLink);

    var li = $("<li class='clearfix'></li>");
    var title = $("<a href='/play?_id=" + course._id + "'>" + course.title + "</a>");
    var descriptionStr = course.description.length > 39 ? course.description.substr(0, 37) + "..." : course.description;
    var description = $("<p>" + descriptionStr + "</p>");
    li.append(title);
    li.append(description);
    ul.append(li);
    ul.append($("<hr>"));
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生スライダーを初期化
//////////////////////////////////////////////////////////////////////////////////////////////
function initPanoramaSlider() {
  $("#panoramaSlider").slider({
    range: "min",
    value: 0,
    min: 0,
    max: 0,
    step: 1,
    slide: function(event, ui) {
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「現在地」ボタン
//////////////////////////////////////////////////////////////////////////////////////////////
function getCurrentPosition(showErrorMsg) {
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        movePanorama(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
      },
      function(error) {
        if (showErrorMsg) {
          alert("ご使用のブラウザはGoeLocation（現在地取得機能）に対応していません。");
        }
      }
    );
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// StreetView / Map の表示サイズを変更
//////////////////////////////////////////////////////////////////////////////////////////////
function changePanoramaMapSize(mode) {
  switch (mode) {
    case 1:  // StreetView（左側）最大化
      $("#streetview").removeClass("span4 span6 span8").addClass("span12").css("display", "block");
      $("#map_canvas").css("display", "none").css("margin-left", "");
      break;
    case 2:  // Map（右側）最大化
      $("#streetview").css("display", "none");
      $("#map_canvas").removeClass("span4 span6 span8").addClass("span12").css("display", "block").css("margin-left", "0");
      break;
    case 3:  // 均等割
      $("#streetview").removeClass("span4 span6 span8").addClass("span6").css("display", "block");
      $("#map_canvas").removeClass("span4 span6 span8").addClass("span6").css("display", "block").css("margin-left", "");
      break;
    case 4:  // StreetView：Map = 3：2
      $("#streetview").removeClass("span4 span6 span8").addClass("span8").css("display", "block");
      $("#map_canvas").removeClass("span4 span6 span8").addClass("span4").css("display", "block").css("margin-left", "");
      break;
    case 5:  // StreetView：Map = 2：3
      $("#streetview").removeClass("span4 span6 span8").addClass("span4").css("display", "block");
      $("#map_canvas").removeClass("span4 span6 span8").addClass("span8").css("display", "block").css("margin-left", "");
      break;
  }
  google.maps.event.trigger(panorama, "resize");
  google.maps.event.trigger(map, "resize");

  // 地図の中心位置を移動
  map.panTo(panorama.getPosition());

  // 中央の再生ボタンを表示する場合は、座標を再建して再表示
  if (playMode != 1 && panoramaDataArray.length != 0 && recordMode != 1) {
    $("#btnPlayCenter").remove();
    setCenterPlayBtn();
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「記録」ボタン
//////////////////////////////////////////////////////////////////////////////////////////////
function toggleRecord() {
  /////////////////////////////////////////////
  // 記録開始
  /////////////////////////////////////////////
  if (recordMode == 0) {
    $("#btnPlayCenter").remove();

    if (panoramaDataArrayIdx == 0) {  // 初めての記録、または最初から記録し直す場合
      recordMode = 1;

      $("#btnRecord").tooltip("hide").attr("data-original-title", "記録終了").tooltip("fixTitle");
      $("#btnPlay").attr("disabled", "disabled");
      $("#btnStop").attr("disabled", "disabled");
      $("#btnSave").attr("disabled", "disabled");
      $("#btnDelete").attr("disabled", "disabled");

      //$("#view").addClass("recording");
      //$("#control").addClass("recording");
      createRecordingLable();

      map.setZoom(15);

      deleteLines();        // 一旦Map上の既存の線を全て削除
      deleteMoveMarkers();  // 一旦Map上の既存の開始・終了マーカーを削除
      deleteInfoWindows();  //  一旦panorama上の既存のinfoWindowを削除

      distance = 0;
      $("#distance").html("0m");

      // スタート地点マーカー
      var startMarker = new google.maps.Marker({
        position: panorama.getPosition(),
        map: map,
        animation: google.maps.Animation.DROP,
        icon: "http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld=S|FF0000|000000",
        title: "スタート地点"
      });
      markers.push(startMarker);
/*
      // パノラマ表示用スタート地点マーカー
      var startMarker2 = new google.maps.Marker({
        position: panorama.getPosition(),
        map: panorama,
        title: "スタート地点"
      });
      markers.push(startMarker2);
      var infowindow = new google.maps.InfoWindow({
        content: "<p style='font-weight: bold'>スタート地点　<img src='../images/running.gif'/></p><p>張り切って行きましょう!</p>"
      });
      infowindow.open(panorama, startMarker2);
      InfoWindows.push(infowindow);
*/
      links = [];

      panoramaDataArray = [];
      panoramaDataArray.push(new PanoramaData(panorama));  // 記録開始地点を登録

    } else {  // 途中から記録し直す場合
      var confirmStr;
      if (panoramaDataArrayIdx == panoramaDataArray.length - 1) {
        confirmStr = "続きを記録しますか？";
      } else {
        confirmStr = "この位置から記録し直してもよろしいですか？";
      }
      $("body").append("<div id='dialog'>" + confirmStr + "</div>");
      $("#dialog").dialog({
        autoOpen: false,
        width: 300,
        title: "Confirm",
        modal: true,
        resizable: false,
        buttons: {
          "OK": function() {
            $(this).dialog("close");
            $("#dialog").remove();

            recordMode = 1;

            $("#btnRecord").tooltip("hide").attr("data-original-title", "記録終了").tooltip("fixTitle");
            $("#btnPlay").attr("disabled", "disabled");
            $("#btnStop").attr("disabled", "disabled");
            $("#btnSave").attr("disabled", "disabled");
            $("#btnDelete").attr("disabled", "disabled");

            // 現在の次の地点以降を削除
            panoramaDataArray.splice(panoramaDataArrayIdx + 1, panoramaDataArray.length - 1);
          },
          "Cancel": function() {
            $(this).dialog("close");
            deleteMoveMarkers();
            deleteInfoWindows();
            $("#dialog").remove();

            $("#btnRecord").popover("hide");
            $("#btnPlay").removeAttr("disabled");
            $("#btnStop").removeAttr("disabled");
            $("#btnSave").removeAttr("disabled");
            $("#btnDelete").removeAttr("disabled");
            setCenterPlayBtn();

            return;
          }
        }
      });
      $("#dialog").dialog("open");
    }

  /////////////////////////////////////////////
  // 記録終了
  /////////////////////////////////////////////
  } else {
    recordMode = 0;

    $("#btnRecord").tooltip("hide").attr("data-original-title", "記録").tooltip("fixTitle");

    if (panoramaDataArray.length != 1) {
      $("#btnPlay").removeAttr("disabled");
      $("#btnSave").removeAttr("disabled");
      $("#btnDelete").removeAttr("disabled");
      setCenterPlayBtn();  // display: block だと座標位置がずれる
    }
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");

    //$("#view").removeClass("recording");
    //$("#control").removeClass("recording");
    $("#recording").remove();

    // ゴールマーカー
    var goalMarker = new google.maps.Marker({
      position: panorama.getPosition(),
      map: map,
      animation: google.maps.Animation.DROP,
      icon: "http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld=E|FF0000|000000",
      title: "記録終了地点"
    });
    markers.push(goalMarker);
/*
    // パノラマ表示用スゴールマーカー
    var goalMarker2 = new google.maps.Marker({
      position: panorama.getPosition(),
      map: panorama,
      title: "ゴール地点"
    });
    markers.push(goalMarker2);
    var infowindow = new google.maps.InfoWindow({
      content: "<p style='font-weight: bold'>ゴール地点</p><p>お疲れ様でした。</p>"
    });
    infowindow.open(panorama, goalMarker2);
    InfoWindows.push(infowindow);
*/
    // 再生スライダーを設定
    setPanoramaSlider();
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 記録画面の記録中ラベル生成
//////////////////////////////////////////////////////////////////////////////////////////////
function createRecordingLable() {
  // 左上のDescriptionラベル作成
  var recordingLabelDiv = $("<div id='recording'></div>");
  var recordingLabel = new RecordingLabel(recordingLabelDiv);
  recordingLabelDiv.attr("index", "1");
  panorama.controls[google.maps.ControlPosition.TOP_RIGHT].push(recordingLabelDiv[0]);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 記録画面の記録中ラベル
//////////////////////////////////////////////////////////////////////////////////////////////
function RecordingLabel(labelDiv) {
  labelDiv.css("padding", "5px");

  var labelUI = $("<div></div>");
  labelUI.css("backgroundColor", "red");
  labelUI.css("textAlign", "left");
  labelUI.css("opacity", "0.5");
  labelUI.attr("title", "記録中");
  labelDiv.append(labelUI);

  var labelText = $("<div></div>");
  labelText.css("fontFamily", "Arial,sans-serif");
  labelText.css("fontSize", "16px");
  labelText.css("padding", "2px 7px 2px 7px");
  labelText.html("<strong>記録中...</strong>");
  labelUI.append(labelText);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「再生」ボタン
// targetPanorama: 通常の再生・記録画面のpanorama以外のpanoramaで再生する場合に指定
// increment: 再生回数をインクリメント＋再生履歴を登録する場合：TRUE
// loop: ループ再生する場合:TRUE
//////////////////////////////////////////////////////////////////////////////////////////////
function play(targetPanorama, increment, loop) {
  if (panoramaDataArray.length < 2) {
    $("#message").css("display", "block");  // エラー表示
    deleteMoveMarkers();
    deleteInfoWindows();
    initPanoramaSlider();
    return;
  } else {
    $("#message").css("display", "none");
  }

  if (!targetPanorama) {
    targetPanorama = panorama;
  }
  if (!loop) {
    loop = false;
  }

  /////////////////////////////////////////////
  // 停止 → 再生
  /////////////////////////////////////////////
  if (playMode == 0) {
    playMode = 1;

    $("#btnPlayCenter").remove();

    // 通常の再生以外は再生回数のインクリメント、再生履歴の登録を行わない
    if (increment) {
      // 再生回数をインクリメント
      $.ajax({
        url: "/incrementPlayCount?_id=" + $("#_id").val(),
        cache: false
      });

      // 再生履歴を登録
      $.ajax({
        url: "/playHistory?_id=" + $("#_id").val(),
        cache: false
      });
    }

    $("#btnPlay i").addClass("icon-pause");
    $("#btnPlay i").removeClass("icon-play");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "一時停止").tooltip("fixTitle");
    $("#btnStop").removeAttr("disabled");

    $("#running").css("display", "block");
    $("#panoramaSlider").slider("disable");

    setPanoramaContralEnable(false);

    panoramaDataArrayIdx = 0;

    $("#btnRecord").attr("disabled", "disabled");

    var panoDataFirst = panoramaDataArray[0];

    deleteLines();        // 一旦Map上の既存の線を全て削除
    deleteMoveMarkers();  // 一旦Map上の既存の開始・終了マーカーを削除
    deleteInfoWindows();  //  一旦panorama上の既存のinfoWindowを削除

    $("#distance").html("0m");

    // スタート地点にマーカーを設置
    var startMarker = new google.maps.Marker({
      position: panoData2LatLng(panoDataFirst),
      map: map,
      animation: google.maps.Animation.DROP,
      icon: "http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld=S|33FFFF|000000",
      title: "スタート地点"
    });
    markers.push(startMarker);
/*
    // パノラマ表示用スタート地点マーカー
    var startMarker2 = new google.maps.Marker({
      position: targetPanorama.getPosition(),
      map: targetPanorama,
      title: "スタート地点"
    });
    markers.push(startMarker2);
    var infowindow = new google.maps.InfoWindow({
      content: "<p style='font-weight: bold'>スタート地点　<img src='../images/running.gif'/></p><p>張り切って行きましょう!</p>"
    });
    infowindow.open(targetPanorama, startMarker2);
    InfoWindows.push(infowindow);
*/
    // 位置・向き・角度・ズームを初期化
    targetPanorama.setPosition(panoData2LatLng(panoDataFirst));
    targetPanorama.setPov({
      heading: panoDataFirst.heading,
      pitch: panoDataFirst.pitch
    });
    targetPanorama.setZoom(panoDataFirst.zoom);

    $("#panoramaSlider").slider("value", 1);

    actionInterval(0, targetPanorama, increment, loop);

  //
  /////////////////////////////////////////////
  // 再生 → 一時停止
  /////////////////////////////////////////////
  } else if (playMode == 1) {
    playMode = 2;

    setCenterPlayBtn();

    $("#btnPlay i").addClass("icon-play");
    $("#btnPlay i").removeClass("icon-pause");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");

    $("#running").css("display", "none");

    $("#panoramaSlider").slider("enable");

    setPanoramaContralEnable(true);

  /////////////////////////////////////////////
  // 一時停止 → 再生
  /////////////////////////////////////////////
  } else if (playMode == 2) {
    playMode = 1;

    $("#btnPlayCenter").remove();

    $("#btnPlay i").addClass("icon-pause");
    $("#btnPlay i").removeClass("icon-play");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "一時停止").tooltip("fixTitle");

    $("#running").css("display", "block");

    setPanoramaContralEnable(false);

    actionInterval(panoramaDataArrayIdx, targetPanorama, increment, loop);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 連続再生処理
// arryIdx: 何フレーム目から再生するか
// targetPanorama: 通常の再生・記録画面のpanorama以外のpanoramaで再生する場合に指定
// ループ再生する場合:TRUE
//////////////////////////////////////////////////////////////////////////////////////////////
function actionInterval(arryIdx, targetPanorama, increment, loop) {
  if (!targetPanorama) {
    targetPanorama = panorama;
  }

  /////////////////////////////////////////////
  // 再生
  /////////////////////////////////////////////
  if (playMode == 1) {
    var panoData = panoramaDataArray[arryIdx];
    var panoDataNext = panoramaDataArray[arryIdx + 1];

    arryIdx++;

    // 終了処理
    if (arryIdx >= panoramaDataArray.length) {
      playMode = 0;

      if (loop) {
        play(targetPanorama, increment, loop);
      }

      // ゴール地点にマーカーを設置
      var goalMarker = new google.maps.Marker({
        position: panoData2LatLng(panoData),
        map: map,
        animation: google.maps.Animation.DROP,
        icon: "http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld=E|33FFFF|000000",
        title: "ゴール地点"
      });
      markers.push(goalMarker);
/*
      // パノラマ表示用スゴールマーカー
      var goalMarker2 = new google.maps.Marker({
        position: targetPanorama.getPosition(),
        map: targetPanorama,
        title: "ゴール地点"
      });
      markers.push(goalMarker2);
      var infowindow = new google.maps.InfoWindow({
        content: "<p style='font-weight: bold'>ゴール地点</p><p>お疲れ様でした。</p>"
      });
      infowindow.open(targetPanorama, goalMarker2);
      InfoWindows.push(infowindow);
*/
      $("#btnRecord").removeAttr("disabled");
      $("#btnPlay i").addClass("icon-play");
      $("#btnPlay i").removeClass("icon-pause");
      $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");
      $("#running").css("display", "none");
      $("#panoramaSlider").slider("value", arryIdx);
      $("#panoramaSlider").slider("enable");

      setPanoramaContralEnable(true);

      if (!loop) {  // ループ再生の場合はセンターの再生ボタンは表示不要
        setCenterPlayBtn();
      }
      return;
    }

    // 地点の移動
    if (panoData.lat != panoDataNext.lat || panoData.lng != panoDataNext.lng) {
      currentTimer = setTimeout(function() {
        targetPanorama.setPosition(new google.maps.LatLng(panoDataNext.lat, panoDataNext.lng));
        targetPanorama.setPov({  // POVも一時停止中などに変更されている可能性があるため、設定しておく
          heading: panoDataNext.heading,
          pitch: panoDataNext.pitch
        });
        targetPanorama.setZoom(panoDataNext.zoom);

        var fromLatLng = new google.maps.LatLng(panoData.lat, panoData.lng);
        var toLatLng = new google.maps.LatLng(panoDataNext.lat, panoDataNext.lng);

        // 移動線を描画
        drawPlayLine(fromLatLng, toLatLng);

        // 距離を表示
        $("#distance").html(panoDataNext.distance + "m");

        actionInterval(arryIdx, targetPanorama, increment, loop);
      }, playSpeed);

    // 方向・角度の変更
    } else if (panoData.heading != panoDataNext.heading || panoData.pitch != panoDataNext.pitch) {
      currentTimer = setTimeout(function() {
        targetPanorama.setPov({
          heading: panoDataNext.heading,
          pitch: panoDataNext.pitch
        });

        actionInterval(arryIdx, targetPanorama, increment, loop);
      }, 160);

    // ズームの変更
    } else if (panoData.zoom != panoDataNext.zoom) {
      currentTimer = setTimeout(function() {
        targetPanorama.setZoom(panoDataNext.zoom);

        actionInterval(arryIdx, targetPanorama, increment, loop);
      }, 1000);
    }

    $("#panoramaSlider").slider("value", arryIdx);

    panoramaDataArrayIdx = arryIdx;

  /////////////////////////////////////////////
  // 「停止」ボタン押下直後
  /////////////////////////////////////////////
  } else if (playMode == 0) {
    deleteLines();        // 念のためMap上の既存の線を全て削除
    deleteMoveMarkers();  // 念のためMap上の既存の開始・終了マーカーを削除
    deleteInfoWindows();  // 一旦panorama上の既存のinfoWindowを削除

    setPanoramaContralEnable(true);

    $("#distance").html("0m");

    // 開始地点に戻る
    var panoData = panoramaDataArray[0];
    targetPanorama.setPosition(panoData2LatLng(panoData));
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「停止」ボタン
//////////////////////////////////////////////////////////////////////////////////////////////
function stop() {
  clearTimeout(currentTimer);

  // SteetViewの中心の再生ボタンを再表示
  if (panorama) {
    setCenterPlayBtn();
  }

  playMode = 0;

  // 開始地点に戻る
  var panoData = panoramaDataArray[0];
  if (panorama && panoData) {
    panorama.setPosition(panoData2LatLng(panoData));
    panorama.setPov({
      heading: panoData.heading,
      pitch: panoData.pitch
    });
    panorama.setZoom(panoData.zoom);
  }

  $("#btnPlay i").addClass("icon-play");
  $("#btnPlay i").removeClass("icon-pause");
  if ($("#chkEdit").is(":checked")) $("#btnRecord").removeAttr("disabled");
  $("#btnStop").attr("disabled", "disabled");
  $("#panoramaSlider").slider("enable");
  $("#panoramaSlider").slider("value", 0);

  if (panoramaDataArray.length == 1) {
    $("#arrowRecordBtn").css("display", "block");
  } else {
    $("#btnPlay").removeAttr("disabled");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");
  }

  setPanoramaContralEnable(true);

  deleteLines();        // Map上の既存の線を全て削除
  deleteMoveMarkers();  // Map上の既存の開始・終了マーカーを削除
  deleteInfoWindows();  //  一旦panorama上の既存のinfoWindowを削除

  $("#distance").html("0m");

  $("#running").css("display", "none");

  panoramaDataArrayIdx = 0;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 再生スライダーを現時点のpanoramaDataArrayで初期化
//////////////////////////////////////////////////////////////////////////////////////////////
function setPanoramaSlider() {
  $("#panoramaSlider").slider({
    range: "min",
    value: 1,
    min: 1,
    max: panoramaDataArray.length,
    step: 1,
    slide: function(event, ui) {  // 該当の位置・POVに設定
      var panoData = panoramaDataArray[ui.value - 1];
      var latlng = panoData2LatLng(panoData);
      map.panTo(latlng)
      panorama.setPosition(latlng);
      panorama.setPov({
        heading: panoData.heading,
        pitch: panoData.pitch
      });
      panorama.setZoom(panoData.zoom);
      $("#distance").html(panoData.distance + "m");

      // 一時停止中の場合、再開地点を変更
      panoramaDataArrayIdx = ui.value - 1;

      // スライダー変更地点まで線を引き直す
      deleteLines();
      drawPlayLines(ui.value - 1);
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// PanoramaのControlの有効／無効を切り換える
//////////////////////////////////////////////////////////////////////////////////////////////
function setPanoramaContralEnable(flg) {
  if (panorama) {
    var panoramaOptions = {
      addressControl: flg,
      linksControl: flg,
      panControl: flg,
      clickToGo: flg,
      zoomControl: flg,
      imageDateControl: flg,
      scrollwheel: flg
    };
    panorama.setOptions(panoramaOptions);
  }
  //panorama = new  google.maps.StreetViewPanorama(document.getElementById("streetview"), panoramaOptions);
  //map.setStreetView(panorama);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Map上に記録線を引く
//////////////////////////////////////////////////////////////////////////////////////////////
function drawRecordLine(fromLatLng, toLatLng) {
  var line = new google.maps.Polyline({
    path: [fromLatLng, toLatLng],
    strokeColor: "FF0000",
    strokeOpacity: 1.0,
    strokeWeight: 3
  });
  line.setMap(map);
  lines.push(line);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Map上に再生線を引く
//////////////////////////////////////////////////////////////////////////////////////////////
function drawPlayLine(fromLatLng, toLatLng) {
  var line = new google.maps.Polyline({
    path: [fromLatLng, toLatLng],
    strokeColor: "0000FF",
    strokeOpacity: 1.0,
    strokeWeight: 3
  });
  line.setMap(map);
  lines.push(line);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 指定の場所までの再生線を引く
//////////////////////////////////////////////////////////////////////////////////////////////
function drawPlayLines(panoDataArrayIdx) {
  for (var i = 0; i < panoDataArrayIdx; i++) {
    var panoData = panoramaDataArray[i];
    var panoDataNext = panoramaDataArray[i + 1];

    if (panoData.lat != panoDataNext.lat || panoData.lng != panoDataNext.lng) {
      var fromLatLng = new google.maps.LatLng(panoData.lat, panoData.lng);
      var toLatLng = new google.maps.LatLng(panoDataNext.lat, panoDataNext.lng);
      drawPlayLine(fromLatLng, toLatLng);
    }
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Map上の線を一括削除
//////////////////////////////////////////////////////////////////////////////////////////////
function deleteLines() {
  for (var i = 0; i < lines.length; i++) {
    lines[i].setMap(null);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Map上の記録・再生時の開始・終了マーカーを削除
//////////////////////////////////////////////////////////////////////////////////////////////
function deleteMoveMarkers() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Panorama上のinfoWindowを削除
//////////////////////////////////////////////////////////////////////////////////////////////
function deleteInfoWindows() {
  for (var i = 0; i < InfoWindows.length; i++) {
    InfoWindows[i].setMap(null);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 該当の場所にStreetViewで移動
// 該当場所がStreetView対応とは限らないため、その場合は付近を探す
//////////////////////////////////////////////////////////////////////////////////////////////
function movePanorama(latlng, pano) {
  if (arguments.length == 1) {
    pano = panorama;
  }

  sv.getPanoramaByLocation(latlng, 100, function(data, status) {  // 付近100mを探す
    if (status == google.maps.StreetViewStatus.OK) {
      var panoId = data.location.pano;
      pano.setPano(panoId);
      return true;
    } else {
      return false;
    }
  });
  map.panTo(latlng);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// PanoramaData → google.maps.LatLng
//////////////////////////////////////////////////////////////////////////////////////////////
function panoData2LatLng(panoData) {
  if (panoData) {
    return new google.maps.LatLng(panoData.lat, panoData.lng);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 四捨五入
// 100の位まで四捨五入 → roundEx(n, 2)
// 小数点第2位まで四捨五入 → roundEx(n, -2)
//////////////////////////////////////////////////////////////////////////////////////////////
function roundEx(n, keta) {
  var n2 = Math.floor(n / Math.pow(10, keta));
  n2 = Math.round(n2) * Math.pow(10, keta);
  var str = String(n2);

  // 小数点なし
  if (str.indexOf(".") == -1) {
    return n2;

  // 小数点あり
  } else {
    return Number(str.substring(0, str.indexOf(".") + (keta * -1) + 1));
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 文字列置換
//////////////////////////////////////////////////////////////////////////////////////////////
function replaceAll(expression, org, dest){
  return expression.split(org).join(dest);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 【デバッグ用】
//////////////////////////////////////////////////////////////////////////////////////////////
function showPositionInfo(latlng, pov) {
  if (!DEBUG) {
    return;
  }

  if (latlng) {
    $("#lat").val(latlng.lat());
    $("#lng").val(latlng.lng());
  }

  if (pov) {
    $("#heading").val(pov.heading);
    $("#pitch").val(pov.pitch);
    $("#zoom").val(pov.zoom);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Courseのサムネイル設定
//////////////////////////////////////////////////////////////////////////////////////////////
function setCourseThumbnailFromJSON(num) {
  $.ajax({
    url: "course" + String(num) + ".json",
    cache: true,
    dataType: "json",
    success: function(json) {
      var selectorStr = "#course" + num + "+div h3";

      // タイトル
      if (json.Title) {
        $(selectorStr).text(json.Title);
      }

      // 説明
      if (json.Description) {
        selectorStr += "+p";
        $(selectorStr).text(json.Description);
      }

      // サムネイル
      if (json.Position) {
        var startPosition = new google.maps.LatLng(json.Position[0].lat, json.Position[0].lng);
        var panoramaOptions = {
          position: startPosition,
          pov: {
            // 最初の位置・POVを表示
            heading: Number(json.Position[0].heading),
            pitch: Number(json.Position[0].pitch),
            zoom: Number(json.Position[0].zoom)
          },
          addressControl: false,
          linksControl: false,
          panControl: false,
          clickToGo: false,
          zoomControl: false,
          scrollwheel: false
        };

        var panorama_thumbnail = new google.maps.StreetViewPanorama(document.getElementById("course" + String(num)), panoramaOptions);
      }
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Courseファイルをロード
//////////////////////////////////////////////////////////////////////////////////////////////
function loadCourseFromJSON(num) {
  $.ajax({
    url: "course" + String(num) + ".json",
    cache: true,
    dataType: "json",
    success: function(json) {
      // タイトル
      if (json.Title) {
        $("#title").text(json.Title);
      }

      // 説明
      if (json.Description) {
        $("#description").text(json.Description);
      }

      // 位置情報
      if (json.Position) {
        var retArry = [];
        for (var i = 0; i < json.Position.length; i++) {
          var data = json.Position[i];
          var panoData = new PanoramaData();
          panoData.lat = data.lat;
          panoData.lng = data.lng;
          panoData.heading = Number(data.heading);
          panoData.pitch = Number(data.pitch);
          panoData.zoom = Number(data.zoom);
          panoData.distance = data.distance;
          retArry.push(panoData);
        }
        panoramaDataArray = retArry;

        setPanoramaSlider();

        var panoDataFirst = panoramaDataArray[0];
        panorama.setPosition(panoData2LatLng(panoDataFirst));
        panorama.setPov({
          heading: panoDataFirst.heading,
          pitch: panoDataFirst.pitch
        });
        panorama.setZoom(panoDataFirst.zoom);
      }
    }
  });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// 「見渡す」ボタン
//////////////////////////////////////////////////////////////////////////////////////////////
var heading = 0;
var seeAroundCnt = 0;
function seeAround(headingFlg, angle, originalHeading) {
  var timerId = setInterval(function() {
    panorama.setPov({
      heading: originalHeading + heading,
      pitch: panorama.getPov().pitch
    });
    if (headingFlg == 0) {
      if (heading > angle * -1) {
        heading--;
      } else {
        clearInterval(timerId);
        seeAroundCnt++;
        if (seeAroundCnt < 2) {
          seeAround(1, 45, originalHeading);
        } else {
          seeAroundCnt = 0;
        }
      }
    } else if (headingFlg == 1) {
      if (heading < angle) {
        heading++;
      } else {
        clearInterval(timerId);
        seeAroundCnt++;
        seeAround(0, 0, originalHeading);
      }
    }
  }, 50);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// スムーズなスクロール
//////////////////////////////////////////////////////////////////////////////////////////////
function smoothScroll(elem) {
  var href= elem.attr("href");
  var target = $(href == "#" || href == "" ? 'html' : href);
  var position = target.offset().top - 50;
  $('body,html').animate({scrollTop:position}, 500, 'swing');
}

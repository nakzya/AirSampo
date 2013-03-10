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

var map;
var sv = new google.maps.StreetViewService();
var geocoder;
var panorama;
var panoramaDataArray = [];
var panoramaDataArrayIdx = 0;
var playMode = 0;  // 0:初期状態、停止  1:再生中  2:一時停止中
var lines = [];
var markers = [];
var InfoWindows = [];
var playSpeed = PLAY_SPEED_UNIT * PLAY_SPEDD_SLIDER_INIT_VALUE; // 再生速度(ms)
var distance = 0;
var links = [];
var currentTimer;
var currentPage = 1;

// パノラマデータ構造体
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

// ナビゲーションバー 初期処理
function navInitialize() {
  $("#btnNavSearch").bind("click", function(req, res){
    // 単純に<input type="submit"… にすると、なぜかボタンのアイコンが表示されないため、
    // やむなく <button … で代用
    $("#navSearchForm").submit();
  })
}

// トップ画面のページネーションの設定
function setTopPagination(page, url) {
  $.ajax({
    url: url,   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: true,
    dataType: "json",
    success: function(data) {
      var count = data.count;
      if (data.count > 4 * 10) {   // とりあえず最大10ページ
        count = 4 * 10;
      }

      $("#pagination ul *").remove();  // 一旦ページネーションを全て削除

      var ul = $("#pagination ul");

      // Prev
      var prevLi = $("<li><a href='javascript:void(0)'>Prev</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "setCourseThumbnail(" + (page - 1) + "); setTopPagination(" + (page - 1) + ", '" + url + "')");
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
          li.attr("onclick", "setCourseThumbnail(" + i + "); setTopPagination(" + i + ", '" + url + "')");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='javascript:void(0)'>Next</a></li>");
      if (page == lastPage) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "setCourseThumbnail(" + (page + 1) + "); setTopPagination(" + (page + 1) + ", '" + url + "')");
      }
      ul.append(nextLi);
    }
  });
}

// 検索結果画面のページネーションの設定
function setSearchPagination(page, url, searchWord) {
  $.ajax({
    url: url,   // 件数を引数として受け取るようにすると、再帰的に呼び出す際に不都合がある（件数の増減に対応できない）
    cache: false,
    dataType: "json",
    success: function(data) {
      var count = data.count;

      $("#pagination ul *").remove();  // 一旦ページネーションを全て削除

      var ul = $("#pagination ul");

      // Prev
      var prevLi = $("<li><a href='javascript:void(0)'>Prev</a></li>");
      if (page == 1) {   // 最初のページの場合、disabled
        prevLi.addClass("disabled");
        prevLi.removeAttr("onclick");
      } else {
        prevLi.attr("onclick", "search('" + searchWord + "', " + (page - 1) + "); setSearchPagination(" + (page - 1) + ", '" + url + "', '" + searchWord + "')");
      }
      ul.append(prevLi);

      var lastPage = Math.floor((count - 1) / (SEARCH_RESULT_MAX_ROW * SEARCH_RESULT_MAX_COL)) + 1;
      for (var i = 1; i <= lastPage; i++) {
        var li = $("<li><a href=javascript:void(0)'>" + String(i) + "</a></li>");
        if (i == page) {
          li.addClass("active");
          li.removeAttr("onclick");
        } else {
          li.attr("onclick", "search('" + searchWord + "', " + String(i) + "); setSearchPagination(" + String(i) + ", '" + url + "', '" + searchWord + "')");
        }
        ul.append(li);
      }

      // Next
      var nextLi = $("<li><a href='javascript:void(0)'>Next</a></li>");
      if (page == lastPage || count == 0) {  // 最終ページの場合、disabled
        nextLi.addClass("disabled");
        nextLi.removeAttr("onclick");
      } else {
        nextLi.attr("onclick", "search('" + searchWord + "', " + (page + 1) + "); setSearchPagination(" + (page + 1) + ", '" + url + "', '" + searchWord + "')");
      }
      ul.append(nextLi);
    }
  });
}

// ナビゲーションバー表示処理
function setNavigationBar(mode) {
  $.ajax({
    url: "./navigationBar.html",
    success: function(html) {
      $("#navigationBar").html(html);

      switch(mode) {
        case "record":
          $("#recordLink").attr("class", "active");
          break;
        case "ranking":
          $("#rankingLink").attr("class", "active");
          break;
        case "about":
          $("#aboutLink").attr("class", "active");
          break;
      }
    }
  });
}

// フッタ表示処理
function setFooter() {
  $.ajax({
    url: "./footer.html",
    success: function(html) {
      $("#footer").html(html);
    }
  });
}

// 画面共通 初期処理
function initialize() {
  switch(arguments[0]) {
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
  }

  // ナビゲーションバー設定
  setNavigationBar(arguments[0]);

  // フッタ設定
  setFooter();
}

// トップ画面 初期処理
function topInitialize() {
  $(".loading").css("display", "none");

  // 初期表示コースのサムネイル設定
  setCourseThumbnail(1);

  // 新着情報表示
  showNewArrival();

  // ナビゲーションバー初期処理
  navInitialize()

  // ページネーションの設定
  setTopPagination(1, "/pagination/top");

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

// 再生・記録画面 共通 初期処理
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
  google.maps.event.trigger(panorama, 'resize');
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
    getCurrentPosition();
    event.preventDefault();
  });

  // 「再生」ボタン クリックイベント
  $("#btnPlay").bind("click", function(event) {
    play();
    event.preventDefault();
  });

  // 「停止」ボタン クリックイベント
  $("#btnStop").bind("click", function(event) {
    stop();
    event.preventDefault();
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

// 再生画面 初期処理
function playInitialize() {
  var _id = arguments[0][1];

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
}

// 記録画面 初期処理
function recordInitialize() {
  var _id = arguments[0][1];

  // 記録確定後、再表示する場合
  if (_id != "") {
    // 移動位置情報をDBからロード
    loadCourse(_id);

    $("#btnPlay").removeAttr("disabled");
    $("#btnStop").removeAttr("disabled");

  } else {
     map.setZoom(4);
     initPanoramaSlider();
  }

  links = [];

  // タグ 初期処理
  $("#tagList").tagit();

  // StreetViewイベントハンドラ追加 "position_changed"
  google.maps.event.addListener(panorama, "position_changed", function() {
    showPositionInfo(panorama.getPosition(), panorama.getPov());

    if (recordFlg == 1) {
      // 移動ラインを描画
      var fromLatLng = new google.maps.LatLng(panoramaDataArray[panoramaDataArray.length - 1].lat, panoramaDataArray[panoramaDataArray.length - 1].lng);
      var toLatLng = new google.maps.LatLng(panorama.getPosition().lat(), panorama.getPosition().lng());
      drawRecordLine(fromLatLng, toLatLng);

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
    if (recordFlg == 1 && String(zoom).match(/^-?[0-9]+$/) != null) {  // ズームが整数の場合のみ
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

  // 「確定」ボタン クリックイベント
  $("#btnSave").bind("click", function(event) {
    if (panoramaDataArray.length == 0) {
      alert("確定するデータがありません。");
      return;
    }

    // 「タイトル」 必須チェック
    if ($("#txtTitle").val() == "" || $("#txtTitle").val().length == 0) {
      if (!$("#txtTitle").parent().parent().hasClass("error")) {
        var errorMsgSpan = $("<span id='msgSpan' class='help-inline'>タイトルを入れて下さい。</span>");
        $("#txtTitle").parent().parent().addClass("error");
        $("#txtTitle").parent().append(errorMsgSpan);
      }
      return;
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

    // DBに書き込み
    $("#saveForm").submit();

    alert("確定しました！");

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

    event.preventDefault();
  });
}

// ランキング画面 初期処理
function rankingInitialize() {
  // ランキングデータを表示
  setRanking(1);
}

// 検索結果画面 初期処理
function searchResultInitialize() {
  var searchWord = arguments[0][1];

  // 検索結果を表示
  search(searchWord, 1);

  // ページネーションの設定
  setSearchPagination(1, "/pagination/search?searchWord=" + searchWord, searchWord);
}

// サムネイル情報を設定
function setCourseThumbnail(page) {
  // 一旦全て非表示に
  $("ul.thumbnails li").css("display", "none");

  $(".loading").css("display", "block");

  $.ajax({
    url: "/course?page=" + page,
    cache: true,
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
        if (course.position) {
          var position = JSON.parse(course.position[0]);
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

    // サムネイルを静止画で表示する場合（こっちのほうが軽い）　※ただし場所によっては画像が取れないことがある しかもその判定は不可
    /*
    var thumbnailImg = "<img src=\"http://maps.googleapis.com/maps/api/streetview?size=360x200&location=" + json.Position[0].lat + "," + json.Position[0].lng + "&heading=" + json.Position[0].heading + "&pitch=" + json.Position[0].pitch + "&sensor=false\" />";
    $("#course" + String(num)).append(thumbnailImg);
    */

    // 初期LatLngがGray表示の場合があるため
    //movePanorama(startPosition, panorama_thumbnail);
    }
  });
}

// Course情報をDBから読み込んでクライアントに展開
function loadCourse(_id) {
  $.ajax({
    url: "/loadCourse?_id=" + _id,
    cache: false,
    dataType: "json",
    success: function(courses) {
      // タイトル
      if (courses.title) {
        $("#title").text(courses.title);
      }

      // 説明
      if (courses.description) {
        $("#description").text(courses.description);
      }

      // 位置情報
      if (courses.position) {
        var retArry = [];
        for (var i = 0; i < courses.position.length; i++) {
          var data = JSON.parse(courses.position[i]);
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

// 検索結果を表示
function search(searchWord, page) {
  // 一旦全て非表示に
  $("ul.thumbnails li").css("display", "none");

  $.ajax({
    url: "/searchResult?searchWord=" + searchWord + "&page=" + page,
    cache: false,
    dataType: "json",
    success: function(courses) {
      var searchResultDiv = $("#searchResult");
      for (var i = 1; i <= SEARCH_RESULT_MAX_ROW; i++) {
        var ul = $("<ul class='thumbnails'>");

        for (var j = 1; j <= SEARCH_RESULT_MAX_COL; j++) {
          var idx = (i - 1) * SEARCH_RESULT_MAX_COL + j;  // 1（≠0）～カウント
          var course = courses[idx - 1];
          if (!course) { break; }

          var li = $("<li id='thumbnail" + idx + "' class='span4'></li>");
          var div1 = $("<div class='thumbnail'></div>");

          // サムネイル
          var div2 = $("<div id='course" + idx + "'></div>");
          var firstPosition = JSON.parse(course.position[0]);
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

        // 検索件数
        $("#searchResultCount").text(courses.length);
      }
    }
  });
}

// ランキングデータを表示
function setRanking(page) {
  // 一旦全て非表示に
  $("ul.thumbnails li").css("display", "none");

  $.ajax({
    url: "/ranking/select?page=" + page,
    cache: false,
    dataType: "json",
    success: function(courses) {
      var rankingDiv = $("#ranking");
      var ul = $("<ul class='thumbnails'>");
      for (var i = 0; i < courses.length; i++) {
        var course = courses[i];
        if (!course) { break; }

        var li = $("<li id='thumbnail" + (i + 1) + "' class='span8'></li>");
        var div1 = $("<div class='row' style='border: none; margin-bottom: 50px'></div>");

        // サムネイル
        var div2 = $("<div id='course" + (i + 1) + "' class='span4'></div>");
        var firstPosition = JSON.parse(course.position[0]);
        var imgLink = $("<a href='/play?_id=" + course._id + "'></a>");
        var thumbnailImg = "<img src='http://maps.googleapis.com/maps/api/streetview?size=360x250&location=" + firstPosition.lat + "," + firstPosition.lng + "&heading=" + firstPosition.heading + "&pitch=" + firstPosition.pitch + "&sensor=false'\"' />";
        imgLink.append(thumbnailImg);
        div2.append(imgLink);

        var div3 = $("<div class='caption span4'></div>");

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
      rankingDiv.append(ul);
    }
  });
}

// 新着情報を表示
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

// おすすめを表示
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

// サイドバーのコース情報を設定
function setSideBarCourse(ul, courses) {
  for (var i = 0; i < courses.length; i++) {
    var course = courses[i];
    var firstPosition = JSON.parse(course.position[0]);
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

// 再生スライダーを初期化
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

// 「現在地」ボタン
function getCurrentPosition() {
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      movePanorama(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
    },
    function() {
      alert("ご使用のブラウザはGoeLocation（現在地取得機能）に対応していません。");
    });
  }
}

// 「記録」ボタン
var recordFlg = 0;  // 0:記録していない 1:記録中
function toggleRecord() {
  // 記録開始
  if (recordFlg == 0) {
    if (panoramaDataArrayIdx == 0) {  // 初めての記録、または最初から記録し直す場合
      recordFlg = 1;

      $("#btnRecord").tooltip("hide").attr("data-original-title", "記録終了").tooltip("fixTitle");
      /*
      $("#btnRecord").popover({
        content: "もう一度押すと記録を終了します。",
        placement: "bottom"
      }).popover("show");
      */
      $("#btnPlay").attr("disabled", "disabled");
      $("#btnStop").attr("disabled", "disabled");
      $("#arrowRecordBtn").css("display", "none");

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
        title: "スタート地点"
      });
      markers.push(startMarker);

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

            recordFlg = 1;

            $("#btnRecord").tooltip("hide").attr("data-original-title", "記録終了").tooltip("fixTitle");
            $("#btnRecord").popover({
              content: "もう一度押すと記録を終了します。",
              placement: "bottom"
            }).popover("show");
            $("#btnPlay").attr("disabled", "disabled");
            $("#btnStop").attr("disabled", "disabled");

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

            return;
          }
        }
      });
      $("#dialog").dialog("open");
    }

  // 記録終了
  } else {
    recordFlg = 0;

    $("#btnRecord").tooltip("hide").attr("data-original-title", "記録").tooltip("fixTitle");

    if (panoramaDataArray.length == 1) {
      $("#arrowRecordBtn").css("display", "block");
    } else {
      $("#btnPlay").removeAttr("disabled");
    }
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");

    // ゴールマーカー
    var goalMarker = new google.maps.Marker({
      position: panorama.getPosition(),
      map: map,
      animation: google.maps.Animation.DROP,
      title: "記録終了地点"
    });
    markers.push(goalMarker);

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

    // 再生スライダーを設定
    setPanoramaSlider();
  }
}

// 「再生」ボタン
function play() {
  if (panoramaDataArray.length < 2) {
    $("#message").css("display", "block");  // エラー表示
    deleteMoveMarkers();
    deleteInfoWindows();
    initPanoramaSlider();
    return;
  } else {
    $("#message").css("display", "none");
  }

  // 停止 → 再生
  if (playMode == 0) {
    playMode = 1;

    // 再生回数をインクリメント
    $.ajax({
      url: "/incrementPlayCount?_id=" + $("#_id").val(),
      cache: false
    });

    $("#btnPlay i").addClass("icon-pause");
    $("#btnPlay i").removeClass("icon-play");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "一時停止").tooltip("fixTitle");
    $("#btnStop").removeAttr("disabled");

    $("#running").css("display", "block");
    $("#panoramaSlider").slider("disable");

    //setPanoramaContralEnable(false);

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
      title: "スタート地点"
    });
    markers.push(startMarker);

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

    // 位置・向き・角度・ズームを初期化
    panorama.setPosition(panoData2LatLng(panoDataFirst));
    panorama.setPov({
      heading: panoDataFirst.heading,
      pitch: panoDataFirst.pitch
    });
    panorama.setZoom(panoDataFirst.zoom);

    $("#panoramaSlider").slider("value", 1);

    actionInterval(0);

  // 再生 → 一時停止
  } else if (playMode == 1) {
    playMode = 2;

    $("#btnPlay i").addClass("icon-play");
    $("#btnPlay i").removeClass("icon-pause");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");

    $("#running").css("display", "none");

    $("#panoramaSlider").slider("enable");

    //setPanoramaContralEnable(true);

  // 一時停止 → 再生
  } else if (playMode == 2) {
    playMode = 1;

    $("#btnPlay i").addClass("icon-pause");
    $("#btnPlay i").removeClass("icon-play");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "一時停止").tooltip("fixTitle");

    $("#running").css("display", "block");

    //setPanoramaContralEnable(false);

    actionInterval(panoramaDataArrayIdx);
  }
}

// 連続再生処理
function actionInterval(arryIdx) {
  if (playMode == 1) {
    var panoData = panoramaDataArray[arryIdx];
    var panoDataNext = panoramaDataArray[arryIdx + 1];

    arryIdx++;

    // 終了処理
    if (arryIdx >= panoramaDataArray.length) {
      playMode = 0;

      // ゴール地点にマーカーを設置
      var goalMarker = new google.maps.Marker({
        position: panoData2LatLng(panoData),
        map: map,
        animation: google.maps.Animation.DROP,
        title: "ゴール地点"
      });
      markers.push(goalMarker);

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

      $("#btnRecord").removeAttr("disabled");
      $("#btnPlay i").addClass("icon-play");
      $("#btnPlay i").removeClass("icon-pause");
      $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");
      $("#running").css("display", "none");
      $("#panoramaSlider").slider("value", arryIdx);
      $("#panoramaSlider").slider("enable");

      return;
    }

    // 地点の移動
    if (panoData.lat != panoDataNext.lat || panoData.lng != panoDataNext.lng) {
      currentTimer = setTimeout(function() {
        panorama.setPosition(new google.maps.LatLng(panoDataNext.lat, panoDataNext.lng));
        panorama.setPov({  // POVも一時停止中などに変更されている可能性があるため、設定しておく
          heading: panoDataNext.heading,
          pitch: panoDataNext.pitch
        });
        panorama.setZoom(panoDataNext.zoom);

        var fromLatLng = new google.maps.LatLng(panoData.lat, panoData.lng);
        var toLatLng = new google.maps.LatLng(panoDataNext.lat, panoDataNext.lng);

        // 移動線を描画
        drawPlayLine(fromLatLng, toLatLng);

        // 距離を表示
        $("#distance").html(panoDataNext.distance + "m");

        actionInterval(arryIdx);
      }, playSpeed);

    // 方向・角度の変更
    } else if (panoData.heading != panoDataNext.heading || panoData.pitch != panoDataNext.pitch) {
      currentTimer = setTimeout(function() {
        panorama.setPov({
          heading: panoDataNext.heading,
          pitch: panoDataNext.pitch
        });

        actionInterval(arryIdx);
      }, 160);

    // ズームの変更
    } else if (panoData.zoom != panoDataNext.zoom) {
      currentTimer = setTimeout(function() {
        panorama.setZoom(panoDataNext.zoom);

        actionInterval(arryIdx);
      }, 1000);
    }

    $("#panoramaSlider").slider("value", arryIdx);

    panoramaDataArrayIdx = arryIdx;

  // 「停止」ボタン押下直後
  } else if (playMode == 0) {
    deleteLines();        // 念のためMap上の既存の線を全て削除
    deleteMoveMarkers();  // 念のためMap上の既存の開始・終了マーカーを削除
    deleteInfoWindows();  //  一旦panorama上の既存のinfoWindowを削除

    $("#distance").html("0m");

    // 開始地点に戻る
    var panoData = panoramaDataArray[0];
    panorama.setPosition(panoData2LatLng(panoData));
  }
}

// 「停止」ボタン
function stop() {
  clearTimeout(currentTimer);

  playMode = 0;

  // 開始地点に戻る
  var panoData = panoramaDataArray[0];
//  if (panoData) {
    panorama.setPosition(panoData2LatLng(panoData));
    panorama.setPov({
      heading: panoData.heading,
      pitch: panoData.pitch
    });
    panorama.setZoom(panoData.zoom);
//  }

  $("#btnRecord").removeAttr("disabled");
  $("#btnPlay i").addClass("icon-play");
  $("#btnPlay i").removeClass("icon-pause");
  $("#btnStop").attr("disabled", "disabled");
  $("#panoramaSlider").slider("enable");
  $("#panoramaSlider").slider("value", 0);

  if (panoramaDataArray.length == 1) {
    $("#arrowRecordBtn").css("display", "block");
  } else {
    $("#btnPlay").removeAttr("disabled");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");
  }

  deleteLines();        // Map上の既存の線を全て削除
  deleteMoveMarkers();  // Map上の既存の開始・終了マーカーを削除
  deleteInfoWindows();  //  一旦panorama上の既存のinfoWindowを削除

  $("#distance").html("0m");

  $("#running").css("display", "none");

  panoramaDataArrayIdx = 0;
}

// 再生スライダーを現時点のpanoramaDataArrayで初期化
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

// PanoramaのControlの有効／無効を切り換える
function setPanoramaContralEnable(flg) {
  var panoramaOptions = {
    clickToGo: flg,
    addressControl: flg,
    panControl: flg,
    clickToGo: flg,
    linksControl: flg,
    imageDateControl: false
  };
  panorama = new  google.maps.StreetViewPanorama(document.getElementById("streetview"), panoramaOptions);
  map.setStreetView(panorama);
}

// Map上に記録線を引く
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

// Map上に再生線を引く
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

// 指定の場所までの再生線を引く
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

// Map上の線を一括削除
function deleteLines() {
  for (var i = 0; i < lines.length; i++) {
    lines[i].setMap(null);
  }
}

// Map上の記録・再生時の開始・終了マーカーを削除
function deleteMoveMarkers() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
}

// Panorama上のinfoWindowを削除
function deleteInfoWindows() {
  for (var i = 0; i < InfoWindows.length; i++) {
    InfoWindows[i].setMap(null);
  }
}

// 該当の場所にStreetViewで移動
// 該当場所がStreetView対応とは限らないため、その場合は付近を探す
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

// PanoramaData → google.maps.LatLng
function panoData2LatLng(panoData) {
  if (panoData) {
    return new google.maps.LatLng(panoData.lat, panoData.lng);
  }
}

// 四捨五入
// 100の位まで四捨五入 → roundEx(n, 2)
// 小数点第2位まで四捨五入 → roundEx(n, -2)
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

// 【デバッグ用】
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

// Courseのサムネイル設定
function setCourseThumbnailFromJSON(num) {
  $.ajax({
    url: "course" + String(num) + ".json",
    cache: false,
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

// Courseファイルをロード
function loadCourseFromJSON(num) {
  $.ajax({
    url: "course" + String(num) + ".json",
    cache: false,
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

// 「見渡す」ボタン
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

function smoothScroll(elem) {
  var href= elem.attr("href");
  var target = $(href == "#" || href == "" ? 'html' : href);
  var position = target.offset().top - 50;
  $('body,html').animate({scrollTop:position}, 500, 'swing');
}

var DEBUG = true;

var INIT_LAT = 35.681747;
var INIT_LNG = 139.765491;

// 秋芳洞
//var INIT_LAT = 34.229152;
//var INIT_LNG  =131.30274399999996;

var INIT_HEADING = 127.70307765233667;
var INIT_PITCH = 1.9147722283955624;
var PLAY_SPEED_UNIT = 50;
var PLAY_SPEDD_SLIDER_INIT_VALUE = 20;

var map;
var sv = new google.maps.StreetViewService();
var geocoder;
var panorama;
var panoramaDataArray = [];
var panoramaDataArrayIdx = 0;
var playMode = 0;  // 0:初期状態、停止  1:再生中  2:一時停止中
var lines = [];
var markers = [];
var playSpeed = PLAY_SPEED_UNIT * PLAY_SPEDD_SLIDER_INIT_VALUE; // 再生速度(ms)
var distance = 0;
var currentTimer;

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

// トップ画面 初期処理
function initialize() {
  // サンプルコースのサムネイル設定
  for (var i = 1; i <= 6; i++) {
    setCourseThumbnail(i);
  }
  
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
  
  $("#btnCourse5").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });

  $("#btnCourse6").bind("click", function(event) {
    stop();  // 念のため停止処理
    event.preventDefault();
  });
}

// 共通 初期処理
function common_initialize() {
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
  });
*/
  
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
  
  // 「見渡す」ボタン クリックイベント
  $("#btnSeeAround").bind("click", function(event) {
    seeAround(0, 45, panorama.getPov().heading);
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
function play_initialize(no) {
  // 共通初期処理
  common_initialize();

  // StreetViewイベントハンドラ追加 "position_changed"
  google.maps.event.addListener(panorama, "position_changed", function() {
    showPositionInfo(panorama.getPosition(), panorama.getPov());
    
    map.panTo(panorama.getPosition());
  });
  
  // StreetViewイベントハンドラ追加 "pov_changed"
  google.maps.event.addListener(panorama, "pov_changed", function() {  // zoom_changedイベントを含む
    showPositionInfo(panorama.getPosition(), panorama.getPov());
  });

  loadCourseJSON(no);
}

// 記録画面 初期処理
function record_initialize() {
  // 共通初期処理
  common_initialize();
  
  map.setZoom(4);
  
  initPanoramaSlider();

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
  
  // データ書き込み用InfoWindow作成
  $("#btnWrite").bind("click", function(event) {
    var str = '{"Position":[\n'
    for (var i = 0; i < panoramaDataArray.length; i++) {
      var panoData = panoramaDataArray[i];
      str += ('  {"lat":"' + panoData.lat + '","lng":"' + panoData.lng + '","heading":"' + panoData.heading + '","pitch":"' + panoData.pitch + '","zoom":"' + panoData.zoom + '","distance":"' + panoData.distance + '"}');
      if (i < panoramaDataArray.length - 1) {
        str += ',';
      }
      str += '\n';
    }
    str += ']}';
    $("#outputArea").text(str);
  });
}

// Courseのサムネイル設定
function setCourseThumbnail(num) {
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
          zoomControl: false
        };
        
        var panorama_thumbnail = new google.maps.StreetViewPanorama(document.getElementById("course" + String(num)), panoramaOptions);
        
        // 初期LatLngがGray表示の場合があるため
        //movePanorama(startPosition, panorama_thumbnail);
      }
    }
  });
}

// Courseファイルをロード
function loadCourseJSON(num) {
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

/*
function smoothScroll(elem) {
  var href= elem.attr("href");
  var target = $(href == "#" || href == "" ? 'html' : href);
  var position = target.offset().top - 50;
  $('body,html').animate({scrollTop:position}, 500, 'swing');
}
*/

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

// 「記録する」ボタン
var recordFlg = 0;  // 0:記録していない 1:記録中
function toggleRecord() {
  // 記録開始
  if (recordFlg == 0) {  // 初めての記録、または最初から記録し直す場合
    if (panoramaDataArrayIdx == 0) {
      recordFlg = 1;
      
      $("#btnRecord").tooltip("hide").attr("data-original-title", "記録終了").tooltip("fixTitle");
      $("#btnRecord").popover({
        content: "もう一度押すと記録を終了します。",
        placement: "bottom"
      }).popover("show");
      $("#btnPlay").attr("disabled", "disabled");
      $("#btnStop").attr("disabled", "disabled");
      $("#btnSeeAround").attr("disabled", "disabled");
      
      map.setZoom(15);
      
      deleteLines();        // 一旦Map上の既存の線を全て削除
      deleteMoveMarkers();  // 一旦Map上の既存の開始・終了マーカーを削除
      
      recordDistance = 0;
      $("#distance").html("0m");
      
      // 記録開始地点にマーカーを設置
      var startMarker = new google.maps.Marker({
        position: panorama.getPosition(),
        map: map,
        animation: google.maps.Animation.DROP,
        title: "記録開始地点"
      });
      markers.push(startMarker);
      
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
            $("#btnSeeAround").attr("disabled", "disabled");
            
            // 現在の地点以降を削除
            panoramaDataArray.splice(panoramaDataArrayIdx + 1, panoramaDataArray.length - 1);
          },
          "Cancel": function() {
            $(this).dialog("close");
            deleteMoveMarkers();
            $("#dialog").remove();
            
            $("#btnRecord").popover("hide");
            $("#btnPlay").removeAttr("disabled");
            $("#btnStop").removeAttr("disabled");
            $("#btnSeeAround").removeAttr("disabled");
            
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
    $("#btnPlay").removeAttr("disabled");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "再生").tooltip("fixTitle");
    $("#btnStop").removeAttr("disabled");
    $("#btnStop").tooltip("hide").attr("data-original-title", "停止").tooltip("fixTitle");
    $("#btnSeeAround").removeAttr("disabled");
  
    // 記録終了地点にマーカーを設置
    var endMarker = new google.maps.Marker({
      position: panorama.getPosition(),
      map: map,
      animation: google.maps.Animation.DROP,
      title: "記録終了地点"
    });
    markers.push(endMarker);
    
    // 再生スライダーを設定
    setPanoramaSlider();
  }
}

// 「再生」ボタン
function play() {
  if (panoramaDataArray.length < 2) {
    $("#message").css("display", "block");  // エラー表示
    deleteMoveMarkers();
    initPanoramaSlider();
    return;
  
  } else {
    $("#message").css("display", "none");
  }
  
  // 停止 → 再生
  if (playMode == 0) {
    playMode = 1;
    $("#btnPlay i").addClass("icon-pause");
    $("#btnPlay i").removeClass("icon-play");
    $("#btnPlay").tooltip("hide").attr("data-original-title", "一時停止").tooltip("fixTitle");
    
    $("#running").css("display", "block");
    $("#panoramaSlider").slider("disable");

    //setPanoramaContralEnable(false);

    panoramaDataArrayIdx = 0;
    
    $("#btnRecord").attr("disabled", "disabled");
    
    var panoDataFirst = panoramaDataArray[0];
    
    deleteLines();        // 一旦Map上の既存の線を全て削除
    deleteMoveMarkers();  // 一旦Map上の既存の開始・終了マーカーを削除
    
    $("#distance").html("0m");
    
    // スタート地点にマーカーを設置
    var startMarker = new google.maps.Marker({
      position: panoData2LatLng(panoDataFirst),
      map: map,
      animation: google.maps.Animation.DROP,
      title: "スタート地点"
    });
    markers.push(startMarker);
    
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

      $("#btnSeeAround").removeAttr("disabled");
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
      }, 100);

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
    
    $("#distance").html("0m");

    // 開始地点に戻る
    var panoData = panoramaDataArray[0];
    panorama.setPosition(panoData2LatLng(panoData));
  }
}

// 「停止」ボタン
function stop() {
  clearTimeout(currentTimer);
  
  // 開始地点に戻る
  var panoData = panoramaDataArray[0];
  panorama.setPosition(panoData2LatLng(panoData));
  panorama.setPov({
    heading: panoData.heading,
    pitch: panoData.pitch
  });
  panorama.setZoom(panoData.zoom);
  
  playMode = 0;

  $("#btnRecord").removeAttr("disabled");
  $("#btnPlay i").addClass("icon-play");
  $("#btnPlay i").removeClass("icon-pause");
  $("#btnSeeAround").removeAttr("disabled");
  $("#panoramaSlider").slider("enable");
  $("#panoramaSlider").slider("value", 0);
  
  deleteLines();        // Map上の既存の線を全て削除
  deleteMoveMarkers();  // Map上の既存の開始・終了マーカーを削除
    
  $("#distance").html("0m");
  
  $("#running").css("display", "none");
  
  panoramaDataArrayIdx = 0;
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
    linksControl: flg
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
  return new google.maps.LatLng(panoData.lat, panoData.lng);
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

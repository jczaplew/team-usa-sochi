(function() {
  var map = new L.Map('map', {
    center: new L.LatLng(38.95940879245423, -95.537109375),
    zoom: 4,
    maxZoom:10,
    minZoom: 4,
    zoomControl: false,
    inertiaDeceleration: 6000,
    inertiaMaxSpeed: 1000,
    zoomAnimationThreshold: 1
  });

  // Hide the sidebar when the map is zoomed or panned
  map.on('movestart', function() {
    closeContent();
  });

  // Put the zoom control in the top right corner
  L.control.zoom({'position': 'topright'}).addTo(map);

  var attrib = 'Map tiles by <a href="http://stamen.com" target="_blank">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0" target="_blank">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0" target="_blank">CC BY SA</a>. | Athlete data - <a href="http://teamusa.org" target="_blank">teamusa.org</a>';

  var stamenLabels = new L.TileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {attribution: attrib}).addTo(map);

  // Controller for displaying city name and number of athletes
  var info = L.control({'position': 'bottomright'});
  info.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'info');
    return this._div;
  }
  info.update = function(data) {
      this._div.innerHTML = '<h4>' + data.name + '</h4><p>' + data.members.length + ' Athlete(s)</p>';
  }
  info.addTo(map);

  // Controller for displaying current map filter, if any
  var layerIndicator = L.control({'position': 'topright'});
  layerIndicator.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'layerIndicator');
    return this._div;
  }
  layerIndicator.update = function(data) {
      this._div.innerHTML = '<h4>' + data+ '</h4><button class="btn btn-info showAll">Show all sports</button>';
  }
  layerIndicator.addTo(map);

  // Map marker style
   var style = {
    fillColor: "#719fbd",
    color: "#6597B8",
    weight: 2.5,
    opacity: 1,
    fillOpacity: 0.95
  };

  // Scale for mapping number of athletes to marker radius
  var scale = d3.scale.linear()
      .domain([1, 36])
      .range([8, 35]);

  // Template for viewing athletes in sidebar
  var template = "<h4>{{name}}</h4><p class='text-muted'>{{members.length}} Athlete(s)</p><table>{{#members}}<tr><td><img src='http://teamusa.org{{picture}}'/></td><td class='athleteInfo'><a href='{{link}}' target='_blank'>{{name}}</a><p class='text-muted'>{{sport}}</p></td></tr>{{/members}}</table>";

  // Factory for making map markers
  function parseMapMarker(d) {
    var ll = new L.LatLng(d.lat, d.lng),
        radius = scale(d.members.length),
        point = new L.circleMarker(ll, style);

    point.data = d;
    point.setRadius(radius);

    point.on('mouseover', function(d) {
      info.update(d.target.data);
      d3.select(".info").style("display", "block");
      this.setStyle({'color': '#777'});
    });

    point.on('mouseout', function(d) {
      d3.select(".info").style("display", "none");
      this.setStyle({'color': "#6597B8"});
    });

    point.on('click', function(d) {
      map.panTo(d.latlng);
      var html = Mustache.render(template, d.target.data);
      d3.select("#content").html(html);
      d3.select("#contentHolder").transition().duration(1000).style("left", "15px")
    });

    return point;
  }

  // Layer group to hold all cities, unfiltered
  var locationLayer = new L.featureGroup();

  // Load the data for the initial map view - all cities all athletes
  d3.json("data/locations.json", function(error, locations) {
    locations.forEach(function(d) {
      var city = parseMapMarker(d);
      locationLayer.addLayer(city);
    });
    locationLayer.addTo(map);
  });

  // Object for holding a leaflet feature group for each sport
  var sportLayers = {};

  // Load the data for filtered map views
  d3.json("data/sports.json", function(error, sports) {
    sports.forEach(function(d) {
      sportLayers[d.name.replace(/ /g,'_')] = new L.featureGroup();

      // Dynamically retrieve the maximum number of athletes in a city
      var maxes = [];
      d.locations.forEach(function(j) {
        maxes.push(j.members.length);
      });

      // Alter the radius mapping scale accordingly
      var scale = d3.scale.linear()
        .domain([1, d3.max(maxes)])
        .range([8, 25]);

      // Parse the data - one featuregroup for each sport
      d.locations.forEach(function(j) {
        var city = parseMapMarker(j);
        sportLayers[d.name.replace(/ /g,'_')].addLayer(city);
      });
    });

    // Initialize the autocomplete search box
      /* This happens inside the callback of loading the data so that we can use it 
         as a data source for the autocomplete without scopping it up */
    var autocomplete = $("#autocompleteInput").typeahead({
      name: 'sports',
      local: sports,
      valueKey: 'name',
      limt: 10
    });

    autocomplete.on("typeahead:selected", function(event, data) {
      //openContent();

      if (map.hasLayer(locationLayer)) {
        map.removeLayer(locationLayer);
      } else {
        for (var sport in sportLayers) {
          if (map.hasLayer(sportLayers[sport])) {
            map.removeLayer(sportLayers[sport]);
          }
        }
      }
      var layerName = data.name.replace(/ /g, '_');
      map.addLayer(sportLayers[layerName]);

      layerIndicator.update(data.name);
      d3.select(".layerIndicator").style("display", "block");
      $("#autocompleteInput").typeahead("setQuery", "");
      $(".navbar-collapse").css("height", "auto");
      $(".navbar-collapse").css("max-height", "340px");
      rebindShowAll();
    });

    autocomplete.on("typeahead:opened", function(event) {
      d3.select(".layerIndicator").style("display", "none");
    });

    autocomplete.on("typeahead:closed", function(event) {
      if (map.hasLayer(locationLayer)) {
        return;
      } else {
        d3.select(".layerIndicator").style("display", "block");
      }
    });

    autocomplete.on("typeahead:initialized", function() {
      $(".twitter-typeahead").css("display", "block");
      $(".tt-dropdown-menu").css("min-width", function() {
        return $("#autocompleteInput").width() + "px";
      });
    });

    $("#autocompleteInput").on("focus", function() {
      $(".navbar-collapse").css("height", window.innerHeight - 61 + "px");
      $(".navbar-collapse").css("max-height", window.innerHeight - 61 + "px");
    });

    $("#autocompleteInput").on("blue", function() {
      $(".navbar-collapse").css("height", "auto");
      $(".navbar-collapse").css("max-height", "340px");
    });
  });

  function rebindShowAll() {
    d3.select(".showAll").on("click", function() {
      d3.select("#contentHolder").transition().duration(1000).style("left", function() {
        return -window.innerWidth * 0.5 + "px";
      });
      for (var sport in sportLayers) {
        if (map.hasLayer(sportLayers[sport])) {
          map.removeLayer(sportLayers[sport]);
        }
      }
      map.addLayer(locationLayer);

      d3.select(".layerIndicator").style("display", "none");
    });
  }

  // Event listener for the content close button
  d3.select("#closeContent").on("click", function() {
    closeContent();
  });

  // Open the sidebar
  function openContent() {
    if (window.innerWidth > 600) {
      d3.select("#contentHolder").transition().duration(1000).style("left", function() {
        return -window.innerWidth * 0.5 + "px";
      });
    } else {
      d3.select("#contentHolder").transition().duration(1000).style("left", "0px");
    }
  }

  // Close the sidebar
  function closeContent() {
    if (window.innerWidth > 600) {
      d3.select("#contentHolder").transition().duration(1000).style("left", function() {
        return -window.innerWidth * 0.5 + "px";
      });
    } else {
      d3.select("#contentHolder").transition().duration(1000).style("left", function() {
        return -window.innerWidth + "px";
      });
    }
    d3.select(".info").style("display", "none");
  }

  function resize() {
    // Side the sidebar to window size
    if (window.innerWidth > 600) {
      d3.select("#contentHolder").style("width", function() {
        return window.innerWidth * 0.3 + "px";
      });
    } else {
      d3.select("#contentHolder").style("width", function() {
        return window.innerWidth + "px";
      });
    }

    d3.select("#map").style("height", (window.innerHeight - 61) + "px");
    // map.invalidateSize();
    d3.select("#contentHolder").style("height", (window.innerHeight - 60) + "px");
    closeContent();
  }

  d3.select(window).on("resize", function() {
    resize();
  });

  // Size everything for the first time
  resize();
  closeContent();
})();// Create Leaflet map
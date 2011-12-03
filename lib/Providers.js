/**
 * Copyright (c) 2008-2009 The Open Source Geospatial Foundation
 *
 * Published under the BSD license.
 * See http://svn.geoext.org/core/trunk/geoext/license.txt for the full text
 * of the license.
 */
/*
 * @include OpenLayers/Geometry/Point.js
 * @include OpenLayers/BaseTypes/Bounds.js
 */ 

Ext.namespace('GeoExt.ux');


GeoExt.ux.cloudmadeRoutingService = function (options, type, start, end, catchResult, scope) {
    var newUrl = start.y + ',' + start.x + ',' + end.y + ',' + end.x + "/" + type + ".js?lang=" + OpenLayers.Lang.getCode();
    var proxy = new Ext.data.ScriptTagProxy({
        url: "http://routes.cloudmade.com/" + options.cloudmadeKey + "/api/0.3/" + newUrl,
        nocache: false
    });
    var routingStore = new Ext.data.Store({
        proxy: proxy,
        reader: new Ext.data.JsonReader({
            root: 'version',
            fields: [
                {
                    name: 'total_length'
                }
            ]

        })
    });

    routingStore.on('load', function (store) {
        var version = store.reader.jsonData.version;
        var status = store.reader.jsonData.status;
        
        var statusMessage = null;
        var routeSummary = null;
        var routeGeometry = null;
        var routeInstructions = null;
        
        if (store.reader.jsonData.status_message) {
            statusMessage = store.reader.jsonData.status_message;
        }
        if (store.reader.jsonData.route_summary) {
            routeSummary = store.reader.jsonData.route_summary;
        }
        if (store.reader.jsonData.route_geometry) {
            routeGeometry = store.reader.jsonData.route_geometry;
        }
        if (store.reader.jsonData.route_instructions) {
            routeInstructions = store.reader.jsonData.route_instructions;
        }
        if (status == '0') {
            var instructions = '';
            var first = true;
            for (var i = 0 ; i < routeInstructions.length ; i++) {
                if (first) { 
                    first = false;
                }
                else { 
                    instructions += '<br />';
                }
                instructions += routeInstructions[i][0] + ' (' + routeInstructions[i][4] + ').';
            }
            
            var html = '<p>' + instructions + '</p><p>' + OpenLayers.i18n('Total length: ') + Math.round(routeSummary.total_distance / 1000) + ' km</p>';

            var pointList = [];
            for (var i = 0; i < routeGeometry.length; i++) {
                var newPoint = new OpenLayers.Geometry.Point(routeGeometry[i][1],
                        routeGeometry[i][0]);
                pointList.push(newPoint);
            }
            var geometry = new OpenLayers.Geometry.LineString(pointList);

            catchResult.call(scope, true, html, [new OpenLayers.Feature.Vector(geometry)]);
        } 
        else {
            catchResult.call(scope, false, statusMessage, null);
        }
    }, this);
    routingStore.load();
}

GeoExt.ux.RoutingProviders = {
//    http://nominatim.openstreetmap.org/search?format=json&json_callback=aaa&accept-language=fr&q=Paudex

    nominatimSearchCombo: function (options) {
        var url = 'http://nominatim.openstreetmap.org/search';

        var params = {
            format: 'json',
            'accept-language': OpenLayers.Lang.getCode()
        };
        if (options.maxRows) {
            params.limit = options.maxRows;
        }
        if (options.zoom > 0) {
            params.polygon = 1;
        }
        options = Ext.apply({
            emptyText: OpenLayers.i18n('Search location in OSM'),
            loadingText: OpenLayers.i18n('Search in OSM...'),
            projection: new OpenLayers.Projection("EPSG:4326"),
            minChars: 1,
            queryDelay: 50,
            hideTrigger: true,
            charset: 'UTF8',
            forceSelection: true,
            displayField: 'display_name',
            queryParam: 'q',
            tpl: '<tpl for="."><div class="x-combo-list-item"><h3>{display_name}</h3></div></tpl>',

            store: new Ext.data.Store({
                proxy: new Ext.data.ScriptTagProxy({
                    url: url,
                    extraParams: params,
                    callbackParam: 'json_callback'
                }),
                reader: new Ext.data.JsonReader({
                    fields: ['display_name', 'boundingbox', 'lon', 'lat', 'polygonpoints']
                })
            })
        }, options);
        var box =  new Ext.form.ComboBox(options);
        box.getCentroid = function(data) {
            var geometry = new OpenLayers.Geometry.Point(data.lon, data.lat);
            return geometry.transform(this.projection, this.map.getProjectionObject());
        };
        
        if (box.zoom > 0) {
            box.on("select", function (combo, record, index) {
                var bb = record.data.boundingbox;
                var box = new OpenLayers.Bounds(bb[2], bb[0], bb[3], bb[1]);
                box.transform(this.projection, this.map.getProjectionObject());
                this.map.zoomToExtent(box);
                this.map.zoomIn();
                this.map.zoomIn();
            }, box);
        }
        
        return box;
    },


    cloudmadeSearchCombo: function (options) {
        var maxRows = options.maxRows ? options.maxRows : 10; 
        var url = 'http://geocoding.cloudmade.com/' + options.cloudmadeKey + '/geocoding/v2/find.js?results=' + maxRows + '&return_geometry=false';
        
        options = Ext.apply({
            emptyText: OpenLayers.i18n('Search location in Cloudmade'),
            loadingText: OpenLayers.i18n('Search in Cloudmade...'),
            minChars: 1,
            queryDelay: 50,
            hideTrigger: true,
            charset: 'UTF8',
            forceSelection: true,
            displayField: 'name',
            queryParam: 'query',
            tpl: '<tpl for="."><div class="x-combo-list-item"><h3>{name}</h3>{is_in}</div></tpl>',
            store: new Ext.data.Store({
                proxy: new Ext.data.ScriptTagProxy({
                    url: url,
                    method: 'GET'
                }),
                reader: new Ext.data.JsonReader({
                    totalProperty: "found",
                    root: "features",
                    fields: [{
                        name: 'is_in',
                        mapping: 'properties.is_in'
                    },
                    {
                        name: 'name',
                        mapping: 'properties.name'
                    },
                    {
                        name: 'centroid'
                    }]
                })
            })
        }, options);
        var box =  new Ext.form.ComboBox(options);
        box.getCentroid = function(data) {
            var geometry = new OpenLayers.Geometry.Point(data.centroid.coordinates[1], data.centroid.coordinates[0]);
            return geometry.transform(this.geocodingProviders.projection, this.map.getProjectionObject());
        };
        
        if (box.zoom > 0) {
            box.on("select", function (combo, record, index) {
                var coordinates = record.data.centroid.coordinates;
                var position = new OpenLayers.LonLat(coordinates[1], coordinates[0]);
                position.transform(this.projection, this.map.getProjectionObject());
                this.map.setCenter(position, this.zoom);
            }, box);
        }
        
        return box;
    },

    getCloudmadeRoutingProvider: function(cloudmadeKey) {
        return {
            name: OpenLayers.i18n("Cloudmade"),
            service: GeoExt.ux.cloudmadeRoutingService,
            cloudmadeKey: cloudmadeKey,
            projection: new OpenLayers.Projection("EPSG:4326"),
            types: {
                car: { name: OpenLayers.i18n('By car') },
                foot: { name: OpenLayers.i18n('By foot') },
                bicycle: { name: OpenLayers.i18n('By bicycle') }
            }
        }
    },

    getYOURSRoutingProvider: function() {
        return {
            name: OpenLayers.i18n("Your navigation"),
            service : GeoExt.ux.RoutingProviders.yoursRoutingService,
            projection: new OpenLayers.Projection("EPSG:4326"),
            types: {
                motorcar : { name: OpenLayers.i18n('Motorcar') },
                bicycle : { name: OpenLayers.i18n('Bicycle') },
                foot : { name: OpenLayers.i18n('Foot') }
            }
        };
    },
    
    yoursRoutingService: function(options, type, start, end, catchResult, scope) {
        var http = new OpenLayers.Protocol.HTTP({
            url: "http://www.yournavigation.org/api/1.0/gosmore.php",
            params: {
                flon: start.x,
                flat: start.y,
                tlon: end.x,
                tlat: end.y,
                format: 'geojson',
                v: type
            },
            format: new OpenLayers.Format.JSON(),
            callback: function(response) {
                var distance = null;
                var instructions = '';

                var feature = new OpenLayers.Format.GeoJSON().read(response.features);

                if (response.features.properties.distance) {
                    distance = response.features.properties.distance;
                }
                if (response.features.properties.description) {
                    instructions = response.features.properties.description;
                }

                var html = '<p>' + OpenLayers.i18n('Total length: ') + distance + ' km</p>'
                        + instructions + '<hr />';

                catchResult.call(scope, true, html, feature);
            }
        });

        http.read();
    }
} 

/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports) {
    "use strict";

    var Immutable = require("immutable");

    var events = require("js/events"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor");

    /**
     * Map from element IDs to corresponding element and type
     *
     * @private
     * @type {object}
    */
    var _idMap = {};

    /**
     * Make list of certain library info so search store can create search options
     *
     * @private
     * @return {Immutable.List.<object>}
    */
    var _getLibrarySearchOptions = function () {
        var libStore = this.flux.store("library"),
            libraries = libStore.getLibraries();

        // Map from vnd.adobe.element type to library strings.SEARCH.CATEGORIES keys
        var VALID_ASSET_TYPES = {
            "image": "GRAPHIC",
            "characterstyle": "CHARACTERSTYLE",
            "layerstyle": "LAYERSTYLE"
        };

        _idMap = {};

        return libraries.reduce(function (allMaps, library) {
            var libMap = Immutable.List();
            library.elements.forEach(function (element) {
                var id = element.id.replace(/-/g, "."),
                    title = element.displayName,
                    type = element.type,
                    category = type.substring("application/vnd.adobe.element.".length, type.indexOf("+"));

                var categoryKey = VALID_ASSET_TYPES[category];
                
                if (categoryKey) {
                    if (categoryKey === "CHARACTERSTYLE") {
                        var charStyle = element.getPrimaryRepresentation().getValue("characterstyle", "data"),
                            font = charStyle.adbeFont,
                            fontString = font.name + " " + font.style,

                            fontSize = charStyle.fontSize,
                            fontSizeString = fontSize.value + fontSize.type,

                            fontColor = charStyle.color && charStyle.color[0],
                            fontColorString = fontColor ?
                                ", " + tinycolor(fontColor.value).toHexString().toUpperCase() : "";

                        title = fontString + ", " + fontSizeString + fontColorString;
                    }

                    _idMap[id] = { asset: element, type: categoryKey };

                    libMap = libMap.push({
                        id: id,
                        name: title,
                        pathInfo: library.name + ": " + strings.SEARCH.CATEGORIES[categoryKey],
                        iconID: _getSVGClass([categoryKey]),
                        category: ["LIBRARY", library.name, categoryKey]
                    });
                }
            });
            return allMaps.concat(libMap);
        }, Immutable.List());
    };

    /*
     * Find SVG class for library item based on what type of asset it is
     *
     * @private
     * @param {Array.<string>} categories 
     * @return {string}
    */
    var _getSVGClass = function (categories) {
        var type = categories[categories.length - 1],
            // map from item categories to svg icon class name
            CATEGORY_MAP_ICON = {
                "GRAPHIC": "libraries-addGraphic",
                "CHARACTERSTYLE": "libraries-addCharStyle",
                "LAYERSTYLE": "libraries-addLayerStyle"
            };

        return CATEGORY_MAP_ICON[type] || "libraries-cc";
    };

    /**
     * Apply library element when its item is confirmed in search
     *
     * @private
     * @param {string} id ID of layer to select
    */
    var _confirmSearch = function (id) {
        var libActions = this.flux.actions.libraries,
            elementInfo = _idMap[id];

        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument(),
            currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.first();

        if (elementInfo) {
            var asset = elementInfo.asset;
            libActions.selectLibrary(asset.library.id);

            switch (elementInfo.type) {
                case "GRAPHIC":
                    var uiStore = this.flux.stores.ui,
                        centerOffsets = uiStore.getState().centerOffsets,
                        midX = (window.document.body.clientWidth + centerOffsets.left - centerOffsets.right) / 2,
                        midY = (window.document.body.clientHeight + centerOffsets.top - centerOffsets.bottom) / 2,
                        location = uiStore.transformWindowToCanvas(midX, midY);
                    
                    libActions.createLayerFromElement(asset, location);
                    break;
                case "LAYERSTYLE":
                    // Only try to apply layer style if a single layer is selected
                    // Should probably be handled in applyLayerStyle 
                    if (currentLayers.size === 1) {
                        libActions.applyLayerStyle(asset);
                    }
                    break;
                case "CHARACTERSTYLE":
                    // Only try to apply character style if a single text layer is selected
                    // Should probably be handled in applyCharacterStyle 
                    if (currentLayers.size === 1 && currentLayer.isTextLayer()) {
                        libActions.applyCharacterStyle(asset);
                    }
                    break;
            }
        }
    };

    /**
     * Register library info to search
     *
     * @param {Array.<AdobeLibraryComposite>} libraries
     */
    var registerLibrarySearch = function (libraries) {
        var libraryNames = libraries.length > 0 ? collection.pluck(libraries, "name") : Immutable.List(),
            assetTypes = ["LIBRARY", "GRAPHIC", "LAYERSTYLE", "CHARACTERSTYLE"];
        
        var filters = libraryNames.concat(assetTypes);

        var payload = {
            "type": "LIBRARY",
            "getOptions": _getLibrarySearchOptions.bind(this),
            "filters": filters,
            "handleExecute": _confirmSearch.bind(this),
            "shortenPaths": false,
            "getSVGClass": _getSVGClass
        };
        
        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, payload);
    };
    
    exports.registerLibrarySearch = registerLibrarySearch;
});
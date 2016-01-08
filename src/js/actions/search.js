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

    var Promise = require("bluebird"),
        descriptor = require("adapter").ps.descriptor,
        adapterUI = require("adapter").ps.ui;

    var dialog = require("./dialog"),
        search = require("../stores/search"),
        locks = require("../locks");

    /**
     * The search bar dialog ID
     * 
     * @const
     * @type {string} 
     */
    var ID = search.SEARCH_BAR_DIALOG_ID;

    var _showSearchHandler = null;

    /**
     * Open the Search dialog
     *
     * @return {Promise}
     */
    var toggleSearchBar = function () {
        var dialogState = this.flux.stores.dialog.getState(),
            open = dialogState.openDialogs.contains(ID);

        if (open) {
            return this.transfer(dialog.closeDialog, ID);
        }

        return this.transfer(dialog.openDialog, ID);
    };
    toggleSearchBar.action = {
        reads: [locks.JS_DIALOG],
        writes: [],
        transfers: [dialog.openDialog, dialog.closeDialog]
    };

    var onReset = function () {
        descriptor.removeListener("showSuperSearch", _showSearchHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    var beforeStartup = function () {
        var searchStore = this.flux.store("search");

        searchStore.registerSearch(ID,
            ["CURRENT_DOC", "RECENT_DOC", "ALL_LAYER", "MENU_COMMAND", "LIBRARY", "GLOBAL_SHORTCUT"]);

        if (this.isHeadless) {
            _showSearchHandler = function () {
                var photoshop_bounds = {
                    left: 100,
                    right: 1000,
                    top: 100,
                    bottom: 500
                  };

                _spaces.window.changeBounds({globalBounds: photoshop_bounds}, {}, function (err) {
                    if (err) {
                        console.log(err);
                    }

                    var photoshopPropagateMode = adapterUI.keyboardPropagationMode.PROPAGATE_TO_BROWSER,
                    psKeyboardModePromise = adapterUI.setKeyboardPropagationMode({ defaultMode: photoshopPropagateMode });

                    psKeyboardModePromise.bind(this).then(function () {
                        this.flux.actions.search.toggleSearchBar();
                    });
                }.bind(this));


            }.bind(this);

            descriptor.addListener("showSuperSearch", _showSearchHandler);
        }
        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: [locks.JS_SEARCH],
        transfers: []
    };

    exports.toggleSearchBar = toggleSearchBar;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});

/**
 * @fileoverview TreeRow data model implementation
 * @author NHN Ent. FE Development Team
 */

'use strict';

var Row = require('./row');
var treeState = require('../../common/constMap').treeState;

var PRIVATE_PROPERTIES = [
    '_button',
    '_number',
    '_extraData',
    '_treeData',
    '_children'
];

/**
 * TreeRow class implementation
 * @module model/data/columnModel
 * @extends module:base/model
 * @ignore
 */
var TreeRow = Row.extend(/** @lends module:model/data/treeRow.prototype */{
    /**
     * Returns the Array of private property names
     * @returns {array} An array of private property names
     */
    getPrivateProperties: function() {
        return PRIVATE_PROPERTIES;
    },

    /**
     * set tree state
     * @param {boolean} state - true if expanded
     */
    setTreeExpanded: function(state) {
        var prevState = this.getTreeExpanded();

        this.extraDataManager.setTreeState(state ? treeState.EXPAND : treeState.COLLAPSE);

        if (state !== prevState) {
            this._triggerExtraDataChangeEvent();
        }
    },

    /**
     * get tree state
     * @returns {boolean} - true if expanded
     */
    getTreeExpanded: function() {
        return this.extraDataManager.getTreeState() === treeState.EXPAND;
    },

    /**
     * get tree data
     * @returns {Object} - tree data
     * @private
     */
    _getTreeData: function() {
        return this.get('_treeData');
    },

    /**
     * get tree depth of this row
     * @returns {Number} - depth of this row
     */
    getTreeDepth: function() {
        return this.hasTreeNextSibling().length;
    },

    /**
     * check whether this row has one or more children
     * @returns {Boolean} - true if it has children
     */
    hasTreeChildren: function() {
        var childrenRowKeys = this.getTreeChildrenRowKeys();

        return childrenRowKeys.length > 0;
    },

    /**
     * gets children row keys
     * @returns {(Number|String)[]} - array of children row keys
     */
    getTreeChildrenRowKeys: function() {
        return this._getTreeData().childrenRowKeys || [];
    },

    /**
     * check whether this row has one or more next sibling
     * @returns {Boolean} - true if this row has siblings
     */
    hasTreeNextSibling: function() {
        return this._getTreeData().hasNextSibling;
    },

    /**
     * gets parent row key
     * @returns {(Number|String)} - parent row key
     */
    getTreeParentRowKey: function() {
        return this._getTreeData().parentRowKey;
    }
}, {
    privateProperties: PRIVATE_PROPERTIES,
    treeState: treeState
});

module.exports = TreeRow;

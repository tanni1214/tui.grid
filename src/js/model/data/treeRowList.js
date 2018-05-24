/**
 * @fileoverview TreeRowList grid data model implementation
 * @author NHN Ent. FE Development Team
 */

'use strict';

var _ = require('underscore');
var util = require('tui-code-snippet');

var RowList = require('./rowList');
var TreeRow = require('./treeRow');

/**
 * TreeRowList class implementation
 * @module model/data/treeModel
 * @extends module:base/collection
 * @ignore
 */
var TreeRowList = RowList.extend(/** @lends module:model/data/treeRowList.prototype */{
    initialize: function() {
        RowList.prototype.initialize.apply(this, arguments);

        /**
         * root row which actually does not exist.
         * it keeps depth 1 rows as it's children
         * @type {Object}
         */
        this._rootRow = createEmptyTreeRowData();
    },

    model: TreeRow,

    /**
     * flattened tree row to grid row
     * process _extraData then set rowSpanData value
     * this function overrides RowList._formatData to deal with rowKey here
     *
     * @param {(Array|Object)} data - rowList
     * @param {Object} options - append options
     * @returns {Array} rowList with row
     * @override
     * @private
     */
    _formatData: function(data, options) {
        var rootRow = createEmptyTreeRowData();
        var flattenedRow = [];
        var rowList, parentRow, parentRowKey;

        rowList = _.filter(data, _.isObject);
        rowList = util.isArray(rowList) ? rowList : [rowList];

        if (options) {
            // probably an append operation
            // which requires specific parent row
            parentRowKey = options.parentRowKey;
            if (_.isNumber(parentRowKey) || _.isString(parentRowKey)) {
                parentRow = this.get(options.parentRowKey);
                rootRow._treeData.childrenRowKeys
                    = parentRow.getTreeChildrenRowKeys();
                rootRow._treeData.hasNextSibling
                    = parentRow.hasTreeNextSibling().slice(0);
                rootRow.rowKey = options.parentRowKey;
            } else {
                // no parent row key means root row
                rootRow = this._rootRow;
            }
        } else {
            // from setOriginal or setData
            // which requires to reset root row
            this._rootRow = rootRow;
        }

        this._flattenRow(rowList, flattenedRow, [rootRow]);

        _.each(flattenedRow, function(row, i) {
            if (this.isRowSpanEnable()) {
                this._setExtraRowSpanData(flattenedRow, i);
            }
        }, this);

        return flattenedRow;
    },

    /**
     * Flatten nested tree data to 1-depth grid data.
     * @param {Array} treeRows - nested rows having children
     * @param {Array} flattenedRows - flattend rows. you should give an empty array at the initial call of this function
     * @param {Array} ancestors - ancester rows
     */
    _flattenRow: function(treeRows, flattenedRows, ancestors) {
        var parent;
        var lastSibling = treeRows[treeRows.length - 1];

        parent = ancestors[ancestors.length - 1];
        parent._treeData.childrenRowKeys = parent._treeData.childrenRowKeys || [];

        _.each(treeRows, function(row) {
            // sets rowKey property
            row = this._baseFormat(row);
            row._treeData = {
                parentRowKey: parent.rowKey,
                hasNextSibling: parent._treeData.hasNextSibling.concat([lastSibling !== row])
            };
            parent._treeData.childrenRowKeys.push(row.rowKey);

            flattenedRows.push(row);

            if (util.isArray(row._children)) {
                this._flattenRow(row._children, flattenedRows, ancestors.concat([row]));
                delete row._children;
            }
        }, this);
    },

    /**
     * calculate index of given parent row key and offset
     * @param {(Number|String)} parentRowKey - parent row key
     * @param {Number} offset - offset
     * @returns {Number} - calculated index
     * @private
     */
    _indexOfParentRowKeyAndOffset: function(parentRowKey, offset) {
        var at, parentRow, childrenRowKeys;

        parentRow = this.get(parentRowKey);
        if (parentRow) {
            childrenRowKeys = parentRow.getTreeChildrenRowKeys();
            at = this.indexOf(parentRow);
        } else {
            childrenRowKeys = this._rootRow._treeData.childrenRowKeys;
            at = -1; // root row actually doesn't exist
        }

        offset = Math.max(0, offset);
        offset = Math.min(offset, childrenRowKeys.length);
        if (childrenRowKeys.length === 0 || offset === 0) {
            // first sibling
            // then the `at` is right after the parent row
            at = at + 1;
        } else if (childrenRowKeys.length > offset) {
            // not the last sibling
            // right before the next sibling
            at = this.indexOf(this.get(childrenRowKeys[offset]));
        } else {
            // last sibling
            at = this.indexOf(this.get(childrenRowKeys[childrenRowKeys.length - 1]));
            // and after all it's descendant rows and itself
            at += this.getTreeDescendentRowKeys(at).length + 1;
        }

        return at;
    },

    /**
     * update hasNextSibling value of previous sibling and of itself
     * @param {(Number|String)} rowKey - row key
     * @private
     */
    _syncHasTreeNextSiblingData: function(rowKey) {
        var currentRow = this.get(rowKey);
        var currentDepth, prevSiblingRow, nextSiblingRow;

        if (!currentRow) {
            return;
        }

        currentDepth = currentRow.getTreeDepth();
        prevSiblingRow = this.get(this.getTreePrevSiblingRowKey(rowKey));
        nextSiblingRow = this.get(this.getTreeNextSiblingRowKey(rowKey));

        currentRow.hasTreeNextSibling()[currentDepth - 1] = !!nextSiblingRow;

        if (prevSiblingRow) {
            prevSiblingRow.hasTreeNextSibling()[currentDepth - 1] = true;
        }
    },

    /**
     * Insert the new row with specified data to the end of table.
     * @param {(Array|Object)} [rowData] - The data for the new row
     * @param {Object} [options] - Options
     * @param {(Number|String)} [options.parentRowKey] - row key of the parent which appends given rows
     * @param {Number} [options.offset] - offset from first sibling
     * @param {Boolean} [options.focus] - If set to true, move focus to the new row after appending
     * @returns {Array.<module:model/data/treeTow>} Row model list
     * @override
     */
    append: function(rowData, options) {
        var modelList;

        options = _.extend({
            at: this._indexOfParentRowKeyAndOffset(options.parentRowKey, options.offset)
        }, options);

        modelList = this._append(rowData, options);

        this._syncHasTreeNextSiblingData(modelList[0].get('rowKey'));
        if (modelList.length > 1) {
            this._syncHasTreeNextSiblingData(modelList[modelList.length - 1].get('rowKey'));
        }

        this.trigger('add', modelList, options);

        return modelList;
    },

    /**
     * Insert the given data into the very first row of root
     * @param {(Array|Object)} [rowData] - The data for the new row
     * @param {Object} [options] - Options
     * @param {Boolean} [options.focus] - If set to true, move focus to the new row after appending
     * @returns {Array.<module:model/data/treeTow>} Row model list
     */
    prepend: function(rowData, options) {
        options = options || {};
        options.parentRowKey = null;
        options.offset = 0;

        return this.append(rowData, options);
    },

    _removeChildFromParent: function(childRowKey) {
        var parentRowKey = this.get(childRowKey).getTreeParentRowKey();
        var parentRow = this.get(parentRowKey);
        var rootTreeData = this._rootRow._treeData;

        if (parentRow) {
            parentRow.removeTreeChildrenRowKey(childRowKey);
        } else {
            rootTreeData.childrenRowKeys = _.filter(rootTreeData.childrenRowKeys, function(rootChildRowKey) {
                return rootChildRowKey !== childRowKey;
            }, this);
        }
    },

    _removeRow: function(rowKey, options) {
        this._removeChildFromParent(rowKey);
        RowList.prototype._removeRow.call(this, rowKey, options);
    },

    /**
     * remove row of given row key. it will also remove it's descendant
     * @param {(Number|String)} rowKey - 행 데이터의 고유 키
     * @param {object} options - 삭제 옵션
     * @param {boolean} options.removeOriginalData - 원본 데이터도 함께 삭제할 지 여부
     * @param {boolean} options.keepRowSpanData - rowSpan이 mainRow를 삭제하는 경우 데이터를 유지할지 여부
     * @override
     */
    removeRow: function(rowKey, options) {
        var row = this.get(rowKey);
        var currentIndex = this.indexOf(row);
        var prevSiblingRowKey = this.getTreePrevSiblingRowKey(rowKey);
        var descendantRowKeys;

        if (!row) {
            return;
        }

        // remove descendant rows including itself
        descendantRowKeys = this.getTreeDescendentRowKeys(rowKey);
        descendantRowKeys.reverse().push(rowKey);
        _.each(descendantRowKeys, function(descendantRowKey) {
            this._removeRow(descendantRowKey, options);
        }, this);

        if (_.isNumber(prevSiblingRowKey) || _.isString(prevSiblingRowKey)) {
            this._syncHasTreeNextSiblingData(prevSiblingRowKey);
        }

        if (options && options.removeOriginalData) {
            this.setOriginalRowList();
        }
        this.trigger('remove', rowKey, currentIndex);
    },

    /**
     * get row keys of sibling and of itself
     * @param {(Number|String)} rowKey - row key
     * @returns {Array.<(Number|String)>} - sibling row keys
     */
    getTreeSiblingRowKeys: function(rowKey) {
        var parentRow = this.get(this.get(rowKey).getTreeParentRowKey());
        var childrenRowKeys;

        if (parentRow) {
            childrenRowKeys = parentRow.getTreeChildrenRowKeys();
        } else {
            childrenRowKeys = this._rootRow._treeData.childrenRowKeys.slice(0);
        }

        return childrenRowKeys;
    },
    /**
     * get row key of previous sibling
     * @param {(Number|String)} rowKey - row key
     * @returns {(Number|String)} - previous sibling row key
     */
    getTreePrevSiblingRowKey: function(rowKey) {
        var siblingRowKeys = this.getTreeSiblingRowKeys(rowKey);
        var currentIndex = siblingRowKeys.indexOf(rowKey);

        return currentIndex > 0 ? siblingRowKeys[currentIndex - 1] : null;
    },

    /**
     * get row key of next sibling
     * @param {(Number|String)} rowKey - row key
     * @returns {(Number|String)} - next sibling row key
     */
    getTreeNextSiblingRowKey: function(rowKey) {
        var siblingRowKeys = this.getTreeSiblingRowKeys(rowKey);
        var currentIndex = siblingRowKeys.indexOf(rowKey);

        return (currentIndex + 1 >= siblingRowKeys.length)
            ? null : siblingRowKeys[currentIndex + 1];
    },

    /**
     * get top most row keys
     * @returns {(Number|String)[]} - row keys
     */
    getTopMostRowKeys: function() {
        return this._rootRow._treeData.childrenRowKeys;
    },

    /**
     * get tree children of row of given rowKey
     * @param {(Number|String)} rowKey - row key
     * @returns {(Number|String)[]} - children of found row
     */
    getTreeChildrenRowKeys: function(rowKey) {
        var row = this.get(rowKey);

        return row.getTreeChildrenRowKeys();
    },

    /**
     * get tree descendent of row of given rowKey
     * @param {(Number|String)} rowKey - row key
     * @returns {(Number|String)[]} - descendent of found row
     */
    getTreeDescendentRowKeys: function(rowKey) {
        var index = 0;
        var rowKeys = [rowKey];

        while (index < rowKeys.length) {
            rowKeys = rowKeys.concat(this.getTreeChildrenRowKeys(rowKeys[index]));
            index += 1;
        }
        rowKeys.shift();

        return rowKeys;
    },

    /**
     * expand tree row
     * @param {(Number|String)} rowKey - row key
     * @param {Boolean} recursive - true for recursively expand all descendent
     * @param {Boolean} silent - true to mute event
     * @returns {(Number|String)[]} - children or descendent of given row
     */
    treeExpand: function(rowKey, recursive, silent) {
        var descendentRowKeys;
        var row = this.get(rowKey);
        row.setTreeExpanded(true);

        if (recursive) {
            descendentRowKeys = this.getTreeDescendentRowKeys(rowKey);
            util.forEachArray(descendentRowKeys, function(descendentRowKey) {
                var descendentRow = this.get(descendentRowKey);
                if (descendentRow.hasTreeChildren()) {
                    descendentRow.setTreeExpanded(true);
                }
            }, this);
        } else {
            descendentRowKeys = this.getTreeChildrenRowKeys(rowKey);
        }

        if (!silent) {
            this.trigger('expanded', descendentRowKeys.slice(0));
        }

        return descendentRowKeys;
    },

    /**
     * expand all rows
     */
    treeExpandAll: function() {
        var topMostRowKeys = this.getTopMostRowKeys();

        _.each(topMostRowKeys, function(topMostRowKey) {
            this.treeExpand(topMostRowKey, true, true);
        }, this);

        this.trigger('expanded');
    },

    /**
     * collapse tree row
     * @param {(Number|String)} rowKey - row key
     * @param {Boolean} recursive - true for recursively expand all descendent
     * @param {Boolean} silent - true to mute event
     * @returns {(Number|String)[]} - children or descendent of given row
     */
    treeCollapse: function(rowKey, recursive, silent) {
        var descendentRowKeys;
        var row = this.get(rowKey);
        row.setTreeExpanded(false);

        if (recursive) {
            descendentRowKeys = this.getTreeDescendentRowKeys(rowKey);
            _.each(descendentRowKeys, function(descendentRowKey) {
                var descendentRow = this.get(descendentRowKey);
                if (descendentRow.hasTreeChildren()) {
                    descendentRow.setTreeExpanded(false);
                }
            }, this);
        } else {
            descendentRowKeys = this.getTreeChildrenRowKeys(rowKey);
        }

        if (!silent) {
            this.trigger('collapsed', descendentRowKeys.slice(0));
        }

        return descendentRowKeys;
    },

    /**
     * collapse all rows
     */
    treeCollapseAll: function() {
        var topMostRowKeys = this.getTopMostRowKeys();

        _.each(topMostRowKeys, function(topMostRowKey) {
            this.treeCollapse(topMostRowKey, true, true);
        }, this);

        this.trigger('collapsed');
    }
});

function createEmptyTreeRowData() {
    return {
        _treeData: {
            hasNextSibling: []
        }
    };
}

module.exports = TreeRowList;

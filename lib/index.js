'use strict';

// Load modules

var Hoek = require('hoek');

// Declare internals

var internals = {};

exports = module.exports = internals.Topo = function () {

    this._items = [];
    this.nodes = [];
};

internals.Topo.prototype.add = function (nodes, options) {
    var _this = this;

    options = options || {};

    // Validate rules

    var before = [].concat(options.before || []);
    var after = [].concat(options.after || []);
    var group = options.group || '?';
    var sort = options.sort || 0; // Used for merging only

    Hoek.assert(before.indexOf(group) === -1, 'Item cannot come before itself:', group);
    Hoek.assert(before.indexOf('?') === -1, 'Item cannot come before unassociated items');
    Hoek.assert(after.indexOf(group) === -1, 'Item cannot come after itself:', group);
    Hoek.assert(after.indexOf('?') === -1, 'Item cannot come after unassociated items');

    [].concat(nodes).forEach(function (node, i) {

        var item = {
            seq: _this._items.length,
            sort: sort,
            before: before,
            after: after,
            group: group,
            node: node
        };

        _this._items.push(item);
    });

    // Insert event

    var error = this._sort();
    Hoek.assert(!error, 'item', group !== '?' ? 'added into group ' + group : '', 'created a dependencies error');

    return this.nodes;
};

internals.Topo.prototype.merge = function (others) {

    others = [].concat(others);
    for (var i = 0; i < others.length; ++i) {
        var other = others[i];
        if (other) {
            for (var j = 0; j < other._items.length; ++j) {
                var item = Hoek.shallow(other._items[j]);
                this._items.push(item);
            }
        }
    }

    // Sort items

    this._items.sort(internals.mergeSort);
    for (var _i = 0; _i < this._items.length; ++_i) {
        this._items[_i].seq = _i;
    }

    var error = this._sort();
    Hoek.assert(!error, 'merge created a dependencies error');

    return this.nodes;
};

internals.mergeSort = function (a, b) {

    return a.sort === b.sort ? 0 : a.sort < b.sort ? -1 : 1;
};

internals.Topo.prototype._sort = function () {

    // Construct graph

    var graph = {};
    var graphAfters = Object.create(null); // A prototype can bungle lookups w/ false positives
    var groups = Object.create(null);

    for (var i = 0; i < this._items.length; ++i) {
        var item = this._items[i];
        var seq = item.seq; // Unique across all items
        var group = item.group;

        // Determine Groups

        groups[group] = groups[group] || [];
        groups[group].push(seq);

        // Build intermediary graph using 'before'

        graph[seq] = item.before;

        // Build second intermediary graph with 'after'

        var after = item.after;
        for (var j = 0; j < after.length; ++j) {
            graphAfters[after[j]] = (graphAfters[after[j]] || []).concat(seq);
        }
    }

    // Expand intermediary graph

    var graphNodes = Object.keys(graph);
    for (var _i2 = 0; _i2 < graphNodes.length; ++_i2) {
        var node = graphNodes[_i2];
        var expandedGroups = [];

        var graphNodeItems = Object.keys(graph[node]);
        for (var _j = 0; _j < graphNodeItems.length; ++_j) {
            var _group = graph[node][graphNodeItems[_j]];
            groups[_group] = groups[_group] || [];

            for (var k = 0; k < groups[_group].length; ++k) {
                expandedGroups.push(groups[_group][k]);
            }
        }
        graph[node] = expandedGroups;
    }

    // Merge intermediary graph using graphAfters into final graph

    var afterNodes = Object.keys(graphAfters);
    for (var _i3 = 0; _i3 < afterNodes.length; ++_i3) {
        var _group2 = afterNodes[_i3];

        if (groups[_group2]) {
            for (var _j2 = 0; _j2 < groups[_group2].length; ++_j2) {
                var _node = groups[_group2][_j2];
                graph[_node] = graph[_node].concat(graphAfters[_group2]);
            }
        }
    }

    // Compile ancestors

    var children = void 0;
    var ancestors = {};
    graphNodes = Object.keys(graph);
    for (var _i4 = 0; _i4 < graphNodes.length; ++_i4) {
        var _node2 = graphNodes[_i4];
        children = graph[_node2];

        for (var _j3 = 0; _j3 < children.length; ++_j3) {
            ancestors[children[_j3]] = (ancestors[children[_j3]] || []).concat(_node2);
        }
    }

    // Topo sort

    var visited = {};
    var sorted = [];

    for (var _i5 = 0; _i5 < this._items.length; ++_i5) {
        // Really looping thru item.seq values out of order
        var next = _i5;

        if (ancestors[_i5]) {
            next = null;
            for (var _j4 = 0; _j4 < this._items.length; ++_j4) {
                // As above, these are item.seq values
                if (visited[_j4] === true) {
                    continue;
                }

                if (!ancestors[_j4]) {
                    ancestors[_j4] = [];
                }

                var shouldSeeCount = ancestors[_j4].length;
                var seenCount = 0;
                for (var _k = 0; _k < shouldSeeCount; ++_k) {
                    if (visited[ancestors[_j4][_k]]) {
                        ++seenCount;
                    }
                }

                if (seenCount === shouldSeeCount) {
                    next = _j4;
                    break;
                }
            }
        }

        if (next !== null) {
            visited[next] = true;
            sorted.push(next);
        }
    }

    if (sorted.length !== this._items.length) {
        return new Error('Invalid dependencies');
    }

    var seqIndex = {};
    for (var _i6 = 0; _i6 < this._items.length; ++_i6) {
        var _item = this._items[_i6];
        seqIndex[_item.seq] = _item;
    }

    var sortedNodes = [];
    this._items = sorted.map(function (value) {

        var sortedItem = seqIndex[value];
        sortedNodes.push(sortedItem.node);
        return sortedItem;
    });

    this.nodes = sortedNodes;
};

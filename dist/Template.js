"use strict";
var escape_string_1 = require("escape-string");
var Parser_1 = require("./Parser");
var selfClosingTags_1 = require("./selfClosingTags");
var renderAttributes_1 = require("./renderAttributes");
var elDelimiter = '__';
var Template = (function () {
    function Template(beml, opts) {
        var block = new Parser_1.default(beml).parse();
        var blockName = opts && opts.blockName || block.name;
        if (!blockName) {
            throw new TypeError('blockName is required');
        }
        var parent = this.parent = opts && opts.parent || null;
        this._elementClassesTemplate = parent ?
            [blockName + elDelimiter].concat(parent._elementClassesTemplate) :
            [blockName + elDelimiter, ''];
        var rootNode = { elementName: null, source: null, innerSource: [], hasSuperCall: false };
        this._currentNode = rootNode;
        this._nodes = [rootNode];
        var nodeMap = this._nodeMap = { '#root': rootNode };
        for (var _i = 0, _a = block.content; _i < _a.length; _i++) {
            var node = _a[_i];
            this._handleNode(node, '#root');
        }
        this._renderer = parent ?
            parent._renderer :
            Function("return " + this._currentNode.innerSource.join(' + ') + ";");
        Object.keys(nodeMap).forEach(function (name) {
            var node = nodeMap[name];
            if (node.source) {
                this[name] = Function("return " + node.source.join(' + ') + ";");
                if (node.hasSuperCall) {
                    var inner_1 = Function('$super', "return " + node.innerSource.join(' + ') + ";");
                    var parentElementRendererMap_1 = parent && parent._elementRendererMap;
                    this[name + '@content'] = function () { return inner_1.call(this, parentElementRendererMap_1); };
                }
                else {
                    this[name + '@content'] = Function("return " + node.innerSource.join(' + ') + ";");
                }
            }
        }, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap)));
    }
    Template.prototype._handleNode = function (node, parentNodeName) {
        switch (node.nodeType) {
            case Parser_1.NodeType.ELEMENT: {
                var nodes = this._nodes;
                var el = node;
                var tagName = el.tagName;
                var elName = el.name;
                var content = el.content;
                if (elName) {
                    var currentNode = {
                        elementName: elName,
                        source: [
                            "'<" + tagName + renderAttributes_1.default(this._elementClassesTemplate, el) + ">'",
                            content && content.length ?
                                "this['" + elName + "@content']() + '</" + tagName + ">'" :
                                (tagName in selfClosingTags_1.default ? "''" : "'</" + tagName + ">'")
                        ],
                        innerSource: [],
                        hasSuperCall: false
                    };
                    nodes.push((this._currentNode = currentNode));
                    this._nodeMap[elName] = currentNode;
                }
                else {
                    this._currentNode.innerSource.push("'<" + tagName + renderAttributes_1.default(this._elementClassesTemplate, el) + ">'");
                }
                if (content) {
                    for (var _i = 0, content_1 = content; _i < content_1.length; _i++) {
                        var contentNode = content_1[_i];
                        this._handleNode(contentNode, elName || parentNodeName);
                    }
                }
                if (elName) {
                    nodes.pop();
                    this._currentNode = nodes[nodes.length - 1];
                    this._currentNode.innerSource.push("this['" + elName + "']()");
                }
                else if (content || !(tagName in selfClosingTags_1.default)) {
                    this._currentNode.innerSource.push("'</" + tagName + ">'");
                }
                break;
            }
            case Parser_1.NodeType.TEXT: {
                this._currentNode.innerSource.push("'" + escape_string_1.default(node.value) + "'");
                break;
            }
            case Parser_1.NodeType.SUPER_CALL: {
                this._currentNode.innerSource.push("$super['" + (node.elementName || parentNodeName) + "@content'].call(this)");
                this._currentNode.hasSuperCall = true;
                break;
            }
        }
    };
    Template.prototype.extend = function (beml, opts) {
        return new Template(beml, { __proto__: opts || null, parent: this });
    };
    Template.prototype.render = function () {
        return this._renderer.call(this._elementRendererMap);
    };
    return Template;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Template;

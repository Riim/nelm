"use strict";
var escape_string_1 = require("escape-string");
var Parser_1 = require("./Parser");
var selfClosingTags_1 = require("./selfClosingTags");
var renderAttributes_1 = require("./renderAttributes");
var elDelimiter = '__';
var Template = (function () {
    function Template(beml, parent) {
        if (parent === void 0) { parent = null; }
        var block = new Parser_1.default(beml).parse();
        var blockName = block.name;
        this.parent = parent;
        this._blockName = blockName;
        this._blockElementClassTemplate = parent ?
            [blockName + elDelimiter].concat(parent._blockElementClassTemplate) :
            [blockName + elDelimiter, ''];
        this._nodes = [(this._currentNode = { elementName: null, source: [], hasSuperCall: false })];
        var nodeMap = this._nodeMap = {};
        block.content.forEach(this._handleNode, this);
        this._renderer = parent ?
            parent._renderer :
            Function("return [" + this._currentNode.source.join(', ') + "].join('');");
        Object.keys(nodeMap).forEach(function (name) {
            var node = nodeMap[name];
            if (node.hasSuperCall) {
                var inner_1 = Function('$super', "return " + node.source.join(' + ') + ";");
                var parentElementRenderer_1 = parent && parent._elementRendererMap[name];
                this[name] = function () { return inner_1.call(this, parentElementRenderer_1); };
            }
            else {
                this[name] = Function("return " + node.source.join(' + ') + ";");
            }
        }, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap)));
    }
    Template.compile = function (beml) {
        return new Template(beml);
    };
    Template.prototype._handleNode = function (node) {
        switch (node.nodeType) {
            case Parser_1.NodeType.ELEMENT: {
                var nodes = this._nodes;
                var el = node;
                var tagName = el.tagName;
                var elName = el.name;
                var content = el.content;
                if (elName) {
                    var currentNode = { elementName: elName, source: [], hasSuperCall: false };
                    nodes.push((this._currentNode = currentNode));
                    this._nodeMap[elName] = currentNode;
                }
                this._currentNode.source.push("'<" + tagName + renderAttributes_1.default(this._blockElementClassTemplate, el) + ">'");
                var hasContent = content && content.length;
                if (hasContent) {
                    content.forEach(this._handleNode, this);
                }
                if (hasContent || !(tagName in selfClosingTags_1.default)) {
                    this._currentNode.source.push("'</" + tagName + ">'");
                }
                if (elName) {
                    nodes.pop();
                    this._currentNode = nodes[nodes.length - 1];
                    this._currentNode.source.push("this['" + elName + "']()");
                }
                break;
            }
            case Parser_1.NodeType.TEXT: {
                this._currentNode.source.push("'" + escape_string_1.default(node.value) + "'");
                break;
            }
            case Parser_1.NodeType.SUPER_CALL: {
                this._currentNode.source.push("$super.call(this)");
                this._currentNode.hasSuperCall = true;
                break;
            }
        }
    };
    Template.prototype.extend = function (beml) {
        return new Template(beml, this);
    };
    Template.prototype.render = function () {
        return this._renderer.call(this._elementRendererMap);
    };
    return Template;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Template;

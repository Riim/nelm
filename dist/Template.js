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
        this._nodes = [(this._currentNode = { elementName: null, source: null, innerSource: [], hasSuperCall: false })];
        var nodeMap = this._nodeMap = {};
        block.content.forEach(this._handleNode, this);
        this._renderer = parent ?
            parent._renderer :
            Function("return " + this._currentNode.innerSource.join(' + ') + ";");
        Object.keys(nodeMap).forEach(function (name) {
            var node = nodeMap[name];
            this[name] = Function("return " + node.source.join(' + ') + ";");
            if (node.hasSuperCall) {
                var inner_1 = Function('$super', "return " + node.innerSource.join(' + ') + ";");
                var parentElementRenderer_1 = parent && parent._elementRendererMap[name + '@inner'];
                this[name + '@inner'] = function () { return inner_1.call(this, parentElementRenderer_1); };
            }
            else {
                this[name + '@inner'] = Function("return " + node.innerSource.join(' + ') + ";");
            }
        }, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap)));
    }
    Template.prototype._handleNode = function (node) {
        switch (node.nodeType) {
            case Parser_1.NodeType.ELEMENT: {
                var nodes = this._nodes;
                var el = node;
                var tagName = el.tagName;
                var elName = el.name;
                var content = el.content;
                var hasContent = content && content.length;
                if (elName) {
                    var currentNode = {
                        elementName: elName,
                        source: [
                            "'<" + tagName + renderAttributes_1.default(this._elementClassesTemplate, el) + ">'",
                            hasContent ?
                                "this['" + elName + "@inner']() + '</" + tagName + ">'" :
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
                if (hasContent) {
                    content.forEach(this._handleNode, this);
                }
                if (elName) {
                    nodes.pop();
                    this._currentNode = nodes[nodes.length - 1];
                    this._currentNode.innerSource.push("this['" + elName + "']()");
                }
                else if (hasContent || !(tagName in selfClosingTags_1.default)) {
                    this._currentNode.innerSource.push("'</" + tagName + ">'");
                }
                break;
            }
            case Parser_1.NodeType.TEXT: {
                this._currentNode.innerSource.push("'" + escape_string_1.default(node.value) + "'");
                break;
            }
            case Parser_1.NodeType.SUPER_CALL: {
                this._currentNode.innerSource.push("$super.call(this)");
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

"use strict";
var escape_string_1 = require("escape-string");
var escape_html_1 = require("@riim/escape-html");
var Parser_1 = require("./Parser");
var selfClosingTags_1 = require("./selfClosingTags");
var hasOwn = Object.prototype.hasOwnProperty;
var join = Array.prototype.join;
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
        var rootNode = { elementName: null, source: null, innerSource: [], containsSuperCall: false };
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
                if (node.containsSuperCall) {
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
                var parent_1 = this.parent;
                var nodes = this._nodes;
                var el = node;
                var tagName = el.tagName;
                var elName = el.name;
                var elAttrs = el.attributes;
                var content = el.content;
                if (elName) {
                    var attrListMap = this._attributeListMap ||
                        (this._attributeListMap = Object.create(parent_1 && parent_1._attributeListMap || null));
                    var attrCountMap = this._attributeCountMap ||
                        (this._attributeCountMap = Object.create(parent_1 && parent_1._attributeCountMap || null));
                    var renderredAttrs = void 0;
                    if (elAttrs && (elAttrs.list.length || elAttrs.superCall)) {
                        var superCall = elAttrs.superCall;
                        var attrList = void 0;
                        var attrCount = void 0;
                        if (superCall) {
                            if (!parent_1) {
                                throw new TypeError("Required parent template for \"" + superCall.raw + "\"");
                            }
                            attrList = attrListMap[elName] =
                                Object.create(parent_1._attributeListMap[superCall.elementName || elName] || null);
                            attrCount = attrCountMap[elName] =
                                parent_1._attributeCountMap[superCall.elementName || elName] || 0;
                        }
                        else {
                            attrList = attrListMap[elName] = {};
                            attrCount = attrCountMap[elName] = 0;
                        }
                        for (var _i = 0, _a = elAttrs.list; _i < _a.length; _i++) {
                            var attr = _a[_i];
                            var name_1 = attr.name;
                            var value = attr.value;
                            var index = attrList[name_1];
                            if (index === undefined) {
                                attrList[attrCount] = " " + name_1 + "=\"" + (value && escape_html_1.default(escape_string_1.default(value))) + "\"";
                                attrList[name_1] = attrCount++;
                                attrCountMap[elName] = attrCount;
                            }
                            else {
                                attrList[index] = " " + name_1 + "=\"" + (value && escape_html_1.default(escape_string_1.default(value))) + "\"";
                                attrList[name_1] = index;
                            }
                        }
                        if (elName.charAt(0) != '_') {
                            var hasAttrClass = hasOwn.call(attrList, 'class');
                            attrList = { __proto__: attrList, length: attrCount + +!hasAttrClass };
                            if (hasAttrClass) {
                                attrList[attrList['class']] = ' class="' +
                                    this._elementClassesTemplate.join(elName + ' ') +
                                    attrList[attrList['class']].slice(8);
                            }
                            else {
                                attrList[attrCount] = " class=\"" + this._elementClassesTemplate.join(elName + ' ').slice(0, -1) + "\"";
                            }
                        }
                        else {
                            attrList = { __proto__: attrList, length: attrCount };
                        }
                        renderredAttrs = join.call(attrList, '');
                    }
                    else {
                        renderredAttrs = elName.charAt(0) != '_' ?
                            " class=\"" + this._elementClassesTemplate.join(elName + ' ').slice(0, -1) + "\"" :
                            '';
                    }
                    var currentNode = {
                        elementName: elName,
                        source: [
                            "'<" + tagName + renderredAttrs + ">'",
                            content && content.length ?
                                "this['" + elName + "@content']() + '</" + tagName + ">'" :
                                (!content && tagName in selfClosingTags_1.default ? "''" : "'</" + tagName + ">'")
                        ],
                        innerSource: [],
                        containsSuperCall: false
                    };
                    nodes.push((this._currentNode = currentNode));
                    this._nodeMap[elName] = currentNode;
                }
                else {
                    this._currentNode.innerSource.push("'<" + tagName + (elAttrs ?
                        elAttrs.list.map(function (attr) { return " " + attr.name + "=\"" + (attr.value && escape_html_1.default(escape_string_1.default(attr.value))) + "\""; }).join('') :
                        '') + ">'");
                }
                if (content) {
                    for (var _b = 0, content_1 = content; _b < content_1.length; _b++) {
                        var contentNode = content_1[_b];
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
                this._currentNode.containsSuperCall = true;
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

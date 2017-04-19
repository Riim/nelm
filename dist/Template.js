"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var escape_string_1 = require("escape-string");
var escape_html_1 = require("@riim/escape-html");
var Parser_1 = require("./Parser");
var selfClosingTags_1 = require("./selfClosingTags");
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
        this._elements = [(this._currentElement = { name: null, superCall: false, source: null, innerSource: [] })];
        var elMap = this._elementMap = {};
        for (var _i = 0, _a = block.content; _i < _a.length; _i++) {
            var node = _a[_i];
            this._handleNode(node);
        }
        this._renderer = parent ?
            parent._renderer :
            Function("return " + this._currentElement.innerSource.join(' + ') + ";");
        Object.keys(elMap).forEach(function (name) {
            var el = elMap[name];
            this[name] = Function("return " + el.source.join(' + ') + ";");
            if (el.superCall) {
                var inner_1 = Function('$super', "return " + (el.innerSource.join(' + ') || "''") + ";");
                var parentElementRendererMap_1 = parent && parent._elementRendererMap;
                this[name + '@content'] = function () { return inner_1.call(this, parentElementRendererMap_1); };
            }
            else {
                this[name + '@content'] = Function("return " + (el.innerSource.join(' + ') || "''") + ";");
            }
        }, (this._elementRendererMap = { __proto__: parent && parent._elementRendererMap }));
    }
    Template.prototype._handleNode = function (node, parentElementName) {
        switch (node.nodeType) {
            case Parser_1.NodeType.ELEMENT: {
                var parent_1 = this.parent;
                var els = this._elements;
                var el = node;
                var isHelper = el.isHelper;
                var tagName = el.tagName;
                var elNames = el.names;
                var elName = elNames && elNames[0];
                var elAttrs = el.attributes;
                var content = el.content;
                if (elNames) {
                    if (elName) {
                        if (tagName) {
                            (this._tagNameMap || (this._tagNameMap = { __proto__: parent_1 && parent_1._tagNameMap || null }))[elName] = tagName;
                        }
                        else {
                            // Не надо добавлять в конец ` || 'div'`, тк. ниже tagName используется как имя хелпера.
                            tagName = parent_1 && parent_1._tagNameMap && parent_1._tagNameMap[elName];
                        }
                        var renderedAttrs = void 0;
                        if (elAttrs && (elAttrs.list.length || elAttrs.superCall)) {
                            var attrListMap = this._attributeListMap || (this._attributeListMap = {
                                __proto__: parent_1 && parent_1._attributeListMap || null
                            });
                            var attrCountMap = this._attributeCountMap || (this._attributeCountMap = {
                                __proto__: parent_1 && parent_1._attributeCountMap || null
                            });
                            var elAttrsSuperCall = elAttrs.superCall;
                            var attrList = void 0;
                            var attrCount = void 0;
                            if (elAttrsSuperCall) {
                                if (!parent_1) {
                                    throw new TypeError("Required parent template for \"" + elAttrsSuperCall.raw + "\"");
                                }
                                attrList = attrListMap[elName] = Object.create(parent_1._attributeListMap[elAttrsSuperCall.elementName || elName] || null);
                                attrCount = attrCountMap[elName] =
                                    parent_1._attributeCountMap[elAttrsSuperCall.elementName || elName] || 0;
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
                                    attrList[name_1] = attrCount;
                                    attrCountMap[elName] = ++attrCount;
                                }
                                else {
                                    attrList[index] = " " + name_1 + "=\"" + (value && escape_html_1.default(escape_string_1.default(value))) + "\"";
                                    attrList[name_1] = index;
                                }
                            }
                            var hasAttrClass = 'class' in attrList;
                            attrList = {
                                __proto__: attrList,
                                length: attrCount + !hasAttrClass
                            };
                            if (hasAttrClass) {
                                attrList[attrList['class']] = ' class="' + this._renderElementClasses(elNames) +
                                    attrList[attrList['class']].slice(' class="'.length);
                            }
                            else {
                                attrList[attrCount] = " class=\"" + this._renderElementClasses(elNames).slice(0, -1) + "\"";
                            }
                            renderedAttrs = join.call(attrList, '');
                        }
                        else if (!isHelper) {
                            renderedAttrs = " class=\"" + this._renderElementClasses(elNames).slice(0, -1) + "\"";
                        }
                        else {
                            renderedAttrs = '';
                        }
                        var currentEl = {
                            name: elName,
                            superCall: false,
                            source: isHelper ? ["this['" + elName + "@content']()"] : [
                                "'<" + (tagName || 'div') + renderedAttrs + ">'",
                                content && content.length ?
                                    "this['" + elName + "@content']() + '</" + (tagName || 'div') + ">'" :
                                    (!content && tagName && tagName in selfClosingTags_1.default ?
                                        "''" :
                                        "'</" + (tagName || 'div') + ">'")
                            ],
                            innerSource: []
                        };
                        els.push((this._currentElement = currentEl));
                        this._elementMap[elName] = currentEl;
                    }
                    else if (!isHelper) {
                        if (elAttrs && elAttrs.list.length) {
                            var renderedClasses = void 0;
                            var attrs = '';
                            for (var _b = 0, _c = elAttrs.list; _b < _c.length; _b++) {
                                var attr = _c[_b];
                                var value = attr.value;
                                if (attr.name == 'class') {
                                    renderedClasses = this._renderElementClasses(elNames);
                                    attrs += " class=\"" + (value ? renderedClasses + value : renderedClasses.slice(0, -1)) + "\"";
                                }
                                else {
                                    attrs += " " + attr.name + "=\"" + (value && escape_html_1.default(escape_string_1.default(value))) + "\"";
                                }
                            }
                            this._currentElement.innerSource.push("'<" + (tagName || 'div') + (renderedClasses ?
                                attrs :
                                " class=\"" + this._renderElementClasses(elNames).slice(0, -1) + "\"" + attrs) + ">'");
                        }
                        else {
                            this._currentElement.innerSource.push("'<" + (tagName || 'div') + " class=\"" + this._renderElementClasses(elNames).slice(0, -1) + "\">'");
                        }
                    }
                }
                else if (!isHelper) {
                    this._currentElement.innerSource.push("'<" + (tagName || 'div') + (elAttrs ? elAttrs.list.map(function (attr) { return " " + attr.name + "=\"" + (attr.value && escape_html_1.default(escape_string_1.default(attr.value))) + "\""; }).join('') : '') + ">'");
                }
                if (isHelper) {
                    if (!tagName) {
                        throw new TypeError('tagName is required');
                    }
                    var helper = Template.helpers[tagName];
                    if (!helper) {
                        throw new TypeError("Helper \"" + tagName + "\" is not defined");
                    }
                    var content_1 = helper(el);
                    if (content_1) {
                        for (var _d = 0, content_2 = content_1; _d < content_2.length; _d++) {
                            var contentNode = content_2[_d];
                            this._handleNode(contentNode, elName || parentElementName);
                        }
                    }
                }
                else if (content) {
                    for (var _e = 0, content_3 = content; _e < content_3.length; _e++) {
                        var contentNode = content_3[_e];
                        this._handleNode(contentNode, elName || parentElementName);
                    }
                }
                if (elName) {
                    els.pop();
                    this._currentElement = els[els.length - 1];
                    this._currentElement.innerSource.push("this['" + elName + "']()");
                }
                else if (!isHelper && (content || !tagName || !(tagName in selfClosingTags_1.default))) {
                    this._currentElement.innerSource.push("'</" + (tagName || 'div') + ">'");
                }
                break;
            }
            case Parser_1.NodeType.TEXT: {
                this._currentElement.innerSource.push("'" + escape_string_1.default(node.value) + "'");
                break;
            }
            case Parser_1.NodeType.SUPER_CALL: {
                this._currentElement.innerSource
                    .push("$super['" + (node.elementName || parentElementName) + "@content'].call(this)");
                this._currentElement.superCall = true;
                break;
            }
        }
    };
    Template.prototype._renderElementClasses = function (elNames) {
        var elClasses = elNames[0] ? this._elementClassesTemplate.join(elNames[0] + ' ') : '';
        var elNameCount = elNames.length;
        if (elNameCount > 1) {
            for (var i = 1; i < elNameCount; i++) {
                elClasses += this._elementClassesTemplate.join(elNames[i] + ' ');
            }
        }
        return elClasses;
    };
    Template.prototype.extend = function (beml, opts) {
        return new Template(beml, { __proto__: opts || null, parent: this });
    };
    Template.prototype.render = function () {
        return this._renderer.call(this._elementRendererMap);
    };
    return Template;
}());
Template.helpers = {
    section: function (el) { return el.content; }
};
exports.default = Template;

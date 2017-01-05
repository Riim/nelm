"use strict";
var escape_string_1 = require("escape-string");
var escape_html_1 = require("@riim/escape-html");
function renderAttributes(classesTemplate, el) {
    var elName = el.name;
    var attrs = el.attributes;
    if (attrs && attrs.list.length) {
        var f_1 = !elName;
        var result = attrs.list.map(function (attr) {
            var value = attr.value;
            if (!f_1 && attr.name == 'class') {
                f_1 = true;
                value = classesTemplate.join(elName + ' ') + value;
            }
            return " " + attr.name + "=\"" + (value && escape_html_1.default(escape_string_1.default(value))) + "\"";
        });
        return (f_1 ? '' : " class=\"" + classesTemplate.join(elName + ' ') + "\"") + result.join('');
    }
    return elName ? " class=\"" + classesTemplate.join(elName + ' ') + "\"" : '';
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = renderAttributes;

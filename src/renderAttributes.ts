import escapeString from 'escape-string';
import escapeHTML from '@riim/escape-html';
import { IElement } from './Parser';

export default function renderAttributes(elementClassesTemplate: Array<string>, el: IElement): string {
	let elName = el.name;
	let attrs = el.attributes;

	if (attrs && attrs.list.length) {
		let f = !elName || elName.charAt(0) == '_';
		let result = attrs.list.map(attr => {
			let value = attr.value;

			if (!f && attr.name == 'class') {
				f = true;
				value = elementClassesTemplate.join(elName + ' ') + value;
			}

			return ` ${ attr.name }="${ value && escapeHTML(escapeString(value)) }"`;
		});

		return (f ? '' : ` class="${ elementClassesTemplate.join(elName + ' ') }"`) + result.join('');
	}

	return elName && elName.charAt(0) != '_' ? ` class="${ elementClassesTemplate.join(elName + ' ') }"` : '';
}

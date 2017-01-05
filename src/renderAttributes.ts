import escapeString from 'escape-string';
import escapeHTML from '@riim/escape-html';
import { IElement } from './Parser';

export default function renderAttributes(classesTemplate: Array<string>, el: IElement): string {
	let elName = el.name;
	let attrs = el.attributes;

	if (attrs && attrs.list.length) {
		let f = !elName;
		let result = attrs.list.map(attr => {
			let value = attr.value;

			if (!f && attr.name == 'class') {
				f = true;
				value = classesTemplate.join(elName + ' ') + value;
			}

			return ` ${ attr.name }="${ value && escapeHTML(escapeString(value)) }"`;
		});

		return (f ? '' : ` class="${ classesTemplate.join(elName + ' ') }"`) + result.join('');
	}

	return elName ? ` class="${ classesTemplate.join(elName + ' ') }"` : '';
}

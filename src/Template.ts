import escapeString from 'escape-string';
import escapeHTML from '@riim/escape-html';
import {
	NodeType,
	INode,
	TContent,
	IBlock,
	IElement,
	ITextNode,
	ISuperCall,
	default as Parser
} from './Parser';
import selfClosingTags from './selfClosingTags';

let join = Array.prototype.join;

export interface ITemplateElement {
	name: string | null;
	superCall: boolean;
	source: Array<string> | null;
	innerSource: Array<string>;
}

export interface IRenderer {
	(this: IElementRendererMap): string;
}

export interface IElementRenderer {
	(this: IElementRendererMap, $super?: IElementRendererMap): string;
}

export interface IElementRendererMap {
	[elName: string]: IElementRenderer;
}

let elDelimiter = '__';

export default class Template {
	static helpers: { [name: string]: (el: IElement) => TContent | null } = {
		section: el => el.content
	};

	parent: Template | null;

	_elementClassesTemplate: Array<string>;

	_tagNameMap: { [elName: string]: string };

	_attributeListMap: { [elName: string]: Object };
	_attributeCountMap: { [elName: string]: number };

	_currentElement: ITemplateElement;
	_elements: Array<ITemplateElement>;
	_elementMap: { [elName: string]: ITemplateElement };

	_renderer: IRenderer;
	_elementRendererMap: IElementRendererMap;

	constructor(beml: string | IBlock, opts?: { parent?: Template, blockName?: string }) {
		let parent = this.parent = opts && opts.parent || null;
		let block = typeof beml == 'string' ? new Parser(beml).parse() : beml;
		let blockName = opts && opts.blockName || block.name;

		this._elementClassesTemplate = parent ?
			[blockName ? blockName + elDelimiter : ''].concat(parent._elementClassesTemplate) :
			[blockName ? blockName + elDelimiter : '', ''];

		this._elements = [(this._currentElement = { name: null, superCall: false, source: null, innerSource: [] })];
		let elMap = this._elementMap = {} as { [elName: string]: ITemplateElement };

		for (let node of block.content) {
			this._handleNode(node);
		}

		this._renderer = parent ?
			parent._renderer :
			Function(`return ${ this._currentElement.innerSource.join(' + ') };`) as IRenderer;

		Object.keys(elMap).forEach(function(this: IElementRendererMap, name: string) {
			let el = elMap[name];

			this[name] = Function(`return ${ (el.source as Array<string>).join(' + ') };`) as IElementRenderer;

			if (el.superCall) {
				let inner = Function('$super', `return ${ el.innerSource.join(' + ') || "''" };`) as IElementRenderer;
				let parentElementRendererMap = parent && parent._elementRendererMap;
				this[name + '@content'] = function() { return inner.call(this, parentElementRendererMap); };
			} else {
				this[name + '@content'] = Function(`return ${ el.innerSource.join(' + ') || "''" };`) as
					IElementRenderer;
			}
		}, (this._elementRendererMap = { __proto__: parent && parent._elementRendererMap } as any));
	}

	_handleNode(node: INode, parentElementName?: string) {
		switch (node.nodeType) {
			case NodeType.ELEMENT: {
				let parent = this.parent;
				let els = this._elements;
				let el = node as IElement;
				let tagName = el.tagName;
				let isHelper = el.isHelper;
				let elNames = el.names;
				let elName = elNames && elNames[0];
				let elAttrs = el.attributes;
				let content = el.content;

				if (elNames) {
					if (elName) {
						if (tagName) {
							(this._tagNameMap || (
								this._tagNameMap = { __proto__: parent && parent._tagNameMap || null } as any
							))[elName] = tagName;
						} else {
							// Не надо добавлять в конец ` || 'div'`, тк. ниже tagName используется как имя хелпера.
							tagName = parent && parent._tagNameMap && parent._tagNameMap[elName];
						}

						let renderedAttrs: string;

						if (elAttrs && (elAttrs.list.length || elAttrs.superCall)) {
							let attrListMap = this._attributeListMap || (
								this._attributeListMap = {
									__proto__: parent && parent._attributeListMap || null
								} as any
							);
							let attrCountMap = this._attributeCountMap || (
								this._attributeCountMap = {
									__proto__: parent && parent._attributeCountMap || null
								} as any
							);

							let elAttrsSuperCall = elAttrs.superCall;
							let attrList: Object;
							let attrCount: number;

							if (elAttrsSuperCall) {
								if (!parent) {
									throw new TypeError('Parent template is required when using super');
								}

								attrList = attrListMap[elName] = Object.create(
									parent._attributeListMap[elAttrsSuperCall.elementName || elName] || null
								);
								attrCount = attrCountMap[elName] =
									parent._attributeCountMap[elAttrsSuperCall.elementName || elName] || 0;
							} else {
								attrList = attrListMap[elName] = {};
								attrCount = attrCountMap[elName] = 0;
							}

							for (let attr of elAttrs.list) {
								let name = attr.name;
								let value = attr.value;
								let index = attrList[name];

								if (index === undefined) {
									attrList[attrCount] = ` ${ name }="${ value && escapeHTML(escapeString(value)) }"`;
									attrList[name] = attrCount;
									attrCountMap[elName] = ++attrCount;
								} else {
									attrList[index] = ` ${ name }="${ value && escapeHTML(escapeString(value)) }"`;
									attrList[name] = index;
								}
							}

							let hasAttrClass = 'class' in attrList;

							attrList = {
								__proto__: attrList,
								length: attrCount + (!hasAttrClass as any)
							};

							if (hasAttrClass) {
								attrList[attrList['class']] = ` class="<<${ elNames.join(',') }>> ` +
									attrList[attrList['class']].slice(' class="'.length);
							} else {
								attrList[attrCount] = ` class="<<${ elNames.join(',') }>>"`;
							}

							renderedAttrs = join.call(attrList, '');
						} else if (!isHelper) {
							renderedAttrs = ` class="<<${ elNames.join(',') }>>"`;
						} else {
							renderedAttrs = '';
						}

						let currentEl = {
							name: elName,
							superCall: false,
							source: isHelper ? [`this['${ elName }@content']()`] : [
								`'<${ tagName || 'div' }${ renderedAttrs }>'`,
								content && content.length ?
									`this['${ elName }@content']() + '</${ tagName || 'div' }>'` :
									(
										!content && tagName && tagName in selfClosingTags ?
											"''" :
											`'</${ tagName || 'div' }>'`
									)
							],
							innerSource: []
						};

						els.push((this._currentElement = currentEl));
						this._elementMap[elName] = currentEl;
					} else if (!isHelper) {
						if (elAttrs && elAttrs.list.length) {
							let elNamesInsert;
							let attrs = '';

							for (let attr of elAttrs.list) {
								let value = attr.value;

								if (attr.name == 'class') {
									elNamesInsert = `<<${ elNames.slice(1).join(',') }>>`;
									attrs += ` class="${ value ? elNamesInsert + ' ' + value : elNamesInsert }"`;
								} else {
									attrs += ` ${ attr.name }="${ value && escapeHTML(escapeString(value)) }"`;
								}
							}

							this._currentElement.innerSource.push(
								`'<${ tagName || 'div' }${
									elNamesInsert ? attrs : ` class="<<${ elNames.slice(1).join(',') }>>"` + attrs
								}>'`
							);
						} else {
							this._currentElement.innerSource.push(
								`'<${ tagName || 'div' } class="<<${ elNames.slice(1).join(',') }>>">'`
							);
						}
					}
				} else if (!isHelper) {
					this._currentElement.innerSource.push(`'<${ tagName || 'div' }${
						elAttrs ? elAttrs.list.map(
							attr => ` ${ attr.name }="${ attr.value && escapeHTML(escapeString(attr.value)) }"`
						).join('') : ''
					}>'`);
				}

				if (isHelper) {
					if (!tagName) {
						throw new TypeError('tagName is required');
					}

					let helper = Template.helpers[tagName];

					if (!helper) {
						throw new TypeError(`Helper "${ tagName }" is not defined`);
					}

					let content = helper(el);

					if (content) {
						for (let contentNode of content) {
							this._handleNode(contentNode, elName || parentElementName);
						}
					}
				} else if (content) {
					for (let contentNode of content) {
						this._handleNode(contentNode, elName || parentElementName);
					}
				}

				if (elName) {
					els.pop();
					this._currentElement = els[els.length - 1];
					this._currentElement.innerSource.push(`this['${ elName }']()`);
				} else if (!isHelper && (content || !tagName || !(tagName in selfClosingTags))) {
					this._currentElement.innerSource.push(`'</${ tagName || 'div' }>'`);
				}

				break;
			}
			case NodeType.TEXT: {
				this._currentElement.innerSource.push(`'${ escapeString((node as ITextNode).value) }'`);
				break;
			}
			case NodeType.SUPER_CALL: {
				this._currentElement.innerSource
					.push(`$super['${ (node as ISuperCall).elementName || parentElementName }@content'].call(this)`);
				this._currentElement.superCall = true;
				break;
			}
		}
	}

	extend(beml: string | IBlock, opts?: { blockName?: string }): Template {
		return new Template(beml, { __proto__: opts || null, parent: this } as any);
	}

	setBlockName(blockName: string | null): Template {
		this._elementClassesTemplate[0] = blockName ? blockName + elDelimiter : '';
		return this;
	}

	render() {
		return this._renderer.call(this._elementRendererMap).replace(
			/<<([^>]+)>>/g,
			(match: RegExpMatchArray, names: string): string => this._renderElementClasses(names.split(','))
		);
	}

	_renderElementClasses(elNames: Array<string | null>): string {
		let elClasses = '';

		for (let i = 0, l = elNames.length; i < l; i++) {
			elClasses += this._elementClassesTemplate.join(elNames[i] + ' ');
		}

		return elClasses.slice(0, -1);
	}
}

import escapeString from 'escape-string';
import escapeHTML from '@riim/escape-html';
import {
	NodeType,
	INode,
	TContent,
	IElement,
	ITextNode,
	ISuperCall,
	default as Parser
} from './Parser';
import selfClosingTags from './selfClosingTags';

let join = Array.prototype.join;

export interface ITemplateNode {
	elementName: string | null;
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

	_currentNode: ITemplateNode;
	_nodes: Array<ITemplateNode>;
	_nodeMap: { [elName: string]: ITemplateNode };

	_renderer: IRenderer;
	_elementRendererMap: IElementRendererMap;

	constructor(beml: string, opts?: { parent?: Template, blockName?: string }) {
		let block = new Parser(beml).parse();
		let blockName = opts && opts.blockName || block.name;

		if (!blockName) {
			throw new TypeError('blockName is required');
		}

		let parent = this.parent = opts && opts.parent || null;

		this._elementClassesTemplate = parent ?
			[blockName + elDelimiter].concat(parent._elementClassesTemplate) :
			[blockName + elDelimiter, ''];

		this._nodes = [(this._currentNode = { elementName: null, superCall: false, source: null, innerSource: [] })];
		let nodeMap = this._nodeMap = {} as { [elName: string]: ITemplateNode };

		for (let node of block.content) {
			this._handleNode(node);
		}

		this._renderer = parent ?
			parent._renderer :
			Function(`return ${ this._currentNode.innerSource.join(' + ') };`) as IRenderer;

		Object.keys(nodeMap).forEach(function(this: IElementRendererMap, name: string) {
			let node = nodeMap[name];

			this[name] = Function(`return ${ (node.source as Array<string>).join(' + ') };`) as IElementRenderer;

			if (node.superCall) {
				let inner = Function('$super', `return ${ node.innerSource.join(' + ') || "''" };`) as IElementRenderer;
				let parentElementRendererMap = parent && parent._elementRendererMap;
				this[name + '@content'] = function() { return inner.call(this, parentElementRendererMap); };
			} else {
				this[name + '@content'] = Function(
					`return ${ node.innerSource.join(' + ') || "''" };`
				) as IElementRenderer;
			}
		}, (this._elementRendererMap = { __proto__: parent && parent._elementRendererMap } as any));
	}

	_handleNode(node: INode, parentElementName?: string) {
		switch (node.nodeType) {
			case NodeType.ELEMENT: {
				let parent = this.parent;
				let nodes = this._nodes;
				let el = node as IElement;
				let tagName = el.tagName;
				let elNames = el.names;
				let elName = elNames && elNames[0];

				if (el.isHelper) {
					let helper = Template.helpers[
						tagName || elName && parent && parent._tagNameMap && parent._tagNameMap[elName] || 'div'
					];

					let content = helper(el);

					if (!content) {
						return;
					}

					if (content.length == 1 && content[0].nodeType == NodeType.ELEMENT) {
						el = content[0] as IElement;
						tagName = el.tagName;
						elNames = el.names;
						elName = elNames && elNames[0];
					} else {
						for (let contentNode of content) {
							this._handleNode(contentNode, elName || parentElementName);
						}

						return;
					}
				}

				let elAttrs = el.attributes;
				let content = el.content;

				if (elNames) {
					if (elName) {
						let renderedAttrs: string;

						if (tagName) {
							(this._tagNameMap || (
								this._tagNameMap = { __proto__: parent && parent._tagNameMap || null } as any
							))[elName] = tagName;
						} else {
							tagName = parent && parent._tagNameMap && parent._tagNameMap[elName] || 'div';
						}

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
									throw new TypeError(`Required parent template for "${ elAttrsSuperCall.raw }"`);
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
								attrList[attrList['class']] = ' class="' + this._renderElementClasses(elNames) +
									attrList[attrList['class']].slice(' class="'.length);
							} else {
								attrList[attrCount] = ` class="${ this._renderElementClasses(elNames).slice(0, -1) }"`;
							}

							renderedAttrs = join.call(attrList, '');
						} else {
							renderedAttrs = ` class="${ this._renderElementClasses(elNames).slice(0, -1) }"`;
						}

						let currentNode = {
							elementName: elName,
							superCall: false,
							source: [
								`'<${ tagName }${ renderedAttrs }>'`,
								content && content.length ?
									`this['${ elName }@content']() + '</${ tagName }>'` :
									(!content && tagName in selfClosingTags ? "''" : `'</${ tagName }>'`)
							],
							innerSource: []
						};

						nodes.push((this._currentNode = currentNode));
						this._nodeMap[elName] = currentNode;
					} else if (elAttrs && elAttrs.list.length) {
						let renderedClasses;
						let attrs = '';

						for (let attr of elAttrs.list) {
							let value = attr.value;

							if (attr.name == 'class') {
								renderedClasses = this._renderElementClasses(elNames);
								attrs += ` class="${ value ? renderedClasses + value : renderedClasses.slice(0, -1) }"`;
							} else {
								attrs += ` ${ attr.name }="${ value && escapeHTML(escapeString(value)) }"`;
							}
						}

						this._currentNode.innerSource.push(
							`'<${ tagName || 'div' }${
								renderedClasses ?
									attrs :
									` class="${ this._renderElementClasses(elNames).slice(0, -1) }"` + attrs
							}>'`
						);
					} else {
						this._currentNode.innerSource.push(
							`'<${ tagName || 'div' } class="${ this._renderElementClasses(elNames).slice(0, -1) }">'`
						);
					}
				} else {
					this._currentNode.innerSource.push(`'<${ tagName || 'div' }${
						elAttrs ? elAttrs.list.map(
							attr => ` ${ attr.name }="${ attr.value && escapeHTML(escapeString(attr.value)) }"`
						).join('') : ''
					}>'`);
				}

				if (content) {
					for (let contentNode of content) {
						this._handleNode(contentNode, elName || parentElementName);
					}
				}

				if (elName) {
					nodes.pop();
					this._currentNode = nodes[nodes.length - 1];
					this._currentNode.innerSource.push(`this['${ elName }']()`);
				} else if (content || !tagName || !(tagName in selfClosingTags)) {
					this._currentNode.innerSource.push(`'</${ tagName || 'div' }>'`);
				}

				break;
			}
			case NodeType.TEXT: {
				this._currentNode.innerSource.push(`'${ escapeString((node as ITextNode).value) }'`);
				break;
			}
			case NodeType.SUPER_CALL: {
				this._currentNode.innerSource.push(
					`$super['${ (node as ISuperCall).elementName || parentElementName }@content'].call(this)`
				);
				this._currentNode.superCall = true;
				break;
			}
		}
	}

	_renderElementClasses(elNames: Array<string | null>): string {
		let elClasses = elNames[0] ? this._elementClassesTemplate.join(elNames[0] + ' ') : '';
		let elNameCount = elNames.length;

		if (elNameCount > 1) {
			for (let i = 1; i < elNameCount; i++) {
				elClasses += this._elementClassesTemplate.join(elNames[i] + ' ');
			}
		}

		return elClasses;
	}

	extend(beml: string, opts?: { blockName?: string }): Template {
		return new Template(beml, { __proto__: opts || null, parent: this } as any);
	}

	render() {
		return this._renderer.call(this._elementRendererMap);
	}
}

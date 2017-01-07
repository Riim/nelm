import escapeString from 'escape-string';
import {
	NodeType as BemlNodeType,
	INode as IBemlNode,
	TContent as TBemlContent,
	IElement as IBemlElement,
	ITextNode as IBemlTextNode,
	default as Parser
} from './Parser';
import selfClosingTags from './selfClosingTags';
import renderAttributes from './renderAttributes';

export interface INode {
	elementName: string | null;
	source: Array<string> | null;
	innerSource: Array<string>;
	hasSuperCall: boolean;
}

export interface IRenderer {
	(this: IElementRendererMap): string;
}

export interface IElementRenderer {
	(this: IElementRendererMap, $super?: IElementRenderer): string;
}

export interface IElementRendererMap {
	[name: string]: IElementRenderer;
}

let elDelimiter = '__';

export default class Template {
	parent: Template | null;

	_elementClassesTemplate: Array<string>;

	_currentNode: INode;
	_nodes: Array<INode>;
	_nodeMap: { [elName: string]: INode };

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

		this._nodes = [(this._currentNode = { elementName: null, source: null, innerSource: [], hasSuperCall: false })];
		let nodeMap = this._nodeMap = {} as { [elName: string]: INode };

		block.content.forEach(this._handleNode, this);

		this._renderer = parent ?
			parent._renderer :
			Function(`return ${ this._currentNode.innerSource.join(' + ') };`) as IRenderer;

		Object.keys(nodeMap).forEach(function(this: IElementRendererMap, name: string) {
			let node = nodeMap[name];

			this[name] = Function(`return ${ (node.source as Array<string>).join(' + ') };`) as IElementRenderer;

			if (node.hasSuperCall) {
				let inner = Function('$super', `return ${ node.innerSource.join(' + ') };`) as IElementRenderer;
				let parentElementRenderer = parent && parent._elementRendererMap[name + '@inner'];
				this[name + '@inner'] = function() { return inner.call(this, parentElementRenderer); };
			} else {
				this[name + '@inner'] = Function(`return ${ node.innerSource.join(' + ') };`) as IElementRenderer;
			}
		}, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap) as IElementRendererMap));
	}

	_handleNode(node: IBemlNode) {
		switch (node.nodeType) {
			case BemlNodeType.ELEMENT: {
				let nodes = this._nodes;
				let el = node as IBemlElement;
				let tagName = el.tagName;
				let elName = el.name;
				let content = el.content;
				let hasContent = content && content.length;

				if (elName) {
					let currentNode = {
						elementName: elName,
						source: [
							`'<${ tagName }${ renderAttributes(this._elementClassesTemplate, el) }>'`,
							hasContent ?
								`this['${ elName }@inner']() + '</${ tagName }>'` :
								(tagName in selfClosingTags ? "''" : `'</${ tagName }>'`)
						],
						innerSource: [],
						hasSuperCall: false
					} as INode;

					nodes.push((this._currentNode = currentNode));
					this._nodeMap[elName] = currentNode;
				} else {
					this._currentNode.innerSource.push(
						`'<${ tagName }${ renderAttributes(this._elementClassesTemplate, el) }>'`
					);
				}

				if (hasContent) {
					(content as TBemlContent).forEach(this._handleNode, this);
				}

				if (elName) {
					nodes.pop();
					this._currentNode = nodes[nodes.length - 1];
					this._currentNode.innerSource.push(`this['${ elName }']()`);
				} else if (hasContent || !(tagName in selfClosingTags)) {
					this._currentNode.innerSource.push(`'</${ tagName }>'`);
				}

				break;
			}
			case BemlNodeType.TEXT: {
				this._currentNode.innerSource.push(`'${ escapeString((node as IBemlTextNode).value) }'`);
				break;
			}
			case BemlNodeType.SUPER_CALL: {
				this._currentNode.innerSource.push(`$super.call(this)`);
				this._currentNode.hasSuperCall = true;
				break;
			}
		}
	}

	extend(beml: string, opts?: { blockName?: string }): Template {
		return new Template(beml, { __proto__: opts || null, parent: this } as any);
	}

	render() {
		return this._renderer.call(this._elementRendererMap);
	}
}

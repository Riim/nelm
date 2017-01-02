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

let elDelimiter = '__';

export interface INode {
	elementName: string | null;
	source: Array<string>;
	hasSuperCall: boolean;
	[key: string]: any;
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

export default class Template {
	static compile(beml: string): Template {
		return new Template(beml);
	}

	parent: Template | null;

	_blockName: string;
	_blockElementClassTemplate: Array<string>;

	_currentNode: INode;
	_nodes: Array<INode>;
	_nodeMap: { [elName: string]: INode };

	_renderer: IRenderer;
	_elementRendererMap: IElementRendererMap;

	constructor(beml: string, parent: Template | null = null) {
		let block = new Parser(beml).parse();
		let blockName = block.name;

		this.parent = parent;

		this._blockName = blockName;
		this._blockElementClassTemplate = parent ?
			[blockName + elDelimiter].concat(parent._blockElementClassTemplate) :
			[blockName + elDelimiter, ''];

		this._nodes = [(this._currentNode = { elementName: null, source: [], hasSuperCall: false })];
		let nodeMap = this._nodeMap = {} as { [elName: string]: INode };

		block.content.forEach(this._handleNode, this);

		this._renderer = parent ?
			parent._renderer :
			Function(`return [${ this._currentNode.source.join(', ') }].join('');`) as IRenderer;

		Object.keys(nodeMap).forEach(function(this: IElementRendererMap, name: string) {
			let node = nodeMap[name];

			if (node.hasSuperCall) {
				let inner = Function('$super', `return ${ node.source.join(' + ') };`) as IElementRenderer;
				let parentElementRenderer = parent && parent._elementRendererMap[name];
				this[name] = function() { return inner.call(this, parentElementRenderer); };
			} else {
				this[name] = Function(`return ${ node.source.join(' + ') };`) as IElementRenderer;
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

				if (elName) {
					let currentNode = { elementName: elName, source: [], hasSuperCall: false };
					nodes.push((this._currentNode = currentNode));
					this._nodeMap[elName] = currentNode;
				}

				this._currentNode.source.push(
					`'<${ tagName }${ renderAttributes(this._blockElementClassTemplate, el) }>'`
				);

				let hasContent = content && content.length;

				if (hasContent) {
					(content as TBemlContent).forEach(this._handleNode, this);
				}

				if (hasContent || !(tagName in selfClosingTags)) {
					this._currentNode.source.push(`'</${ tagName }>'`);
				}

				if (elName) {
					nodes.pop();
					this._currentNode = nodes[nodes.length - 1];
					this._currentNode.source.push(`this['${ elName }']()`);
				}

				break;
			}
			case BemlNodeType.TEXT: {
				this._currentNode.source.push(`'${ escapeString((node as IBemlTextNode).value) }'`);
				break;
			}
			case BemlNodeType.SUPER_CALL: {
				this._currentNode.source.push(`$super.call(this)`);
				this._currentNode.hasSuperCall = true;
				break;
			}
		}
	}

	extend(beml: string): Template {
		return new Template(beml, this);
	}

	render() {
		return this._renderer.call(this._elementRendererMap);
	}
}
